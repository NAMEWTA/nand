import { Notice, type App } from 'obsidian';
import { t } from '../../../shared/i18n/index';
import { generateDefaultMarkdown } from '../core/board/parser/default-document';
import {
	alignWorkspaceNames,
	nextWorkspacePath,
	normalizeWorkspacePath,
	pruneMissingWorkspaces,
} from '../core/workspace/workspace-registry';
import type { DashboardSettings } from '../core/board/types/model';
import { parse, serialize } from '../core/board/parser/parse';
import { withStableSectionIds } from '../core/board/section-identity';
import type { BoardOperations } from '../api';
import { contentFiles } from '../../../host/obsidian/storage/content-files';

type Registry = Pick<DashboardSettings, 'workspaceFiles' | 'workspaceNames' | 'dashboardFile'>;

export interface BoardRegistryHost {
	readonly app: App;
	/** Current registry fields. */
	read(): Registry;
	settings?(): DashboardSettings;
	/** Replace registry fields and persist them. */
	write(next: Registry): Promise<void>;
	/** Re-point every open board at the active file (serial, drains each board's queued writes first). */
	repointAll(): Promise<void>;
	/** Re-render open boards without reloading files (labels and order changed). */
	refreshAll(): void;
}

/**
 * Multi-board registry: which board files exist, their display names and the active one.
 * Mutations are serialized so rapid clicks or a vault rename racing a switch never interleave.
 */
export class BoardRegistry implements BoardOperations {
	private operations: Promise<void> = Promise.resolve();

	constructor(private readonly host: BoardRegistryHost) {}

	/** Startup may have completed a move before any module subscribed to content events. */
	async recoverMoves(): Promise<void> {
		const files = contentFiles(this.host.app);
		for (const registered of [...this.host.read().workspaceFiles]) {
			const source = registered.endsWith('.md') ? registered : registered + '.md';
			const target = files.resolveLink(source);
			if (target && target.path !== source) await this.followRename(target, source);
		}
	}

	/** Follow renames and deletions of board files in the vault. */
	watch(register: (dispose: () => void) => void): void {
		register(
			contentFiles(this.host.app).subscribe((event) => {
				if (!event.path.endsWith('.md')) return;
				if (event.kind === 'rename') void this.run(() => this.followRename(event, event.oldPath!));
				if (event.kind === 'delete') void this.run(() => this.followDelete(event));
			}),
		);
	}

	switch(path: string): Promise<void> {
		return this.run(async () => {
			const registry = this.host.read();
			const target = normalizeWorkspacePath(path);
			if (!target || target === normalizeWorkspacePath(registry.dashboardFile)) return;
			if (!registry.workspaceFiles.includes(target)) return;
			// Persist before re-pointing boards: a crash mid-switch reopens on the new board.
			await this.host.write({ ...registry, dashboardFile: target });
			await this.host.repointAll();
		});
	}

	create(name: string): Promise<void> {
		return this.run(async () => {
			const registry = this.host.read();
			const trimmed = name.trim();
			const path = nextWorkspacePath(registry.workspaceFiles, trimmed, (p) => this.exists(p));
			try {
				const data = withStableSectionIds(
					parse(generateDefaultMarkdown()),
					() => `section-${crypto.randomUUID()}`,
				);
				await contentFiles(this.host.app).create(path.endsWith('.md') ? path : `${path}.md`, serialize(data));
			} catch (error) {
				console.error('[NAND board] creation failed', error);
				new Notice(t('workspace.createFailed'));
				return;
			}
			const names = alignWorkspaceNames(registry.workspaceFiles, registry.workspaceNames);
			await this.host.write({
				workspaceFiles: [...registry.workspaceFiles, path],
				workspaceNames: [...names, trimmed],
				dashboardFile: path,
			});
			await this.host.repointAll();
			new Notice(t('workspace.created', { name: trimmed || path }));
		});
	}

	/** Change a board's display name only; the file is untouched. */
	async rename(path: string, name: string): Promise<void> {
		const registry = this.host.read();
		const index = registry.workspaceFiles.indexOf(normalizeWorkspacePath(path));
		if (index < 0) return;
		const trimmed = name.trim();
		const names = alignWorkspaceNames(registry.workspaceFiles, registry.workspaceNames);
		if (names[index] === trimmed) return;
		await this.host.write({
			...registry,
			workspaceNames: names.map((value, i) => (i === index ? trimmed : value)),
		});
		this.host.refreshAll();
	}

	/** Unregister a board (its file stays). Removing the active board switches to the first remaining one. */
	remove(path: string): Promise<void> {
		return this.run(async () => {
			const registry = this.host.read();
			const files = registry.workspaceFiles;
			if (files.length <= 1) return;
			const target = normalizeWorkspacePath(path);
			const index = files.indexOf(target);
			if (index < 0) return;
			const names = alignWorkspaceNames(files, registry.workspaceNames);
			const nextFiles = files.filter((_, i) => i !== index);
			await this.host.write({
				workspaceFiles: nextFiles,
				workspaceNames: names.filter((_, i) => i !== index),
				dashboardFile:
					target === normalizeWorkspacePath(registry.dashboardFile) ? nextFiles[0]! : registry.dashboardFile,
			});
			await this.host.repointAll();
		});
	}

