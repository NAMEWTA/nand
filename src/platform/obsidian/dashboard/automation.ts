import { MarkdownView, type App, type TFile } from 'obsidian';
import { anniversaryDateThisYear, parseAnniversaryDate } from '../../../core/anniversaries/calendar';
import { parse as parseDashboard, serialize as serializeDashboard } from '../../../core/dashboard/parser/index';
import type { DashboardSettings } from '../../../core/dashboard/types/index';
import { readTaskMeta, TASK_META_REGEX, taskMetaSuffix } from '../../../shared/automation/metadata';
import type { AutomationAction, AutomationDefinition, SourceRef } from '../../../shared/automation/types';
import { t } from '../../../shared/i18n/index';

/** Background writes stay in the dashboard persistence domain and always re-read the note. */
export class DashboardAutomationSource {
	constructor(
		private app: App,
		private settings: () => DashboardSettings,
		private deviceId: string,
		private saveSettings: () => Promise<void>,
		private isEnabled: () => boolean,
	) {}
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
				let raw = await this.app.vault.read(file);
				// Migrate identity and owner together, so a synced note does not execute on every device.
				const migrate = (text: string) =>
					text
						.split('\n')
						.map((line) => {
							if (!/^\s*- \[ \]/.test(line)) return line;
							const meta = readTaskMeta(line);
							if (meta.automation) return line;
							const legacy = /⏰\s*(\d{4}-\d\d-\d\d\s+\d\d:\d\d)/.exec(line)?.[1];
							if (!legacy) return line;
							const at = new Date(legacy.replace(' ', 'T')).getTime();
							if (!Number.isFinite(at)) return line;
							const id = meta.id || crypto.randomUUID();
							const name = line
								.replace(/^\s*- \[ \]\s*/, '')
								.replace(TASK_META_REGEX, '')
								.replace(/⏰.*$/, '')
								.replace(/<!--collapsed-->/g, '')
								.trim();
							const automation = this.definition(id, name, at, {
								kind: 'dashboard',
								path: file.path,
								id,
							});
							return line.replace(TASK_META_REGEX, '') + taskMetaSuffix({ ...meta, id, automation });
						})
						.join('\n');
				if (migrate(raw) !== raw)
					raw = await this.app.vault.process(file, (raw) => {
						this.checkEditor(file, raw);
						return migrate(raw);
					});
				for (const line of raw.split('\n')) {
					if (!/^\s*- \[ \]/.test(line)) continue;
					const meta = readTaskMeta(line);
					if (!meta.id) continue;
					const source: SourceRef = { kind: 'dashboard', path: file.path, id: meta.id };
					if (meta.automation) {
						result.push({ ...meta.automation, source });
						continue;
					}
				}
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
				throw new Error(t('automation.editorConflict'));
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
			const source: SourceRef = { kind: 'widget', path: settings.dashboardFile, id: `widget:${entry.id}` };
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
				const label = entry.label || entry.targetDate;
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
		if (settings.anniversaryEnabled)
			for (const entry of settings.anniversaries) {
				if (!entry.annualReminder) continue;
				const start = parseAnniversaryDate(entry.startDate);
				if (!start) continue;
				const at = anniversaryDateThisYear(start, now).getTime();
				const label = entry.label || entry.startDate;
				add(
					entry,
					label,
					at,
					t('anniversary.reminderNotice', { label, years: String(now.getFullYear() - start.getFullYear()) }),
				);
			}
		if (changed) await this.saveSettings();
		return result;
	}

	async save(definition: AutomationDefinition, remove = false): Promise<void> {
		const source = definition.source;
		if (!source) throw new Error(t('automation.invalid'));
		if (source.kind === 'widget') {
			const settings = this.settings();
			const entry = [...settings.countdowns, ...settings.anniversaries].find(
				(e) => `widget:${e.id}` === source.id,
			);
			if (!entry) throw new Error(t('automation.sourceMissing'));
			entry.automation = { ...definition, enabled: remove ? false : definition.enabled };
			await this.saveSettings();
			return;
		}
		const file = this.files().find((f) => f.path === source.path);
		if (!file) throw new Error(t('automation.sourceMissing'));
		await this.app.vault.process(file, (raw) => {
			this.checkEditor(file, raw);
			let found = false;
			const next = raw
				.split('\n')
				.map((line) => {
					const meta = readTaskMeta(line);
					if (meta.id !== source.id) return line;
					if (found) throw new Error(t('automation.sourceMissing'));
					found = true;
					const text = line.replace(TASK_META_REGEX, '').replace(/\s*⏰\s*\d{4}-\d\d-\d\d\s+\d\d:\d\d/, '');
					return text + taskMetaSuffix({ ...meta, automation: remove ? undefined : definition });
				})
				.join('\n');
			if (!found) throw new Error(t('automation.sourceMissing'));
			return next;
		});
	}
	async targets(): Promise<Array<{ path: string; cardId: string; title: string }>> {
		const result: Array<{ path: string; cardId: string; title: string }> = [];
		for (const file of this.files()) {
			const data = parseDashboard(await this.app.vault.read(file));
			for (const column of data.columns)
				for (const card of column.cards)
					result.push({
						path: file.path,
						cardId: card.id,
						title: `${file.basename} / ${column.name} / ${card.title}`,
					});
		}
		return result;
	}
	async createTask(action: Extract<AutomationAction, { kind: 'create-task' }>, runId: string): Promise<void> {
		const file = this.files().find((f) => f.path === action.path);
		if (!file) throw new Error(t('automation.sourceMissing'));
		await this.app.vault.process(file, (raw) => {
			this.checkEditor(file, raw);
			if (raw.split('\n').some((line) => readTaskMeta(line).runId === runId)) return raw;
			const data = parseDashboard(raw);
			const matches = data.columns.flatMap((c) => c.cards).filter((c) => c.id === action.cardId);
			const card = matches.length === 1 ? matches[0] : undefined;
			if (!card) throw new Error(t('automation.sourceMissing'));
			card.tasks.unshift({ text: action.text, checked: false, id: crypto.randomUUID(), runId });
			return serializeDashboard(data);
		});
	}
}
