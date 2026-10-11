import { observeDashboardPromise } from '../save-feedback';
import { t } from '../../../../shared/i18n';
import { renderQuickActions } from '../notes/quick-actions';
import { showConfirmDialog } from '../ui/confirm-dialog';
import type { DashboardSurface } from './dashboard-surface';

export function renderBoardQuickActions(surface: DashboardSurface, container: HTMLElement): void {
	if (!surface.data) return;
	renderQuickActions(
		container,
		surface.data.quickActions,
		(action) => {
			void surface.executeAction(action);
		},
		(index) => {
			void showConfirmDialog(surface.app, {
				title: t('common.confirmDelete'),
				message: t('common.confirmDeleteMessage'),
			}).then((confirmed) => {
				if (confirmed) void observeDashboardPromise(surface.sync.removeQuickAction(index));
			});
		},
		() => surface.openAddActionModal(),
		surface.data.quickActionOrder,
		(order) => {
			void observeDashboardPromise(surface.sync.reorderQuickActions(order));
		},
		(key) => {
			void showConfirmDialog(surface.app, {
				title: t('common.confirmDelete'),
				message: t('common.confirmDeleteMessage'),
			}).then((confirmed) => {
				if (confirmed) void observeDashboardPromise(surface.sync.removeQuickActionByKey(key));
			});
		},
		surface.data.hiddenPresets,
		(action) => surface.openEditActionModal(action),
		{
			bg: surface.plugin.settings.quickButtonsBgColor,
			btn: surface.plugin.settings.quickButtonsBtnColor,
			onChange: (kind, color) => {
				void (async () => {
					surface.plugin.settings = {
						...surface.plugin.settings,
						...(kind === 'bg'
							? { quickButtonsBgColor: color ?? undefined }
							: { quickButtonsBtnColor: color ?? undefined }),
					};
					await surface.plugin.saveSettings();
				})();
			},
		},
		surface.plugin.automationHost,
	);
}
