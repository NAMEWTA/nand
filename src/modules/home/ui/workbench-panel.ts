import type { PanelModel, WorkbenchTarget } from '../../../app/contracts/workbench';
import { t } from '../../../shared/i18n/index';
import { promptText } from '../../../ui/primitives/prompt';
import type { HomeWorkbench } from '../api';
import type { HomeHost } from '../services/home-host';
import { promptNewBoard } from './NewBoardDialog';

const boardPath = (path: string) => path.replace(/\.md$/i, '').replace(/^\/+/, '');

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
	const panel = (target: WorkbenchTarget): PanelModel => {
		const settings = host.settings;
		const files = settings.workspaceFiles;
		const names = files.map((_, index) => settings.workspaceNames?.[index] ?? '');
		const active = boardPath(target.resourceId ?? settings.dashboardFile);
		return {
			primary: {
				label: t('workbench.newBoard'),
				icon: 'plus',
				run: async () => {
					const result = await promptNewBoard(host.app);
					if (result) {
						await host.createWorkspace(result.name, result.layout);
						await host.openBoard(host.settings.dashboardFile);
					}
				},
			},
			searchable: files.length > 6,
			sections: [
				{
					id: 'boards',
					title: t('workbench.boards'),
					items: files.map((file, index) => ({
						id: file,
						label: names[index] || file.split('/').pop() || file,
						icon: 'layout-dashboard',
						active: target.feature === 'dashboard' && file === active,
						target: { feature: 'dashboard' as const, resourceId: file },
						menu: () => [
							...(index > 0 ? [{ title: t('workspace.moveUp'), icon: 'arrow-up', run: () => host.reorderWorkspaces(index, index - 1) }] : []),
							...(index < files.length - 1 ? [{ title: t('workspace.moveDown'), icon: 'arrow-down', run: () => host.reorderWorkspaces(index, index + 1) }] : []),
							...(['side', 'stacked', 'immersive'] as const).map(layout => ({
								title: t(layout === 'side' ? 'renderer.layoutSide' : layout === 'stacked' ? 'renderer.layoutStacked' : 'renderer.layoutImmersive'),
								icon: 'panels-top-left',
								run: () => host.setBoardLayout(file, layout),
							})),
							{
								title: t('workspace.renameTitle'),
								icon: 'pencil',
								run: async () => {
									const name = await promptText(host.app, { title: t('workspace.renameTitle'), value: names[index] ?? '' });
									if (name !== null) await host.renameWorkspace(file, name);
								},
							},
							...(files.length > 1 ? [{ title: t('workspace.removeTitle'), icon: 'trash-2', danger: true, run: () => host.removeWorkspace(file) }] : []),
						],
					})),
				},
				{ id: 'records', title: t('workbench.records'), items: records(target) },
			].filter((section) => section.items.length > 0),
		};
	};
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
