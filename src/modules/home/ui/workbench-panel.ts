import type { PanelModel, WorkbenchTarget } from '../../../app/contracts/workbench';
import { t } from '../../../shared/i18n/index';
import type { HomeWorkbench } from '../api';
import type { HomeHost } from '../services/home-host';


/** Home in the workbench: boards (switch, create, rename, remove) and the records pages of enabled widgets. */
export function homeWorkbench(host: HomeHost, subscribe: (listener: () => void) => () => void): HomeWorkbench {
	const records = (target: WorkbenchTarget) => {
		const settings = host.settings;
		return ([
			['habits', 'workbench.recordsHabits', 'check-circle', settings.widgetHabitEnabled],
			['expenses', 'workbench.recordsExpenses', 'wallet', settings.widgetExpenseEnabled],
			['pomodoro', 'workbench.recordsPomodoro', 'timer', settings.pomodoroEnabled],
			['reading', 'workbench.recordsReading', 'book-open', settings.readingEnabled],
		] as const)
			.filter(([, , , enabled]) => enabled)
			.map(([section, labelKey, icon]) => ({
				id: `records-${section}`,
				label: t(labelKey),
				icon,
				target: { feature: 'records' as const, section },
				active: target.feature === 'records' && target.section === section,
			}));
	};
	const panel = (target: WorkbenchTarget): PanelModel => ({ searchable: false, sections: [{id:'records', title:t('workbench.records'), items:records(target)}] });
	return {
		panel,
		recordsTitle: (section) => {
			const row = records({ feature: 'records', section }).find((item) => item.target.section === section);
			return row ? `${t('workbench.records')} · ${row.label}` : t('workbench.records');
		},
		saveStatuses: () =>
			host.boardSurfaces().map((surface) => ({ path: surface.plugin.settings.dashboardFile, status: surface.sync.getSaveState().status, message: surface.saveMessage() })),
		subscribe,
	};
}
