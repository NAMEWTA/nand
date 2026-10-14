import type { App } from 'obsidian';
import { createElement as h } from 'react';
import { openRecordOverlay } from '../dialogs/open-record-dialog';
import { mountRecordPanel } from '../dialogs/mount-record-panel';
import type { HolidayInfo } from '../../platform/calendar/holiday-service';
import { LunarPanel } from './LunarPanel';
export function renderSidebarLunarWidget(
	container: HTMLElement,
	holidayData: Record<string, HolidayInfo>,
	app?: App,
): void {
	const root = container.createDiv({ cls: 'dashboard-sidebar-widget dashboard-sidebar-lunar' });
	mountRecordPanel(
		root,
		h(LunarPanel, {
			holidays: holidayData,
			win: root.ownerDocument.defaultView!,
			fortune: () => {
				// The fortune texts (~175 KB) load when the dialog is opened.
				if (app)
					void import('./FortuneDialog').then(({ FortuneDialog }) => {
						if (root.isConnected)
							openRecordOverlay(root.ownerDocument, (close) => h(FortuneDialog, { onClose: close }));
					});
			},
		}),
	);
}
