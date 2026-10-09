import { canReceiveTask } from '../../core/board/card-kind';
import { AutomationError } from '../../../../shared/automation/errors';
import { MarkdownView, normalizePath, type App, type TFile } from 'obsidian';
import { anniversaryDateThisYear, parseAnniversaryDate } from '../../core/anniversaries/calendar';
import { resolveWidgetLabel } from '../../core/board/default-widget-label';
import { parse as parseDashboard, serialize as serializeDashboard } from '../../core/board/parser/index';
import type { DashboardSettings } from '../../core/board/types/index';
import { readTaskMeta, TASK_META_REGEX, taskMetaSuffix } from '../../../../shared/automation/metadata';
import type { AutomationAction, AutomationDefinition, SourceRef } from '../../../../shared/automation/types';
import { t } from '../../../../shared/i18n/index';

function widgetDashboardPath(path: string): string {
	const normalized = normalizePath(path.trim());
	return /\.md$/i.test(normalized) ? normalized : `${normalized}.md`;
}

/** Background writes stay in the dashboard persistence domain and always re-read the note. */
export class DashboardAutomationSource {
	async pinAction(path: string, definition: AutomationDefinition): Promise<void> {
		const file = this.app.vault.getFileByPath(widgetDashboardPath(path));
		if (!file) throw new AutomationError('sourceMissing');
		await this.app.vault.process(file, raw => {
			this.checkEditor(file, raw);
			const data = parseDashboard(raw);
			if (!data.quickActions.some(action => action.type === 'action' && action.target === definition.id))
				data.quickActions.push({ type: 'action', target: definition.id, name: definition.name, icon: 'play' });
			return serializeDashboard(data);
		});
	}
	private cache = new Map<string, { stamp: string; rows: AutomationDefinition[] }>();
	invalidate(path: string): void { this.cache.delete(path); }
	constructor(
		private app: App,
		private settings: () => DashboardSettings,
		private deviceId: string,
		private saveSettings: () => Promise<void>,
		private isEnabled: () => boolean,
	) {}
	/** Resolve extensionless references (settings store paths without `.md`) without changing task/contact source protocols. */
	resolveWidgetSource(source: SourceRef): TFile {
		if (!this.isEnabled()) throw new AutomationError('widgetModuleDisabled');
		const settings = this.settings();
		const path = widgetDashboardPath(source.path);
		const file = this.app.vault.getFileByPath(path);
		if (!file || ![settings.dashboardFile, ...settings.workspaceFiles].some((p) => widgetDashboardPath(p) === path))
			throw new AutomationError('widgetDashboardMissing');
		const matches = [
			...(settings.countdownEnabled ? settings.countdowns : []),
			...(settings.anniversaryEnabled ? settings.anniversaries : []),
		].filter((entry) => `widget:${entry.id}` === source.id);
		if (matches.length !== 1) throw new AutomationError('widgetMissing');
		return file;
	}
	private files(): TFile[] {
		const settings = this.settings();
		if (!this.isEnabled()) return [];
		return [...new Set([...(settings.workspaceFiles ?? []), settings.dashboardFile])].flatMap((path) => {
			const file = this.app.vault.getFileByPath(path.endsWith('.md') ? path : `${path}.md`);
			return file ? [file] : [];
		});
	}
	async list(): Promise<AutomationDefinition[]> {
		const result: AutomationDefinition[] = [];
		for (const file of this.files()) {
			try {
				const stamp = file.stat ? `${file.stat.mtime}:${file.stat.size}` : '';
				const cached = this.cache.get(file.path);
				if (cached && cached.stamp === stamp) { result.push(...cached.rows); continue; }
				const offset = result.length;
				const raw = await this.app.vault.read(file);
				// Task lines that carry an automation block become definitions.
				for (const line of raw.split('\n')) {
					if (!/^\s*- \[ \]/.test(line)) continue;
					const meta = readTaskMeta(line);
					if (!meta.id || !meta.automation) continue;
					const source: SourceRef = { kind: 'dashboard', path: file.path, id: meta.id };
					result.push({ ...meta.automation, source });
				}
				this.cache.set(file.path, { stamp, rows: result.slice(offset) });
			} catch (error) {
				console.error('[NAND reminders]', file.path, error);
			}
		}
		return [...result, ...(await this.widgets())];
	}
	private checkEditor(file: TFile, raw: string): void {
		for (const leaf of this.app.workspace.getLeavesOfType('markdown'))
			if (
				leaf.view instanceof MarkdownView &&
				leaf.view.file === file &&
				leaf.view.getMode() === 'source' &&
				leaf.view.editor.getValue() !== raw
			)
				throw new AutomationError('editorConflict');
	}

