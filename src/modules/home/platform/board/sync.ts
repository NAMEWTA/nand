import { boardTileSources, boardTiles, persistedBoardTiles, type TileDefaults } from '../../core/board/board-tiles';
import { withStableSectionIds } from '../../core/board/section-identity';
import { legacyBoardMembers } from '../../core/board/widget-members';
import { effectiveBoardLayout } from '../../core/board/layout';
import type { BoardTile, BoardWidgetMember } from '../../core/board/types/model';
import { DASHBOARD_CONFLICT_DIR, DashboardSaveError, dashboardSaveMessage, type DashboardSaveState, type DashboardSaveStatus } from '../../core/board/save-state';
import { ensureDirectory } from '../../../../shared/storage/durable-state';
import { privateVaultStorage } from '../../../../host/obsidian/storage/private-storage';
import { App, Notice, TFile, TFolder } from 'obsidian';
import { renamedImagePath } from '../../core/board/focal-point';
import { moveBeside, moveToOwnRow, unpartnerAt } from '../../core/board/column-pairs';
import {
	type DocPath,
	appendDocChild,
	demoteDocToChild,
	insertDocSibling,
	moveDocBeside,
	removeDocAt,
	updateDocAt,
} from '../../core/board/doc-tree';
import { generateDefaultMarkdown } from '../../core/board/parser/default-document';
import { parse, serialize } from '../../core/board/parser/index';
import {
	type TaskPath,
	appendChild,
	archiveCompleted,
	demoteToChild,
	getTaskByPath,
	insertSibling,
	moveTaskBeside,
	nestIntoTarget,
	promoteToTopLevel,
	recalcChecked,
	removeTaskAt,
	updateTaskAt,
} from '../../core/board/task-tree';
import type {
	BannerData,
	BoardLayout,
	CardType,
	DashboardCard,
	DashboardData,
	DashboardSettings,
	DocNode,
	QuickAction,
	TaskItem,
} from '../../core/board/types/index';
import { workspaceBackupName } from '../../core/workspace/workspace-registry';
import { onLanguageChanged, t } from '../../../../shared/i18n/index';
import { moveDashboardCard } from './card-move';

import type { DashboardUpdateSource } from '../../core/board/render-update';

type DataCallback = (data: DashboardData, source: DashboardUpdateSource) => void;

type TaskDropMode = 'before' | 'after' | 'nest';

export class SyncEngine {
	private localRevision = 0;
	private recoveryRevision = 0;
	private saveState: Readonly<DashboardSaveState> = Object.freeze({ status: 'saved', localRevision: 0, recoveryRevision: 0, recoveryPath: null, detail: '' });
	private saveListeners = new Set<(state: Readonly<DashboardSaveState>) => void>();
	private saveNotice: Notice | null = null;
	private languageCleanup: (() => void) | null = null;
	private closingTask: Promise<void> | null = null;
	private closed = false;

	getSaveState(): Readonly<DashboardSaveState> { return this.saveState; }
	getLocalDraft(): string { return this.data ? serialize(this.data) : ''; }
	onSaveStateUpdate(callback: (state: Readonly<DashboardSaveState>) => void): () => void {
		this.saveListeners.add(callback); callback(this.saveState);
		return () => this.saveListeners.delete(callback);
	}
	private setSaveState(status: DashboardSaveStatus, detail = ''): void {
		this.saveState = Object.freeze({ status, localRevision: this.localRevision, recoveryRevision: this.recoveryRevision,
			recoveryPath: this.conflict ? DASHBOARD_CONFLICT_DIR + '/' + this.conflict.id + '.json' : null, detail });
		for (const callback of this.saveListeners) callback(this.saveState);
		this.refreshSaveNotice();
	}
	private refreshSaveNotice(): void {
		if (this.saveState.status === 'saved') { this.saveNotice?.hide(); this.saveNotice = null; return; }
		if (this.saveState.status === 'saving' && !this.saveNotice) return;
		const message = dashboardSaveMessage(this.saveState);
		if (this.saveNotice) this.saveNotice.setMessage(message);
		else this.saveNotice = new Notice(message, 0);
	}
	private saveFailure(error: unknown): DashboardSaveError {
		const detail = error instanceof Error ? error.message : String(error);
		const recovered = this.recoveryRevision === this.localRevision;
		const conflict = error instanceof DashboardSaveError && error.code === 'conflict';
		this.setSaveState(this.blocked ? conflict ? recovered ? 'conflict-saved' : 'conflict-pending' : 'recovery-error' : 'save-error', detail);
		return error instanceof DashboardSaveError ? error : new DashboardSaveError(this.blocked ? 'recoveryFailed' : 'saveFailed', detail);
	}
	private assertOpen(): void {
		if (this.closed) throw new DashboardSaveError('closed', t('dashboard.sync.closed'));
	}
	/** Drains admitted work. A durable recovery copy does not mean the original note was saved. */
	async flush(): Promise<void> {
		if (this.deferredWriteTimer !== null) { window.clearTimeout(this.deferredWriteTimer); this.deferredWriteTimer = null; }
		let queue: Promise<void>;
		do { queue = this.writeQueue; await queue; } while (queue !== this.writeQueue);
		if (!this.localDirty) return;
		try { await this.writeToDisk(true); }
		catch (error) {
			if (!(error instanceof DashboardSaveError && error.code === 'conflict' && this.recoveryRevision === this.localRevision)) throw error;
		}
	}
	async retrySave(): Promise<void> { await this.flush(); }
	close(): Promise<void> {
		if (this.closingTask) return this.closingTask;
		this.closed = true;
		this.unregisterFileWatchers();
		const closing = this.flush().finally(() => this.destroy());
		this.closingTask = closing;
		void closing.then(() => { if (this.closingTask === closing) this.closingTask = null; }, () => { if (this.closingTask === closing) this.closingTask = null; });
		return closing;
	}

	private app: App;
	private settings: DashboardSettings;
	private file: TFile | null = null;
	private data: DashboardData | null = null;
	private debounceTimer: number | null = null;
	private readonly debounceMs = 300;
	private writeQueue: Promise<void> = Promise.resolve();
	private baseline: string | null = null;
	private localDirty = false;
	private blocked = false;
	private conflict: {
		id: string;
		path: string;
		base: string;
		local: string;
		candidate: string;
		remote: string;
	} | null = null;
	private callbacks: DataCallback[] = [];
	private eventRef: ReturnType<typeof this.app.vault.on> | null = null;
	private static readonly BACKUP_DIR = '.nand/recovery/dashboard';
	private static readonly MAX_BACKUPS = 5;

