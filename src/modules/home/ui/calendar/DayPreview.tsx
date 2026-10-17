// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/calendar-grid.ts
import { widgetClasses } from '../theme/widget-classes';
import type { App } from 'obsidian';
import { createPortal } from 'react-dom';
import { usePortalContainer } from '../../../../ui/react/contexts';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { dateBucketOf, type VaultTask } from '../../platform/calendar/alltasks-scan';
import { InlineLinks } from './CalendarLinks';
import type { DashboardRenderContext } from '../renderer/render-context';
import { OriginMark } from './CalendarGrids';
import { byDayTaskTime, taskDayTime } from './calendar-layout';
interface Preview {
	anchor: HTMLElement;
	iso: string;
	tasks: VaultTask[];
}
function DayPreview({ preview, app, context }: { preview: Preview; app: App; context: DashboardRenderContext }) {
	const node = useRef<HTMLDivElement>(null),
		portal = usePortalContainer();
	useLayoutEffect(() => {
		const popup = node.current;
		if (!popup) return;
		const { anchor } = preview,
			doc = anchor.ownerDocument,
			win = doc.defaultView;
		const style = win?.getComputedStyle?.(context.root);
		if (style)
			for (const key of Array.from(style))
				if (key.startsWith('--db-')) popup.style.setProperty(key, style.getPropertyValue(key));
		const rect = anchor.getBoundingClientRect(),
			margin = 8,
			width = popup.offsetWidth,
			height = popup.offsetHeight;
		const right = rect.right + margin + width <= doc.documentElement.clientWidth;
		popup.style.left = `${right ? rect.right + margin : Math.max(margin, rect.left - margin - width)}px`;
		popup.style.top = `${Math.min(Math.max(margin, rect.top), Math.max(margin, doc.documentElement.clientHeight - height - margin))}px`;
	}, [preview, context]);
	return createPortal(
		<div ref={node} className={widgetClasses('nand-dashboard-root dashboard-calendar-day-preview')}>
			<div className={widgetClasses('dashboard-calendar-day-preview-list')}>
				{preview.tasks
					.slice()
					.sort(byDayTaskTime(preview.iso))
					.map((task) => (
						<div
							key={task.path + ':' + task.line}
							className={widgetClasses(
								`dashboard-calendar-event${task.checked ? ' is-done' : ''}${task.priority ? ` prio-${task.priority}` : ''}${!task.checked && dateBucketOf(task.due) === 'overdue' ? ' is-overdue' : ''}`,
							)}
						>
							{taskDayTime(task, preview.iso) && (
								<div className={widgetClasses('dashboard-calendar-event-time')}>
									{taskDayTime(task, preview.iso)}
								</div>
							)}
							<div className={widgetClasses('dashboard-calendar-event-text')}>
								<InlineLinks text={task.text} app={app} context={context} />
							</div>
							<OriginMark task={task} iso={preview.iso} />
						</div>
					))}
			</div>
		</div>,
		portal,
	);
}
export function useDayPreview(app: App, context: DashboardRenderContext) {
	const [preview, setPreview] = useState<Preview | null>(null);
	const timer = useRef<{ win: Window; id: number } | null>(null);
	const clear = useCallback(() => {
		if (timer.current) timer.current.win.clearTimeout(timer.current.id);
		timer.current = null;
	}, []);
	useLayoutEffect(() => clear, [clear]);
	const close = useCallback(() => {
		clear();
		setPreview(null);
	}, [clear]);
	return {
		content: preview ? <DayPreview preview={preview} app={app} context={context} /> : null,
		close,
		hover: (anchor: HTMLElement, iso: string, tasks: VaultTask[]) => {
			clear();
			const win = anchor.ownerDocument.defaultView;
			if (!win) return;
			timer.current = {
				win,
				id: win.setTimeout(() => {
					timer.current = null;
					if (anchor.isConnected) setPreview({ anchor, iso, tasks });
				}, 350),
			};
		},
	};
}
