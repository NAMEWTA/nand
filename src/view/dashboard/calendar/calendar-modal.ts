import { App, Modal, Notice } from 'obsidian';
import { h } from 'preact';
import { type VaultTask } from '../../../platform/obsidian/calendar/alltasks-scan';
import { insertTaskForDay, type TaskInsertTarget } from '../../../platform/obsidian/calendar/daily-notes';
import { t } from '../../../shared/i18n';
import { applyModalTheme } from '../appearance/modal-theme';
import {
	DashboardRenderContext,
	bindRenderContext,
	mountDashboardPanel,
	unmountDashboardPanelsIn,
} from '../renderer/render-context';
import { CalendarModalPanel, DayAgendaPanel, type CalendarModalCallbacks } from './CalendarModalPanel';
import { readTaskInsertPosition, readTaskTarget } from './calendar-preferences';

/** Native modal lifecycle and keyboard scope; business rendering belongs to the panel. */
export class CalendarMonthModal extends Modal {
	private shift: ((delta: number) => void) | null = null;
	constructor(
		app: App,
		private readonly byDay: Map<string, VaultTask[]>,
		private readonly cb: CalendarModalCallbacks,
		private readonly initialView: 'month' | 'week' = 'month',
		private readonly initialWeekStart?: Date,
		private readonly dashboardFile?: string,
	) {
		super(app);
	}
	onOpen(): void {
		this.contentEl.addClass('dashboard-calendar-fullscreen');
		this.modalEl.addClass('dashboard-calendar-fullscreen-modal');
		const context = prepareModal(this, this.cb);
		this.scope.register([], 'ArrowLeft', () => {
			this.shift?.(-1);
			return false;
		});
		this.scope.register([], 'ArrowRight', () => {
			this.shift?.(1);
			return false;
		});
		mountDashboardPanel(
			this.contentEl,
			h(CalendarModalPanel, {
				app: this.app,
				context,
				actions: this.cb,
				byDay: this.byDay,
				initialView: this.initialView,
				initialWeekStart: this.initialWeekStart,
				registerShift: (callback) => {
					this.shift = callback;
				},
				openDay: (iso, tasks, focus) =>
					new DayAgendaModal(this.app, iso, tasks, this.cb, this.dashboardFile, focus).open(),
			}),
		);
	}
	onClose(): void {
		unmountDashboardPanelsIn(this.contentEl);
		this.contentEl.empty();
	}
}
export class DayAgendaModal extends Modal {
	constructor(
		app: App,
		private readonly iso: string,
		private readonly tasks: VaultTask[],
		private readonly cb: CalendarModalCallbacks,
		private readonly dashboardFile?: string,
		private readonly focusAddInput = false,
	) {
		super(app);
	}
	onOpen(): void {
		this.contentEl.addClass('dashboard-library-config-modal');
		this.containerEl.parentElement?.addClass('modal-bg--dashboard');
		const context = prepareModal(this, this.cb);
		mountDashboardPanel(
			this.contentEl,
			h(DayAgendaPanel, {
				app: this.app,
				context,
				actions: this.cb,
				iso: this.iso,
				tasks: this.tasks,
				focusInput: this.focusAddInput,
				addTask: (title, time) => this.addTask(title, time),
				close: () => this.close(),
			}),
		);
	}
	private async addTask(title: string, time: string): Promise<VaultTask | null> {
		const reminder = time ? `${this.iso} ${time}` : undefined;
		const line = reminder ? `- [ ] ${title} ⏰ ${reminder}` : `- [ ] ${title} 📅 ${this.iso}`;
		let target: TaskInsertTarget | null = null;
		try {
			target = await insertTaskForDay(
				this.app,
				this.iso,
				line,
				this.dashboardFile,
				readTaskInsertPosition(this.cb.settingsAccess),
				readTaskTarget(this.cb.settingsAccess),
			);
		} catch (err) {
			console.error('[Dashboard] add task failed:', err);
			new Notice(t('calendar.taskAddFailed'), 4000);
			return null;
		}
		if (!target) {
			new Notice(t('calendar.dailyNotesDisabled'), 5000);
			return null;
		}
		new Notice(t('calendar.taskAddedDaily', { path: target.file.path }), 3000);

		return {
			file: target.file,
			path: target.file.path,
			line: target.line,
			originalLine: target.writtenLine,
			checked: false,
			text: title,
			reminder,
			due: this.iso,
			time: time || undefined,
			priority: undefined,
			mtime: Date.now(),
			ctime: Date.now(),
		};
	}
	onClose(): void {
		unmountDashboardPanelsIn(this.contentEl);
		this.contentEl.empty();
	}
}
function prepareModal(modal: Modal, actions: CalendarModalCallbacks): DashboardRenderContext {
	unmountDashboardPanelsIn(modal.contentEl);
	modal.contentEl.empty();
	applyModalTheme(modal.containerEl);
	modal.containerEl.addClass('modal--dashboard');
	modal.containerEl.setCssProps({
		background: 'transparent',
		backgroundColor: 'transparent',
		border: 'none',
		boxShadow: 'none',
	});
	const context = new DashboardRenderContext(modal.contentEl);
	context.noteOpener = (file, subpath) => {
		if (actions.onOpenNote) actions.onOpenNote(file);
		else void modal.app.workspace.openLinkText(file.path + (subpath ?? ''), '');
	};
	bindRenderContext(modal.contentEl, context);
	return context;
}
