// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { normalizePath, type App, type TFile } from 'obsidian';
import type { WeekStart } from '../core/moment-format';
import {
	cleanFolder,
	effectiveWeekStart,
	formatDistinguishes,
	identifyPeriodNote,
	parentOf,
	periodPath,
	startOfPeriod,
	stepPeriod,
	type Period,
	type PeriodRef,
	type PeriodRule,
	type PeriodRules,
} from '../core/periodic';
import { baseName, parentFolder, type NoteEntry } from '../core/types';
import type { ConfigReader } from '../core/productivity-config';
import { obsidianLocale, resolveWeekStart } from './locale';
import type { NoteFactory } from './note-factory';

export interface PeriodicNotes {
	/** The rules in force (the Daily notes core plugin may supply the daily rule), the week start and the locale. */
	config(): { rules: PeriodRules; weekStart: WeekStart; locale: string | undefined };
	pathFor(period: Period, date: Date): string;
	/** The note of that period if it exists. */
	existing(period: Period, date: Date): NoteEntry | undefined;
	/** Which period note a path is. */
	identify(path: string): PeriodRef | undefined;
	/** Open the note of the period containing `date`, creating it if needed. */
	open(period: Period, date: Date, options?: { newTab?: boolean }): Promise<boolean>;
	/** Next (+1) or previous (-1) period note of the active note; false when the active note is not a period note. */
	openRelative(delta: number): Promise<boolean>;
	openParent(): Promise<boolean>;
}

interface CoreDailyOptions { folder?: string; format?: string; template?: string }

/** Folder, format and template of the Daily notes core plugin, when it is enabled. */
export function coreDailyRule(app: App): PeriodRule | undefined {
	const internal = (app as unknown as { internalPlugins?: { getPluginById?: (id: string) => { enabled?: boolean; instance?: { options?: CoreDailyOptions } } | undefined } }).internalPlugins;
	const plugin = internal?.getPluginById?.('daily-notes');
	if (!plugin?.enabled) return undefined;
	const options = plugin.instance?.options ?? {};
	return { enabled: true, folder: cleanFolder(options.folder ?? ''), format: options.format?.trim() || 'YYYY-MM-DD', template: options.template?.trim() ?? '' };
}

export interface PeriodicDeps {
	app: App;
	settings: ConfigReader;
	factory: NoteFactory;
	/** Open an existing note in the editor. */
	openFile: (file: TFile, options: { newTab?: boolean }) => Promise<void>;
	entry: (path: string) => NoteEntry | undefined;
	notify: (key: string) => void;
	report: (error: unknown) => void;
}

export function createPeriodicNotes(deps: PeriodicDeps): PeriodicNotes {
	const { app, settings } = deps;

	function config() {
		const s = settings.get();
		const locale = obsidianLocale();
		const rules: PeriodRules = { ...s.periodRules };
		if (s.calendarSource === 'core') {
			const core = coreDailyRule(app);
			if (core) rules.day = core;
		}
		return { rules, weekStart: resolveWeekStart(s.calendarWeekStart), locale };
	}

	const pathFor = (period: Period, date: Date) => {
		const { rules, weekStart, locale } = config();
		return normalizePath(periodPath(rules[period], period, date, weekStart, locale));
	};

	async function open(period: Period, date: Date, options: { newTab?: boolean } = {}): Promise<boolean> {
		const { rules, weekStart, locale } = config();
		const rule = rules[period];
		if (!rule.enabled) { deps.notify(`navigator.periodOff.${period}`); return false; }
		// A pattern that gives every period the same name would turn all of them into one file.
		if (!formatDistinguishes(rule, period, weekStart, locale)) { deps.notify('navigator.periodFormatInvalid'); return false; }
		const start = startOfPeriod(period, date, effectiveWeekStart(rule, weekStart));
		const path = pathFor(period, start);
		const existing = app.vault.getFileByPath(path);
		if (existing) {
			await deps.openFile(existing, options);
			return true;
		}
		const created = await deps.factory.createNote({
			folder: parentFolder(path),
			name: baseName(path).replace(/\.md$/, ''),
			exact: true,
			template: rule.template,
			noteDate: start,
			periodFormat: rule.format,
			weekDaysFromNoteDate: period === 'week',
			open: { newTab: options.newTab },
		});
		return created !== undefined;
	}

	const activeRef = () => {
		const file = app.workspace.getActiveFile();
		const { rules, weekStart, locale } = config();
		return file ? identifyPeriodNote(file.path, rules, weekStart, locale) : undefined;
	};

	return {
		config,
		pathFor,
		existing: (period, date) => deps.entry(pathFor(period, date)),
		identify: (path) => {
			const { rules, weekStart, locale } = config();
			return identifyPeriodNote(path, rules, weekStart, locale);
		},
		open,
		async openRelative(delta) {
			const ref = activeRef();
			if (!ref) { deps.notify('navigator.notPeriodNote'); return false; }
			const next = stepPeriod(ref, delta);
			return open(next.period, next.start);
		},
		async openParent() {
			const ref = activeRef();
			if (!ref) { deps.notify('navigator.notPeriodNote'); return false; }
			const parent = parentOf(ref, config().rules, config().weekStart);
			if (!parent) { deps.notify('navigator.noParentPeriod'); return false; }
			return open(parent.period, parent.start);
		},
	};
}