	constructor(app: App, settings: DashboardSettings, private readonly widgetDefaults: (member: BoardWidgetMember, legacy: boolean) => TileDefaults | undefined = () => undefined) {
		this.app = app;
		this.settings = settings;
	}

	updateSettings(settings: DashboardSettings): void {
		this.settings = settings;
	}

	onDataUpdate(cb: DataCallback): () => void {
		this.callbacks.push(cb);
		return () => {
			this.callbacks = this.callbacks.filter((candidate) => candidate !== cb);
		};
	}

	async init(): Promise<void> {
		if (this.closingTask) await this.closingTask;
		this.closed = false;
		this.languageCleanup ??= onLanguageChanged(() => this.refreshSaveNotice());
		await this.findOrCreateFile();
		this.registerFileWatcher();
		await this.load();
	}

	destroy(): void {
		this.closed = true;
		this.languageCleanup?.();
		this.languageCleanup = null;
		this.saveListeners.clear();
		if (this.saveState.status !== 'save-error' && this.saveState.status !== 'recovery-error') { this.saveNotice?.hide(); this.saveNotice = null; }
		this.unregisterFileWatchers();
		if (this.debounceTimer) {
			window.clearTimeout(this.debounceTimer);
		}
		if (this.deferredWriteTimer) {
			window.clearTimeout(this.deferredWriteTimer);
		}
	}

	/** Detach the vault modify/rename watchers. Called on destroy and before
	    re-pointing the engine at another workspace file (switchFile). */
	private unregisterFileWatchers(): void {
		if (this.eventRef) {
			this.app.vault.offref(this.eventRef);
			this.eventRef = null;
		}
		if (this.renameEventRef) {
			this.app.vault.offref(this.renameEventRef);
			this.renameEventRef = null;
		}
	}

	getData(): DashboardData | null {
		return this.data;
	}

	async refresh(): Promise<void> {
		await this.load();
	}

	/**
	 * Re-acquire the dashboard file reference and reload its contents from disk,
	 * then notify listeners (which re-renders the view). Used by the backup
	 * restore flow: the file may have been deleted/recreated, so the cached
	 * `this.file` can be stale and must be resolved again before reading.
	 */
	async reloadFromDisk(): Promise<void> {
		this.assertOpen();
		if (this.deferredWriteTimer !== null) { window.clearTimeout(this.deferredWriteTimer); this.deferredWriteTimer = null; }
		this.writeQueuePending++;
		const task = this.writeQueue.then(async () => {
			try {
				const revision = this.localRevision;
				const file = this.file && this.app.vault.getFileByPath(this.file.path);
				if (!file) throw new DashboardSaveError('saveFailed', t('dashboard.sync.sourceMissing'));
				const remote = await this.app.vault.read(file);
				if (revision !== this.localRevision) throw new DashboardSaveError('changed', t('dashboard.sync.changed'));
				if (this.localDirty) {
					this.conflict ??= { id: crypto.randomUUID(), path: file.path, base: this.baseline ?? '', local: this.getLocalDraft(), candidate: this.getLocalDraft(), remote };
					this.blocked = true;
					await this.saveConflict(this.getLocalDraft(), revision);
				}
				if (revision !== this.localRevision) throw new DashboardSaveError('changed', t('dashboard.sync.changed'));
				if (this.debounceTimer !== null) window.clearTimeout(this.debounceTimer);
				this.debounceTimer = null;
				this.file = file; this.baseline = remote; this.data = parse(remote);
				this.blocked = false; this.localDirty = false; this.conflict = null; this.recoveryRevision = 0;
				this.setSaveState('saved'); this.notifyCallbacks('external');
			} catch (error) { throw this.saveFailure(error); }
			finally { this.writeQueuePending--; }
		});
		this.writeQueue = task.catch(() => undefined);
		await task;
	}