	/** Move a board in the switcher; both indices refer to the current order. */
	reorder(from: number, to: number): Promise<void> {
		return this.run(async () => {
			const registry = this.host.read();
			const files = [...registry.workspaceFiles];
			const names = alignWorkspaceNames(files, registry.workspaceNames);
			if (from < 0 || from >= files.length || to < 0 || to >= files.length || from === to) return;
			const [file] = files.splice(from, 1);
			const [label] = names.splice(from, 1);
			files.splice(to, 0, file!);
			names.splice(to, 0, label!);
			await this.host.write({ ...registry, workspaceFiles: files, workspaceNames: names });
			this.host.refreshAll();
		});
	}

	/** Point a registered board at a file that moved outside Obsidian (the vault listener cannot follow). */
	retarget(oldPath: string, newPath: string): Promise<void> {
		return this.run(async () => {
			const registry = this.host.read();
			const target = normalizeWorkspacePath(oldPath);
			const next = normalizeWorkspacePath(newPath);
			const index = registry.workspaceFiles.indexOf(target);
			if (index < 0 || !next || next === target) return;
			if (registry.workspaceFiles.includes(next)) {
				new Notice(t('workspace.pathExists'));
				return;
			}
			if (!this.exists(next)) {
				new Notice(t('workspace.pathNotFound', { file: `${next}.md` }));
				return;
			}
			const activeChanged = normalizeWorkspacePath(registry.dashboardFile) === target;
			await this.host.write({
				workspaceFiles: registry.workspaceFiles.map((p, i) => (i === index ? next : p)),
				workspaceNames: alignWorkspaceNames(registry.workspaceFiles, registry.workspaceNames),
				dashboardFile: activeChanged ? next : registry.dashboardFile,
			});
			if (activeChanged) await this.host.repointAll();
			else this.host.refreshAll();
		});
	}

	/** The board after (`1`) or before (`-1`) `active`, wrapping around; undefined with one board. */
	adjacent(active: string, delta: 1 | -1): string | undefined {
		const files = this.host.read().workspaceFiles;
		if (files.length < 2) return undefined;
		const index = Math.max(0, files.indexOf(normalizeWorkspacePath(active)));
		return files[(index + delta + files.length) % files.length];
	}

	/** Drop entries whose file no longer exists; the active entry is kept (the engine recreates it). */
	prune(): Promise<void> {
		return this.run(async () => {
			const registry = this.host.read();
			const pruned = pruneMissingWorkspaces(
				registry.workspaceFiles,
				alignWorkspaceNames(registry.workspaceFiles, registry.workspaceNames),
				normalizeWorkspacePath(registry.dashboardFile),
				(p) => this.exists(p),
			);
			if (pruned.files.length === registry.workspaceFiles.length) return;
			await this.host.write({ ...registry, workspaceFiles: pruned.files, workspaceNames: pruned.names });
			this.host.refreshAll();
		});
	}

	private async followRename(file: { path: string }, oldPath: string): Promise<void> {
		const registry = this.host.read();
		const oldEntry = normalizeWorkspacePath(oldPath);
		const index = registry.workspaceFiles.indexOf(oldEntry);
		if (index < 0) return;
		const newEntry = normalizeWorkspacePath(file.path);
		await this.host.write({
			workspaceFiles: registry.workspaceFiles.map((p, i) => (i === index ? newEntry : p)),
			workspaceNames: alignWorkspaceNames(registry.workspaceFiles, registry.workspaceNames),
			dashboardFile:
				normalizeWorkspacePath(registry.dashboardFile) === oldEntry ? newEntry : registry.dashboardFile,
		});
		await this.host.repointAll();
	}

	private async followDelete(file: { path: string }): Promise<void> {
		const registry = this.host.read();
		const entry = normalizeWorkspacePath(file.path);
		const files = registry.workspaceFiles;
		const index = files.indexOf(entry);
		if (index < 0) return;
		if (files.length <= 1) {
			// Last board gone: reset to the default entry; the engine recreates a default board.
			await this.host.write({
				workspaceFiles: ['.nand/content/dashboard'],
				workspaceNames: [''],
				dashboardFile: '.nand/content/dashboard',
			});
		} else {
			const names = alignWorkspaceNames(files, registry.workspaceNames);
			const nextFiles = files.filter((_, i) => i !== index);
			await this.host.write({
				workspaceFiles: nextFiles,
				workspaceNames: names.filter((_, i) => i !== index),
				dashboardFile:
					normalizeWorkspacePath(registry.dashboardFile) === entry ? nextFiles[0]! : registry.dashboardFile,
			});
		}
		await this.host.repointAll();
	}

	private exists(path: string): boolean {
		return !!contentFiles(this.host.app).getFileByPath(path.endsWith('.md') ? path : `${path}.md`);
	}

	private run(operation: () => Promise<void>): Promise<void> {
		const run = this.operations.then(operation);
		this.operations = run.catch((error: unknown) => console.error('[NAND board] registry operation failed', error));
		return this.operations;
	}
}
