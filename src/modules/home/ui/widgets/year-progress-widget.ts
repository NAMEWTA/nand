import type { App } from 'obsidian';
import { createElement as h } from 'react';
import { mountRecordPanel } from '../dialogs/mount-record-panel';
import type { WidgetBackground } from '../../core/board/types';
import { YearProgressPanel } from './YearProgressPanel';
import { applyWidgetBackground, attachBackgroundConfigButton } from './widget-background';
export function renderSidebarYearProgress(
	container: HTMLElement,
	bg?: WidgetBackground,
	app?: App,
	onBgChange?: (bg: WidgetBackground | undefined) => void,
): void {
	const root = container.createDiv({ cls: 'dashboard-sidebar-widget dashboard-sidebar-year-progress' });
	mountRecordPanel(root, h(YearProgressPanel, { win: root.ownerDocument.defaultView! }));
	if (app) applyWidgetBackground(root, bg, app);
	if (app && onBgChange) attachBackgroundConfigButton(root, app, bg, onBgChange);
}