	private definition(id: string, name: string, at: number, source: SourceRef): AutomationDefinition {
		return {
			id,
			name,
			enabled: true,
			deviceId: this.deviceId,
			revision: at,
			schedule: { kind: 'once', at },
			action: { kind: 'notify', body: name },
			channels: ['in-app'],
			notifyOn: 'always',
			graceMinutes: 720,
			source,
			createdAt: at,
			updatedAt: at,
		};
	}
	private async widgets(): Promise<AutomationDefinition[]> {
		const settings = this.settings(),
			result: AutomationDefinition[] = [];
		if (!this.isEnabled()) return result;
		let changed = false;
		const now = new Date();
		const add = (
			entry: { id: string; automation?: AutomationDefinition },
			name: string,
			at: number,
			body: string,
		) => {
			if (!Number.isFinite(at)) return;
			const path = widgetDashboardPath(settings.dashboardFile);
			const source: SourceRef = {
				kind: 'widget',
				path: this.app.vault.getFileByPath(path)?.path ?? path,
				id: `widget:${entry.id}`,
			};
			if (!entry.automation) {
				entry.automation = this.definition(source.id, name, at, source);
				changed = true;
			}
			result.push({
				...entry.automation,
				source,
				revision: at,
				schedule: { kind: 'once', at },
				action: { kind: 'notify', body },
			});
		};
		if (settings.countdownEnabled)
			for (const entry of settings.countdowns) {
				if (!entry.targetDate || entry.reminderDays <= 0) continue;
				const target = new Date(
					entry.targetDate.includes('T') ? entry.targetDate : `${entry.targetDate}T00:00:00`,
				);
				const due = new Date(target);
				due.setDate(due.getDate() - entry.reminderDays);
				const label = resolveWidgetLabel(entry, 'countdown') || entry.targetDate;
				add(
					entry,
					label,
					due.getTime(),
					t('countdown.reminderNotice', {
						label,
						days: String(Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86400000))),
					}),
				);
			}
		if (settings.anniversaryEnabled) {
			const lookup = settings.anniversaries.some((entry) => entry.calendar === 'lunar' && entry.annualReminder)
				? await (await import('../calendar/lunar-lookup')).createLunarLookup()
				: undefined;
			for (const entry of settings.anniversaries) {
				if (!entry.annualReminder) continue;
				const start = parseAnniversaryDate(entry.startDate);
				if (!start) continue;
				const at = anniversaryDateThisYear(start, now, entry.calendar, lookup).getTime();
				const label = resolveWidgetLabel(entry, 'anniversary') || entry.startDate;
				const years = now.getFullYear() - start.getFullYear();
				add(
					entry,
					label,
					at,
					t(years === 1 ? 'anniversary.reminderNoticeOne' : 'anniversary.reminderNotice', {
						label,
						years: String(years),
					}),
				);
			}
		}
		if (changed) await this.saveSettings();
		return result;
	}

	async save(definition: AutomationDefinition, remove = false): Promise<void> {
		const source = definition.source;
		if (!source) throw new AutomationError('invalid');
		if (source.kind === 'widget') {
			const settings = this.settings();
			const entry = [...settings.countdowns, ...settings.anniversaries].find(
				(e) => `widget:${e.id}` === source.id,
			);
			if (!entry) throw new AutomationError('widgetMissing');
			entry.automation = { ...definition, enabled: remove ? false : definition.enabled };
			await this.saveSettings();
			return;
		}
		const file = this.files().find((f) => f.path === source.path);
		if (!file) throw new AutomationError('sourceMissing');
		await this.app.vault.process(file, (raw) => {
			this.checkEditor(file, raw);
			let found = false;
			const next = raw
				.split('\n')
				.map((line) => {
					const meta = readTaskMeta(line);
					if (meta.id !== source.id) return line;
					if (found) throw new AutomationError('sourceMissing');
					found = true;
					const text = line.replace(TASK_META_REGEX, '').replace(/\s*⏰\s*\d{4}-\d\d-\d\d\s+\d\d:\d\d/, '');
					return text + taskMetaSuffix({ ...meta, automation: remove ? undefined : definition });
				})
				.join('\n');
			if (!found) throw new AutomationError('sourceMissing');
			return next;
		});
	}
	async targets(): Promise<Array<{ path: string; cardId: string; title: string }>> {
		const result: Array<{ path: string; cardId: string; title: string }> = [];
		for (const file of this.files()) {
			const data = parseDashboard(await this.app.vault.read(file));
			const counts = new Map<string, number>();
			for (const column of data.columns) for (const card of column.cards) counts.set(card.id, (counts.get(card.id) ?? 0) + 1);
			for (const column of data.columns)
				for (const card of column.cards)
					if (counts.get(card.id) === 1 && canReceiveTask(column, card)) result.push({
						path: file.path,
						cardId: card.id,
						title: `${file.basename} / ${column.name} / ${card.title}`,
					});
		}
		return result;
	}
	async createTask(action: Extract<AutomationAction, { kind: 'create-task' }>, runId: string): Promise<void> {
		const file = this.files().find((f) => f.path === action.path);
		if (!file) throw new AutomationError('sourceMissing');
		await this.app.vault.process(file, (raw) => {
			this.checkEditor(file, raw);
			if (raw.split('\n').some((line) => readTaskMeta(line).runId === runId)) return raw;
			const data = parseDashboard(raw);
			const matches = data.columns.flatMap(column => column.cards.map(card => ({ column, card }))).filter(entry => entry.card.id === action.cardId);
			const target = matches.length === 1 ? matches[0] : undefined;
			if (!target) throw new AutomationError('sourceMissing');
			if (!canReceiveTask(target.column, target.card)) throw new AutomationError('taskTargetInvalid');
			const card = target.card;
			card.tasks.unshift({ text: action.text, checked: false, id: crypto.randomUUID(), runId });
			return serializeDashboard(data);
		});
	}
}