	/**
	 * Re-point this engine at `settings.dashboardFile` after a workspace switch
	 * (unlike reloadFromDisk, which keeps watching the same file).
	 *
	 * Order matters: each queued write captures its file and data. Drain it
	 * before replacing the current file and baseline. The pending
	 * deferred (quiet collapse) write is flushed into the queue first, not
	 * dropped. The modify watcher closure-captures the watched path, so it must
	 * be re-registered against the new file. `this.data` is nulled before
	 * loading to defeat load()'s serialize-equality skip — two workspaces with
	 * byte-identical content (e.g. two fresh defaults) must still re-render.
	 */
	async switchFile(): Promise<void> {
		if (this.deferredWriteTimer) {
			window.clearTimeout(this.deferredWriteTimer);
			this.deferredWriteTimer = null;
			if (this.data) await this.writeToDisk(true);
		}
		if (this.debounceTimer) {
			window.clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
		await this.writeQueue;
		if (this.blocked || this.localDirty) throw new Error(t('dashboard.sync.conflict'));
		this.baseline = null;
		this.unregisterFileWatchers();
		this.data = null;
		await this.findOrCreateFile();
		this.registerFileWatcher();
		await this.load();
	}

	private mapCardTasks(
		data: DashboardData,
		cardId: string,
		transform: (tasks: TaskItem[]) => TaskItem[],
	): DashboardData {
		return {
			...data,
			columns: data.columns.map((col) => ({
				...col,
				cards: col.cards.map((card) => (card.id === cardId ? { ...card, tasks: transform(card.tasks) } : card)),
			})),
		};
	}

	private mapCardDocs(data: DashboardData, cardId: string, transform: (docs: DocNode[]) => DocNode[]): DashboardData {
		return {
			...data,
			columns: data.columns.map((col) => ({
				...col,
				cards: col.cards.map((card) => (card.id === cardId ? { ...card, docs: transform(card.docs) } : card)),
			})),
		};
	}

	async archiveTasks(columnName: string): Promise<void> {
		this.assertOpen();
		if (!this.data) return;

		this.data = {
			...this.data,
			columns: this.data.columns.map((col) => {
				if (col.name !== columnName) return col;
				return {
					...col,
					cards: col.cards.map((card) => {
						const { archived, remaining } = archiveCompleted(card.tasks);
						return archived.length === 0 ? card : { ...card, tasks: remaining };
					}),
				};
			}),
		};
		await this.writeToDisk();
	}

	async toggleTask(cardId: string, taskPath: TaskPath, checked: boolean): Promise<void> {
		this.assertOpen();
		if (!this.data) return;

		this.data = this.mapCardTasks(this.data, cardId, (tasks) => {
			let next = updateTaskAt(tasks, taskPath, (t) => {
				if (t.children && t.children.length > 0) {
					return { ...t, checked, children: t.children.map((c) => ({ ...c, checked })) };
				}
				return { ...t, checked };
			});

			for (let depth = taskPath.length - 1; depth > 0; depth--) {
				next = updateTaskAt(next, taskPath.slice(0, depth), recalcChecked);
			}

			if (checked && taskPath.length === 1) {
				const target = next[taskPath[0]!];
				if (target) {
					const without = removeTaskAt(next, taskPath).tasks;
					next = [...without, target];
				}
			}

			return next;
		});
		await this.writeToDisk();
	}

	async reorderTask(cardId: string, fromPath: TaskPath, toPath: TaskPath, before: boolean): Promise<void> {
		this.assertOpen();
		if (!this.data) return;

		this.data = this.mapCardTasks(this.data, cardId, (tasks) => moveTaskBeside(tasks, fromPath, toPath, before));
		await this.writeToDisk();
	}

	async moveTaskToCard(
		srcCardId: string,
		fromPath: TaskPath,
		destCardId: string,
		destPath: TaskPath,
		mode: TaskDropMode,
	): Promise<void> {
		this.assertOpen();
		if (!this.data) return;

		let movedTask: TaskItem | undefined;

		const columnsWithout = this.data.columns.map((col) => ({
			...col,
			cards: col.cards.map((card) => {
				if (card.id !== srcCardId) return card;
				const { removed, tasks } = removeTaskAt(card.tasks, fromPath);
				movedTask = removed;
				return { ...card, tasks };
			}),
		}));

		if (!movedTask) return;

		// Preserve the moved task's entire subtree. Previously the children were
		// stripped for 'before'/'after' drops, which silently deleted all sub-items
		// when a parent task was moved to another card.
		const node: TaskItem = { ...movedTask };

		this.data = {
			...this.data,
			columns: columnsWithout.map((col) => ({
				...col,
				cards: col.cards.map((card) => {
					if (card.id !== destCardId) return card;
					let tasks: TaskItem[];
					if (mode === 'nest') {
						tasks = appendChild(card.tasks, destPath, node);
					} else {
						tasks = insertSibling(card.tasks, destPath, node, mode === 'before');
					}
					return { ...card, tasks };
				}),
			})),
		};
		await this.writeToDisk();
	}

	async editTask(cardId: string, taskPath: TaskPath, newText: string): Promise<void> {
		this.assertOpen();
		if (!this.data || !newText) return;

		this.data = this.mapCardTasks(this.data, cardId, (tasks) =>
			updateTaskAt(tasks, taskPath, (t) => ({ ...t, text: newText })),
		);
		await this.writeToDisk();
	}

	async addTask(cardId: string, text: string, parentPath?: TaskPath): Promise<void> {
		this.assertOpen();
		if (!this.data || !text.trim()) return;

		const node: TaskItem = { text: text.trim(), checked: false, id: crypto.randomUUID() };
		this.data = this.mapCardTasks(this.data, cardId, (tasks) =>
			parentPath && parentPath.length > 0
				? appendChild(tasks, parentPath, node)
				: // Top-level additions land at the TOP of the list so the newest
					// item is visible without scrolling past the existing ones.
					[node, ...tasks],
		);
		await this.writeToDisk();
	}

	async deleteTask(cardId: string, taskPath: TaskPath): Promise<void> {
		this.assertOpen();
		if (!this.data) return;

		this.data = this.mapCardTasks(this.data, cardId, (tasks) => removeTaskAt(tasks, taskPath).tasks);
		await this.writeToDisk();
	}

	async nestTask(cardId: string, taskPath: TaskPath): Promise<void> {
		this.assertOpen();
		if (!this.data) return;

		this.data = this.mapCardTasks(this.data, cardId, (tasks) => demoteToChild(tasks, taskPath));
		await this.writeToDisk();
	}

	async nestTaskInto(cardId: string, srcPath: TaskPath, destPath: TaskPath): Promise<void> {
		this.assertOpen();
		if (!this.data) return;

		this.data = this.mapCardTasks(this.data, cardId, (tasks) => nestIntoTarget(tasks, srcPath, destPath));
		await this.writeToDisk();
	}

	async unnestTask(cardId: string, taskPath: TaskPath): Promise<void> {
		this.assertOpen();
		if (!this.data) return;

		this.data = this.mapCardTasks(this.data, cardId, (tasks) => promoteToTopLevel(tasks, taskPath));
		await this.writeToDisk();
	}

	/**
	 * Toggle a task's collapsed state WITHOUT triggering a full re-render.
	 *
	 * Collapse is a purely visual state — the chevron click should update the DOM
	 * in place (handled by the renderer) and persist to disk on a debounce, but
	 * must not echo back through `notifyCallbacks`, which would tear down and
	 * rebuild the entire dashboard for a single chevron toggle.
	 */
	toggleCollapseTaskQuiet(cardId: string, taskPath: TaskPath): void {
		this.assertOpen();
		if (!this.data) return;

		this.data = this.mapCardTasks(this.data, cardId, (tasks) =>
			updateTaskAt(tasks, taskPath, (t) => ({ ...t, collapsed: !t.collapsed })),
		);
		this.scheduleDeferredWrite();
	}

	async updateCard(
		cardId: string,
		updates: Partial<
			Pick<
				DashboardCard,
				| 'title'
				| 'body'
				| 'docs'
				| 'dueDate'
				| 'color'
				| 'coverImage'
				| 'coverPos'
				| 'width'
				| 'size'
				| 'gridCols'
				| 'gridRows'
				| 'gridCol'
				| 'gridRow'
			>
		>,
	): Promise<void> {
		this.assertOpen();
		if (!this.data) return;

		this.data = {
			...this.data,
			columns: this.data.columns.map((col) => ({
				...col,
				cards: col.cards.map((card) => (card.id === cardId ? { ...card, ...updates } : card)),
			})),
		};
		await this.writeToDisk();
	}

	async editTaskReminder(cardId: string, taskPath: TaskPath, reminder: string | undefined): Promise<void> {
		this.assertOpen();
		if (!this.data) return;

		this.data = this.mapCardTasks(this.data, cardId, (tasks) =>
			updateTaskAt(tasks, taskPath, (t) => ({ ...t, reminder })),
		);
		await this.writeToDisk();
	}

	async taskAutomationSource(
		cardId: string,
		taskPath: TaskPath,
	): Promise<{ id: string; path: string; title: string }> {
		this.assertOpen();
		if (!this.data || !this.file) throw new Error(t('automation.sourceMissing'));
		const card = this.data.columns.flatMap((c) => c.cards).find((c) => c.id === cardId);
		const task = card ? getTaskByPath(card.tasks, taskPath) : undefined;
		if (!task) throw new Error(t('automation.sourceMissing'));
		const id = task.id ?? crypto.randomUUID();
		if (!task.id) {
			this.data = this.mapCardTasks(this.data, cardId, (tasks) =>
				updateTaskAt(tasks, taskPath, (t) => ({ ...t, id })),
			);
			await this.writeToDisk();
		}
		return { id, path: this.file.path, title: task.text };
	}

	async deleteCard(cardId: string): Promise<void> {
		this.assertOpen();
		if (!this.data) return;

		this.data = {
			...this.data,
			columns: this.data.columns.map((col) => ({
				...col,
				cards: col.cards.filter((c) => c.id !== cardId),
			})),
		};
		await this.writeToDisk();
	}

	async addCard(columnName: string, overrides?: Partial<DashboardCard>): Promise<void> {
		this.assertOpen();
		if (!this.data) return;
		const column = this.data.columns.find((col) => col.name === columnName);
		const sectionType = column?.sectionType;
		const cardTitle = overrides?.title ?? this.getDefaultCardTitle(columnName, sectionType);
		const cardType = overrides?.type ?? this.getDefaultCardType(columnName, sectionType);

		const newCard: DashboardCard = {
			id: `card-${Date.now().toString(36)}`,
			title: cardTitle,
			type: cardType,
			column: columnName,
			body: '',
			tasks: cardType === 'task' ? [{ text: t('sync.todoDefaultTask'), checked: false }] : [],
			docs: [],
			url: '',
			wikiLink: '',
			progress: -1,
			streak: 0,
			dueDate: '',
			blockquote: '',
			color: '',
			coverImage: '',
			width: 0,
			size: 'M' as const,
			gridCols: 0,
			gridRows: 0,
			gridCol: 0,
			gridRow: 0,
			...overrides,
		};

		this.data = {
			...this.data,
			columns: this.data.columns.map((col) =>
				col.name === columnName ? { ...col, cards: [...col.cards, newCard] } : col,
			),
		};
		await this.writeToDisk();
	}

	async addColumn(name: string, sectionType?: string): Promise<void> {
		this.assertOpen();
		if (!this.data) return;
		const uniqueName = this.uniqueColumnName(name);

		// New library sections start unfiltered: a default date window would
		// silently narrow results long after creation and read like a filter
		// bug, so the quick filter stays opt-in via the funnel button.
		const libraryConfig =
			sectionType === 'library'
				? {
						filters: [] as import('../../core/board/types/index').PropertyFilter[],
						viewMode: 'grid' as import('../../core/board/types/index').LibraryViewMode,
						sortBy: 'modified',
						sortDesc: true,
					}
				: undefined;

		this.data = {
			...this.data,
			columns: [
				...this.data.columns,
				{ name: uniqueName, color: '#6366f1', sectionType, cards: [], libraryConfig },
			],
		};
		await this.writeToDisk();
	}

	async updateLibraryConfig(
		columnName: string,
		config: import('../../core/board/types/index').LibraryConfig,
	): Promise<void> {
		this.assertOpen();
		if (!this.data) return;

		this.data = {
			...this.data,
			columns: this.data.columns.map((col) =>
				col.name === columnName ? { ...col, libraryConfig: config } : col,
			),
		};
		await this.writeToDisk();
	}

	async updatePipelineConfig(columnName: string, config: import('../../core/board/types/model').PipelineConfig): Promise<void> {
		this.assertOpen();
		if (!this.data) return;
		this.data = { ...this.data, columns: this.data.columns.map(column => column.name === columnName ? { ...column, pipelineConfig: config } : column) };
		await this.writeToDisk();
	}

	async updateWereadConfig(
		columnName: string,
		config: import('../../core/board/types/index').WereadConfig,
	): Promise<void> {
		this.assertOpen();
		if (!this.data) return;

		this.data = {
			...this.data,
			columns: this.data.columns.map((col) => (col.name === columnName ? { ...col, wereadConfig: config } : col)),
		};
		await this.writeToDisk();
	}

	async updateDataviewConfig(
		columnName: string,
		config: import('../../core/board/types/index').DataviewConfig,
	): Promise<void> {
		this.assertOpen();
		if (!this.data) return;

		this.data = {
			...this.data,
			columns: this.data.columns.map((col) =>
				col.name === columnName ? { ...col, dataviewConfig: config } : col,
			),
		};
		await this.writeToDisk();
	}

	async updateWebConfig(
		columnName: string,
		config: import('../../core/board/types/index').WebEmbedConfig,
	): Promise<void> {
		this.assertOpen();
		if (!this.data) return;

		this.data = {
			...this.data,
			columns: this.data.columns.map((col) => (col.name === columnName ? { ...col, webConfig: config } : col)),
		};
		await this.writeToDisk();
	}

	/** Reorder sections by array index (index-based to avoid name collisions).
	 *  Vertical drop = "own full-width row": a moved section loses any pairing
	 *  and never lands between two partners (see moveToOwnRow). from === to is
	 *  legal — it unpairs the section in place. */
	async moveColumn(fromIndex: number, toIndex: number): Promise<void> {
		this.assertOpen();
		if (!this.data) return;
		const cols = this.data.columns;
		if (fromIndex < 0 || fromIndex >= cols.length || toIndex < 0 || toIndex >= cols.length) return;
		const candidate = { ...this.data, columns: moveToOwnRow(cols, fromIndex, toIndex) };
		// No-op drops (e.g. vertical drop that lands where it started on an
		// unpaired section) must not burn a backup file and re-render the board.
		if (serialize(candidate) === serialize(this.data)) return;
		this.data = candidate;
		await this.writeToDisk();
	}

	/** Pair the dragged section beside the target (`side` of the target row).
	 *  The target's ex-partner, if any, falls back to a full-width row. */
	async moveColumnBeside(fromIndex: number, targetIndex: number, side: 'left' | 'right'): Promise<void> {
		this.assertOpen();
		if (!this.data) return;
		const candidate = { ...this.data, columns: moveBeside(this.data.columns, fromIndex, targetIndex, side) };
		if (serialize(candidate) === serialize(this.data)) return;
		this.data = candidate;
		await this.writeToDisk();
	}

	/** Persist a user-dragged section height (px), desktop only. */
	async updateColumnHeight(columnName: string, height: number): Promise<void> {
		this.assertOpen();
		if (!this.data) return;
		this.data = {
			...this.data,
			columns: this.data.columns.map((col) => (col.name === columnName ? { ...col, height } : col)),
		};
		await this.writeToDisk();
	}

	/** Persist a dragged pair-divider split: the left member's share in
	 *  percent (clamped 20-80). Desktop only. */
	async updateColumnWidth(columnName: string, widthPct: number): Promise<void> {
		this.assertOpen();
		if (!this.data) return;
		const pct = Math.max(20, Math.min(80, Math.round(widthPct)));
		this.data = {
			...this.data,
			columns: this.data.columns.map((col) => (col.name === columnName ? { ...col, width: pct } : col)),
		};
		await this.writeToDisk();
	}

	/** Resolve a column to a single index. Prefers the UI-provided index (the
	 *  exact section the user clicked) when its name still matches — with
	 *  duplicate names that targets only THIS section — and falls back to the
	 *  first name match. The name guard rejects stale indexes from an
	 *  out-of-date render. */
	private resolveColumnIndex(columnName: string, columnIndex?: number): number {
		if (!this.data) return -1;
		const idx = typeof columnIndex === 'number' ? columnIndex : -1;
		if (idx >= 0 && idx < this.data.columns.length && this.data.columns[idx]!.name === columnName) {
			return idx;
		}
		return this.data.columns.findIndex((col) => col.name === columnName);
	}

	/** Names are the column key in the markdown format (## heading), so
	 *  duplicates break every name-keyed operation (delete/rename used to hit
	 *  ALL same-named sections). Creation and rename therefore always resolve
	 *  to a unique name. `exceptIndex` exempts the column being renamed. */
	private uniqueColumnName(base: string, exceptIndex?: number): string {
		if (!this.data) return base;
		const taken = new Set(this.data.columns.filter((_, i) => i !== exceptIndex).map((col) => col.name));
		if (!taken.has(base)) return base;
		for (let n = 2; ; n++) {
			const candidate = `${base} ${n}`;
			if (!taken.has(candidate)) return candidate;
		}
	}

	async renameColumn(oldName: string, newName: string, columnIndex?: number): Promise<void> {
		this.assertOpen();
		const trimmed = newName.trim();
		if (!this.data || !trimmed || oldName === trimmed) return;
		const idx = this.resolveColumnIndex(oldName, columnIndex);
		if (idx < 0) return;

		const uniqueNew = this.uniqueColumnName(trimmed, idx);
		this.data = {
			...this.data,
			columns: this.data.columns.map((col, i) => (i === idx ? { ...col, name: uniqueNew } : col)),
		};
		await this.writeToDisk();
	}

	async deleteColumn(columnName: string, columnIndex?: number): Promise<void> {
		this.assertOpen();
		if (!this.data) return;
		const idx = this.resolveColumnIndex(columnName, columnIndex);
		if (idx < 0) return;
		// Free the deleted section's partner first so it falls back to a full
		// width row instead of lingering as an orphan half.
		this.data = {
			...this.data,
			columns: unpartnerAt(this.data.columns, idx).filter((_, i) => i !== idx),
		};
		await this.writeToDisk();
	}

	async moveCard(cardId: string, targetColumn: string, targetIndex: number): Promise<void> {
		this.assertOpen();
		if (!this.data) return;

		const next = moveDashboardCard(this.data, cardId, targetColumn, targetIndex);
		if (next === this.data) return;
		this.data = next;
		await this.writeToDisk();
	}

	async updateBanner(updates: Partial<BannerData>): Promise<void> {
		this.assertOpen();
		if (!this.data) return;
		this.data = {
			...this.data,
			banner: { ...this.data.banner, ...updates },
		};
		await this.writeToDisk();
	}

	async addQuickAction(action: QuickAction): Promise<void> {
		this.assertOpen();
		if (!this.data) return;
		this.data = {
			...this.data,
			quickActions: [...this.data.quickActions, action],
		};
		await this.writeToDisk();
	}

	async removeQuickAction(index: number): Promise<void> {
		this.assertOpen();
		if (!this.data) return;
		this.data = {
			...this.data,
			quickActions: this.data.quickActions.filter((_, i) => i !== index),
		};
		await this.writeToDisk();
	}

	async updateQuickAction(index: number, updates: Partial<Pick<QuickAction, 'name' | 'icon'>>): Promise<void> {
		this.assertOpen();
		if (!this.data) return;
		const actions = [...this.data.quickActions];
		if (index < 0 || index >= actions.length) return;
		actions[index] = { ...actions[index]!, ...updates };
		this.data = {
			...this.data,
			quickActions: actions,
		};
		await this.writeToDisk();
	}

	async reorderQuickActions(order: string[]): Promise<void> {
		this.assertOpen();
		if (!this.data) return;
		this.data = {
			...this.data,
			quickActionOrder: order,
		};
		await this.writeToDisk();
	}

	async removeQuickActionByKey(key: string): Promise<void> {
		this.assertOpen();
		if (!this.data) return;
		if (key.startsWith('p:')) {
			// Preset: add to hiddenPresets and remove from order
			const hidden = [...(this.data.hiddenPresets ?? [])];
			if (!hidden.includes(key)) hidden.push(key);
			this.data = {
				...this.data,
				hiddenPresets: hidden,
				quickActionOrder: (this.data.quickActionOrder ?? []).filter((k) => k !== key),
			};
		} else {
			// Custom: remove from quickActions[] and order
			const target = key.slice(2);
			this.data = {
				...this.data,
				quickActions: this.data.quickActions.filter((a) => a.target !== target),
				quickActionOrder: (this.data.quickActionOrder ?? []).filter((k) => k !== key),
			};
		}
		await this.writeToDisk();
	}

	async updateMemoCard(
		cardId: string,
		updates: Pick<DashboardCard, 'body' | 'blockquote'> &
			Partial<Pick<DashboardCard, 'tasks' | 'docs' | 'wikiLink' | 'url' | 'type'>>,
	): Promise<void> {
		this.assertOpen();
		if (!this.data) return;

		this.data = {
			...this.data,
			columns: this.data.columns.map((col) => ({
				...col,
				cards: col.cards.map((card) => (card.id === cardId ? { ...card, ...updates } : card)),
			})),
		};
		await this.writeToDisk();
	}

	async reorderDocs(cardId: string, fromPath: DocPath, toPath: DocPath, before: boolean): Promise<void> {
		this.assertOpen();
		if (!this.data) return;

		this.data = this.mapCardDocs(this.data, cardId, (docs) => moveDocBeside(docs, fromPath, toPath, before));
		await this.writeToDisk();
	}

	async moveDocToCard(
		srcCardId: string,
		fromPath: DocPath,
		destCardId: string,
		destPath: DocPath,
		mode: TaskDropMode,
	): Promise<void> {
		this.assertOpen();
		if (!this.data) return;

		let movedDoc: DocNode | undefined;

		const columnsWithout = this.data.columns.map((col) => ({
			...col,
			cards: col.cards.map((card) => {
				if (card.id !== srcCardId) return card;
				const { removed, docs } = removeDocAt(card.docs, fromPath);
				movedDoc = removed;
				return { ...card, docs };
			}),
		}));

		if (!movedDoc) return;

		// Preserve the moved doc's entire subtree (same rationale as moveTaskToCard).
		const node: DocNode = { ...movedDoc };

		this.data = {
			...this.data,
			columns: columnsWithout.map((col) => ({
				...col,
				cards: col.cards.map((card) => {
					if (card.id !== destCardId) return card;
					let docs: DocNode[];
					if (mode === 'nest') {
						docs = appendDocChild(card.docs, destPath, node);
					} else {
						docs = insertDocSibling(card.docs, destPath, node, mode === 'before');
					}
					return { ...card, docs };
				}),
			})),
		};
		await this.writeToDisk();
	}

	async nestDoc(cardId: string, docPath: DocPath): Promise<void> {
		this.assertOpen();
		if (!this.data) return;

		this.data = this.mapCardDocs(this.data, cardId, (docs) => demoteDocToChild(docs, docPath));
		await this.writeToDisk();
	}

	toggleCollapseDocQuiet(cardId: string, docPath: DocPath): void {
		this.assertOpen();
		if (!this.data) return;

		this.data = this.mapCardDocs(this.data, cardId, (docs) =>
			updateDocAt(docs, docPath, (d) => ({ ...d, collapsed: !d.collapsed })),
		);
		this.scheduleDeferredWrite();
	}

	async deleteDoc(cardId: string, docPath: DocPath): Promise<void> {
		this.assertOpen();
		if (!this.data) return;

		this.data = this.mapCardDocs(this.data, cardId, (docs) => removeDocAt(docs, docPath).docs);
		await this.writeToDisk();
	}

	async addDocToCard(cardId: string, filePath: string): Promise<void> {
		this.assertOpen();
		if (!this.data) return;

		this.data = this.mapCardDocs(this.data, cardId, (docs) =>
			docs.some((d) => d.path === filePath) ? docs : [...docs, { path: filePath }],
		);
		await this.writeToDisk();
	}

	async addFileLinkToMemo(cardId: string, filePath: string): Promise<void> {
		this.assertOpen();
		if (!this.data) return;

		this.data = {
			...this.data,
			columns: this.data.columns.map((col) => ({
				...col,
				cards: col.cards.map((card) => {
					if (card.id !== cardId) return card;
					const link = `[[${filePath}]]`;
					if (card.body.includes(link)) return card;
					const body = card.body ? `${card.body}\n${link}` : link;
					return { ...card, body };
				}),
			})),
		};
		await this.writeToDisk();
	}

	async updateMemoColor(cardId: string, color: string): Promise<void> {
		this.assertOpen();
		await this.updateCard(cardId, { color });
	}

	async updateCardWidth(cardId: string, width: number): Promise<void> {
		this.assertOpen();
		await this.updateCard(cardId, { width });
	}

	async updateCardSize(cardId: string, size: import('../../core/board/types/index').CardSize): Promise<void> {
		this.assertOpen();
		await this.updateCard(cardId, { size });
	}

	/** Skills belong to this board's visible Markdown, not global provider settings. */
	async setBoardSkills(skills: readonly import('../../core/board/types/model').SkillShortcut[]): Promise<void> {
		this.assertOpen();
		if (!this.data) return;
		this.data = { ...this.data, skills: skills.map(skill => ({ ...skill, destination: { ...skill.destination } })) };
		await this.writeToDisk();
	}

	/** Explicit grid edits save every displaced tile in one board write. */
	async setBoardTiles(tiles: readonly BoardTile[]): Promise<void> {
		this.assertOpen();
		if (!this.data) return;
		if (JSON.stringify(this.data.immersive) === JSON.stringify(tiles)) return;
		this.data = { ...this.data, immersive: tiles.map(tile => ({ ...tile })) };
		this.materializeBoard(false);
		this.data.layoutNeedsRepair = undefined;
		await this.writeToDisk();
	}

	/** User layout choice. Packing runs here, never on open, content fit or resize. */
	async setBoardLayout(layout: BoardLayout): Promise<void> {
		this.assertOpen();
		if (!this.data || this.data.layout === layout) return;
		this.materializeBoard(layout === 'immersive');
		this.data = { ...this.data, layout };
		await this.writeToDisk();
	}

	/** Member edits affect this board only. Provider instance configuration is never deleted here. */
	async setBoardMembers(members: readonly BoardWidgetMember[]): Promise<void> {
		this.assertOpen();
		if (!this.data) return;
		const previous = this.data.widgets ?? legacyBoardMembers(this.settings, effectiveBoardLayout(this.data.layout, this.settings.layoutMode) !== 'side');
		const kept = new Set(members.map(member => member.memberId));
		const removed = new Set(previous.filter(member => !kept.has(member.memberId)).map(member => member.memberId));
		this.data = { ...this.data, widgets: members.map(member => ({ ...member })), immersive: this.data.immersive?.filter(tile => !removed.has(tile.id)) };
		this.materializeBoard(this.data.layout === 'immersive');
		await this.writeToDisk();
	}

	private materializeBoard(grid: boolean): void {
		const legacy = this.data!.widgets === undefined;
		const widgets = this.data!.widgets ?? legacyBoardMembers(this.settings, effectiveBoardLayout(this.data!.layout, this.settings.layoutMode) !== 'side');
		this.data = withStableSectionIds({ ...this.data!, widgets }, () => `section-${crypto.randomUUID()}`);
		if (grid) {
			// A cap is not measured content height. Existing fit tiles may have adjacent
			// positions inside each other's caps; adding a member must not move them.
			this.data.immersive = persistedBoardTiles(boardTiles(this.data, boardTileSources(this.data, widgets), member => this.widgetDefaults(member, legacy)), true);
			this.data.layoutNeedsRepair = undefined;
		}
	}

	async updateProjectCover(cardId: string, coverImage: string): Promise<void> {
		this.assertOpen();
		await this.updateCard(cardId, { coverImage });
	}

	async replaceData(newData: DashboardData): Promise<void> {
		this.assertOpen();
		this.data = newData;
		await this.writeToDisk();
	}

	private getDefaultCardTitle(columnName: string, sectionType?: string): string {
		const effective = sectionType?.toLowerCase();
		if (effective === 'memo' || effective === 'sticky' || (!effective && columnName.toLowerCase() === 'memo')) {
			const now = new Date();
			const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
			return t('sync.memoTitle', { date });
		}
		if (effective === 'todo' || (!effective && columnName.toLowerCase() === 'todo')) return t('sync.todoTitle');
		if (effective === 'notes') return t('sync.notesTitle');
		if (columnName.toLowerCase() === 'projects') return t('sync.projectTitle');
		return t('sync.newCard');
	}

	private getDefaultCardType(columnName: string, sectionType?: string): CardType {
		const effective = sectionType?.toLowerCase();
		if (effective === 'todo' || (!effective && columnName.toLowerCase() === 'todo')) return 'task';
		if (effective === 'memo' || (!effective && columnName.toLowerCase() === 'memo')) return 'generic';
		// Sticky sections pick the type per card via StickyCardTypeModal; a bare
		// addCard (no overrides) falls back to a memo card.
		if (effective === 'sticky') return 'generic';
		if (effective === 'dashboard' || (!effective && columnName.toLowerCase() === 'dashboard')) return 'weather';
		return 'project';
	}

	private async findOrCreateFile(): Promise<void> {
		const rawPath = this.settings.dashboardFile.trim();
		const path = rawPath.endsWith('.md') ? rawPath : `${rawPath}.md`;
		const existing = this.app.vault.getFileByPath(path);
		if (existing) {
			this.file = existing;
			return;
		}

		const content = generateDefaultMarkdown();
		this.file = await this.app.vault.create(path, content);
	}

	private deferredWriteTimer: number | null = null;
	private renameEventRef: ReturnType<typeof this.app.vault.on> | null = null;
	/** Depth of writes currently queued/executing. `onFileModify` uses this to
	 *  decide whether an external change can be ingested immediately: while our
	 *  own writes are draining, a load() could race them (see onFileModify). */
	private writeQueuePending = 0;

	private registerFileWatcher(): void {
		const filePath = this.file?.path;
		this.eventRef = this.app.vault.on('modify', (file) => {
			if (file instanceof TFile && file.path === filePath) {
				this.onFileModify();
			}
		});

		this.renameEventRef = this.app.vault.on('rename', (file, oldPath: string) => {
			if (!this.data || !(file instanceof TFile || file instanceof TFolder)) return;
			this.handleFileRename(file, oldPath);
		});
	}

	private handleFileRename(file: TFile | TFolder, oldPath: string): void {
		if (!this.data) return;
		const newPath = file.path;
		let changed = false;

		const replace = (str: string): string => {
			const renamed = renamedImagePath(str, oldPath, newPath, file instanceof TFolder);
			if (renamed !== str) changed = true;
			return renamed;
		};

		const oldPathNoExt = oldPath.endsWith('.md') ? oldPath.slice(0, -3) : oldPath;
		const newName = file instanceof TFile ? file.basename : file.name;

		const quickActions = this.data.quickActions.map((action) => {
			if (action.type !== 'file') return action;
			if (action.target !== oldPath && action.target !== oldPathNoExt) return action;
			changed = true;
			return { ...action, target: newPath, name: newName };
		});

		const banner = { ...this.data.banner, image: replace(this.data.banner.image) };
		if (banner.images) banner.images = banner.images.map(replace);
		if (banner.imagePos) banner.imagePos = Object.fromEntries(Object.entries(banner.imagePos).map(([path, value]) => [replace(path), value]));

		const columns = this.data.columns.map((col) => ({
			...col,
			cards: col.cards.map((card) => ({
				...card,
				coverImage: replace(card.coverImage),
			})),
		}));

		if (!changed) return;

		// Cancel pending re-parse to prevent race condition
		if (this.debounceTimer) {
			window.clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}

		this.data = { ...this.data, banner, quickActions, columns };
		void this.writeToDisk().catch(() => undefined);
	}

	/**
	 * Persist `this.data` to disk on a debounce WITHOUT re-rendering the view.
	 *
	 * Used by the "quiet" collapse toggles (`toggleCollapseTaskQuiet` /
	 * `toggleCollapseDocQuiet`): the renderer has already updated the DOM in
	 * place, so the deferred write only needs to flush the new `collapsed` flag
	 * to disk. The write MUST NOT echo back through `notifyCallbacks`, otherwise
	 * the whole dashboard is torn down and rebuilt a second after every chevron
	 * click — the source of the multi-second lag.
	 */
	private scheduleDeferredWrite(): void {
		this.localRevision++;
		this.localDirty = true;
		this.setSaveState(this.blocked ? 'conflict-pending' : 'saving');
		if (this.deferredWriteTimer) window.clearTimeout(this.deferredWriteTimer);
		this.deferredWriteTimer = window.setTimeout(() => {
			this.deferredWriteTimer = null;
			if (this.data) {
				void this.writeToDisk(true).catch(() => undefined);
			}
		}, 400);
	}

	private onFileModify(): void {
		if (this.debounceTimer) window.clearTimeout(this.debounceTimer);
		if (this.blocked) return;
		if (this.writeQueuePending === 0 && this.deferredWriteTimer === null) {
			void this.load().catch(console.error);
			return;
		}
		this.debounceTimer = window.setTimeout(() => {
			this.debounceTimer = null;
			if (!this.blocked && this.writeQueuePending === 0) void this.load().catch(console.error);
		}, this.debounceMs);
	}

	private async load(): Promise<void> {
		if (
			!this.file ||
			this.blocked ||
			this.localDirty ||
			this.writeQueuePending > 0 ||
			this.deferredWriteTimer !== null
		)
			return;
		const file = this.file;
		const content = await this.app.vault.read(file);
		if (
			this.file !== file ||
			this.blocked ||
			this.localDirty ||
			this.writeQueuePending > 0 ||
			this.deferredWriteTimer !== null
		)
			return;
		this.baseline = content;
		const newData = parse(content);

		// Skip the re-render when the on-disk data is logically equivalent to what
		// we already hold. Our own writes echo back through the file watcher, and a
		// byte-level hash misfires on trivial differences (e.g. trailing newlines),
		// so compare canonical serializations instead — otherwise the whole view
		// rebuilds a second time (the visible "double flash").
		if (this.data && serialize(newData) === serialize(this.data)) return;

		this.data = newData;
		this.notifyCallbacks('external');
	}

	/**
	 * Serialize `this.data` to the dashboard file.
	 *
	 * `silent=true` skips `notifyCallbacks` — for collapse toggles whose DOM is
	 * already updated in place and only need the new state flushed to disk,
	 * without triggering a full-board re-render.
	 */
	private async writeToDisk(silent = false): Promise<void> {
		if (!this.data || !this.file) return;
		this.localDirty = true;
		const fileRef = this.file, content = serialize(this.data), revision = ++this.localRevision;
		this.setSaveState(this.blocked ? 'conflict-pending' : 'saving');
		this.writeQueuePending++;
		const task = this.writeQueue.then(async () => {
			try {
				if (this.blocked) {
					await this.saveConflict(content, revision);
					throw new DashboardSaveError('conflict', dashboardSaveMessage(this.saveState));
				}
				const base = this.baseline;
				if (base === null) throw new DashboardSaveError('saveFailed', t('dashboard.sync.sourceMissing'));
				await this.createBackup(base);
				let remote = base, conflict = false;
				try {
					await this.app.vault.process(fileRef, current => {
						remote = current;
						if (current !== base) { conflict = true; throw new DashboardSaveError('conflict', t('dashboard.sync.conflictPending')); }
						return content;
					});
				} catch (error) {
					if (conflict) {
						this.blocked = true;
						this.conflict = { id: crypto.randomUUID(), path: fileRef.path, base, local: content, candidate: content, remote };
						await this.saveConflict(content, revision);
					}
					throw error;
				}
				this.baseline = content;
				if (revision === this.localRevision) { this.localDirty = false; this.setSaveState('saved'); }
			} catch (error) { throw this.saveFailure(error); }
			finally { this.writeQueuePending--; }
		});
		// Only the internal queue observes rejection here. Public operations still reject.
		this.writeQueue = task.catch(() => undefined);
		if (!silent) this.notifyCallbacks('local');
		await task;
	}

	/** Called only inside the ordered write/reload queue, with an immutable revision snapshot. */
	private async saveConflict(local: string, revision: number): Promise<void> {
		const conflict = this.conflict;
		if (!conflict) throw new DashboardSaveError('recoveryFailed', t('dashboard.sync.recoveryFailed'));
		this.setSaveState('conflict-pending');
		const record = { ...conflict, local, revision };
		const adapter = privateVaultStorage(this.app);
		await ensureDirectory(adapter, DASHBOARD_CONFLICT_DIR);
		await adapter.write(DASHBOARD_CONFLICT_DIR + '/' + conflict.id + '.json', JSON.stringify(record, null, 2));
		this.conflict = record;
		this.recoveryRevision = revision;
		this.setSaveState(revision === this.localRevision ? 'conflict-saved' : 'conflict-pending');
	}

	private async createBackup(currentContent: string): Promise<void> {
		const adapter = this.app.vault.adapter;
		const dir = SyncEngine.BACKUP_DIR;
		const storage = privateVaultStorage(this.app);
		await ensureDirectory(storage, dir);

		// Keyed per workspace: each board keeps its own rolling copies and
		// prunes only its own files (dot separator so 'dashboard.' never
		// matches 'dashboard-2.<ts>.md').
		const base = this.file?.basename ?? 'dashboard';
		const ts = new Date().toISOString().replace(/[:.]/g, '-');
		const backupPath = `${dir}/${workspaceBackupName(base, ts)}`;
		await storage.write(backupPath, currentContent);

		// Prune old backups, keep only MAX_BACKUPS
		const files = await adapter.list(dir);
		const backups = files.files
			.filter((f: string) => f.startsWith(dir + '/' + base + '.') && f.endsWith('.md'))
			.sort();
		while (backups.length > SyncEngine.MAX_BACKUPS) {
			await adapter.remove(backups.shift()!);
		}
	}

	private notifyCallbacks(source: DashboardUpdateSource): void {
		if (!this.data) return;
		for (const cb of this.callbacks) {
			cb(this.data, source);
		}
	}
}
