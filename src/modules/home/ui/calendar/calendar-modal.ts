// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/calendar-modal.ts
import { createElement } from 'react';
import { Notice, type App } from 'obsidian';
import type { VaultTask } from '../../platform/calendar/alltasks-scan';
import { insertTaskForDay } from '../../platform/calendar/daily-notes';
import { t } from '../../../../shared/i18n';
import { DashboardRenderContext } from '../renderer/render-context';
import { openRecordDialog } from '../dialogs/open-record-dialog';
import { CalendarModalPanel, DayAgendaPanel, type CalendarModalCallbacks } from './CalendarModalPanel';
import { readTaskInsertPosition, readTaskTarget } from './calendar-preferences';
import { contentFiles } from '../../../../host/obsidian/storage/content-files';
function calendarContext(app: App, root: HTMLElement, cb: CalendarModalCallbacks) {
	const context = new DashboardRenderContext(root);
	context.noteOpener = (file, subpath) => {
		if (cb.onOpenNote) cb.onOpenNote(file);
		else void contentFiles(app).open(file.path + (subpath ?? ''), root.ownerDocument.defaultView ?? undefined);
	};
	return context;
}
export class CalendarMonthModal {
	private cleanup?: () => void;
	private child?: DayAgendaModal;
	constructor(
		private app: App,
		private byDay: Map<string, VaultTask[]>,
		private cb: CalendarModalCallbacks,
		private initialView: 'month' | 'week' = 'month',
		private initialWeekStart?: Date,
		private dashboardFile?: string,
		private doc = app.workspace.containerEl.ownerDocument,
	) {}
	open(): void {
		this.cleanup = openRecordDialog(
			this.doc,
			t('calendar.fullscreen'),
			'dashboard-calendar-fullscreen-modal',
			(close, root) =>
				createElement(CalendarModalPanel, {
					app: this.app,
					context: calendarContext(this.app, root, this.cb),
					actions: this.cb,
					byDay: this.byDay,
					initialView: this.initialView,
					initialWeekStart: this.initialWeekStart,
					close,
					openDay: (iso, tasks, focus) => {
						this.child?.close();
						this.child = new DayAgendaModal(
							this.app,
							iso,
							tasks,
							this.cb,
							this.dashboardFile,
							focus,
							this.doc,
						);
						this.child.open();
					},
				}),
		);
	}
	close(): void {
		this.child?.close();
		this.cleanup?.();
		this.cleanup = undefined;
	}
}
export class DayAgendaModal {
	private cleanup?: () => void;
	constructor(
		private app: App,
		private iso: string,
		private tasks: VaultTask[],
		private cb: CalendarModalCallbacks,
		private dashboardFile?: string,
		private focusAddInput = false,
		private doc = app.workspace.containerEl.ownerDocument,
	) {}
	open(): void {
		this.cleanup = openRecordDialog(
			this.doc,
			t('calendar.dayAgenda'),
			'dashboard-library-config-modal',
			(close, root) =>
				createElement(DayAgendaPanel, {
					app: this.app,
					context: calendarContext(this.app, root, this.cb),
					actions: this.cb,
					iso: this.iso,
					tasks: this.tasks,
					focusInput: this.focusAddInput,
					addTask: (title, time) => this.addTask(title, time),
					close,
				}),
		);
	}
	private async addTask(title: string, time: string): Promise<VaultTask | null> {
		const reminder = time ? `${this.iso} ${time}` : undefined;
		const line = reminder ? `- [ ] ${title} ⏰ ${reminder}` : `- [ ] ${title} 📅 ${this.iso}`;
		try {
			const target = await insertTaskForDay(
				this.app,
				this.iso,
				line,
				this.dashboardFile,
				readTaskInsertPosition(this.cb.settingsAccess),
				readTaskTarget(this.cb.settingsAccess),
			);
			if (!target) {
				new Notice(t('calendar.dailyNotesDisabled'));
				return null;
			}
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
				mtime: Date.now(),
				ctime: Date.now(),
			};
		} catch (error) {
			console.error('[Dashboard] add task failed', error);
			new Notice(t('calendar.taskAddFailed'));
			return null;
		}
	}
	close(): void {
		this.cleanup?.();
		this.cleanup = undefined;
	}
}
