import type { App } from 'obsidian';
import { h } from 'preact';
import type { AnniversaryConfig } from '../../../core/dashboard/types';
import { mountDashboardPanel } from '../renderer/render-context';
import { AnniversaryPanel } from './AnniversaryPanel';
import { AnniversarySettingsModal } from './anniversary-settings-modal';
import { applyWidgetBackground } from './widget-background';
export function renderSidebarAnniversaryWidget(
	container: HTMLElement,
	config: AnniversaryConfig,
	app?: App,
	onEdit?: (config: AnniversaryConfig) => void,
): void {
	const widget = container.createDiv({ cls: 'dashboard-sidebar-widget dashboard-sidebar-anniversary' });
	if (app && onEdit) widget.addClass('dashboard-sidebar-widget--cfg');
	if (app) applyWidgetBackground(widget, config.background, app);
	mountDashboardPanel(
		widget,
		h(AnniversaryPanel, {
			config,
			win: widget.ownerDocument.defaultView!,
			edit:
				app && onEdit
					? () => {
							new AnniversarySettingsModal(app, config, onEdit).open();
						}
					: undefined,
		}),
	);
}
