import { h, render, type ComponentChild } from 'preact';
import type { PageCreate } from '../../../app/contracts/workbench-host';
import type { WorkbenchTarget } from '../../../app/contracts/workbench';
import { onLanguageChanged, t } from '../../../shared/i18n';
import { NativeSurface, type NativeSurfaceContext } from '../../../ui/native-surface';
import { EmptyState } from '../../../ui/primitives/EmptyState';
import { homeServices } from '../services/instances';
import { applyModalTheme } from './appearance/modal-theme';
import { ExpenseStatsPanel } from './expense/ExpenseStatsPanel';
import { HabitStatsPanel } from './habit/HabitStatsPanel';
import { PomodoroStatsPanel } from './pomodoro/PomodoroStatsPanel';
import { ReadingStatsPanel } from './reading/ReadingDialogs';

export const RECORD_SECTIONS = ['habits', 'expenses', 'pomodoro', 'reading'] as const;
export type RecordSection = (typeof RECORD_SECTIONS)[number];

/** Habit, expense, Pomodoro and reading records as workbench pages (they used to be dialogs on the board). */
class RecordsSurface extends NativeSurface {
	private section: RecordSection = 'habits';

	getViewType(): string {
		return 'nand-records';
	}
	getDisplayText(): string {
		return t('workbench.records');
	}
	getIcon(): string {
		return 'chart-column';
	}
	onOpen(): Promise<void> {
		this.contentEl.addClass('nand-records-page');
		this.register(onLanguageChanged(() => this.draw()));
		this.draw();
		return Promise.resolve();
	}
	onClose(): Promise<void> {
		render(null, this.contentEl);
		return Promise.resolve();
	}
	show(target: WorkbenchTarget): void {
		const section = (RECORD_SECTIONS as readonly string[]).includes(target.section ?? '') ? (target.section as RecordSection) : 'habits';
		if (section === this.section && this.contentEl.hasChildNodes()) return;
		this.section = section;
		this.draw();
	}
	get current(): RecordSection {
		return this.section;
	}
	private draw(): void {
		render(null, this.contentEl);
		this.contentEl.empty();
		const host = this.contentEl.createDiv({ cls: 'nand-records-page-body' });
		const panel = this.panel(host);
		if (!panel) {
			render(h(EmptyState, { icon: 'chart-column', title: t('workbench.notReady'), description: '', layout: 'content' }), host);
			return;
		}
		host.addClass(...panel.className.split(' '));
		applyModalTheme(host);
		render(panel.node, host);
	}
	private panel(root: HTMLElement): { className: string; node: ComponentChild } | null {
		switch (this.section) {
			case 'habits': {
				const service = (homeServices.habit ?? null);
				return service && { className: 'dashboard-habit-stats-modal', node: h(HabitStatsPanel, { service }) };
			}
			case 'expenses': {
				const service = (homeServices.expense ?? null);
				return service && { className: 'dashboard-expense-stats-modal dashboard-expense-stats-modal--wide', node: h(ExpenseStatsPanel, { service, root }) };
			}
			case 'pomodoro': {
				const service = homeServices.pomodoro;
				return service ? { className: 'dashboard-pomodoro-stats-modal dashboard-pomodoro-stats-modal--wide', node: h(PomodoroStatsPanel, { service, root }) } : null;
			}
			case 'reading': {
				const service = homeServices.reading;
				return service ? { className: 'dashboard-reading-stats-modal', node: h(ReadingStatsPanel, { service }) } : null;
			}
		}
	}
}

export const createRecordsPage = (): PageCreate => async (context: NativeSurfaceContext, target) => {
	const surface = new RecordsSurface(context);
	surface.show(target);
	return {
		surface,
		getTarget: () => ({ feature: 'records', section: surface.current }),
		navigate: async (next) => surface.show(next),
	};
};
