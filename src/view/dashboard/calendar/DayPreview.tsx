import type { App } from 'obsidian';
import { createPortal } from 'preact/compat';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { dateBucketOf, type VaultTask } from '../../../platform/obsidian/calendar/alltasks-scan';
import { InlineLinks } from '../cards/InlineLinks';
import type { DashboardRenderContext } from '../renderer/render-context';
import { OriginMark } from './CalendarGrids';
import { byDayTaskTime, taskDayTime } from './calendar-layout';
interface Preview {
	anchor: HTMLElement;
	iso: string;
	tasks: VaultTask[];
}
function DayPreview({ preview, app, context }: { preview: Preview; app: App; context: DashboardRenderContext }) {
	const node = useRef<HTMLDivElement>(null);
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
		<div ref={node} class="dashboard-calendar-day-preview">
			<div class="dashboard-calendar-day-preview-list">
				{preview.tasks
					.slice()
					.sort(byDayTaskTime(preview.iso))
					.map((task) => (
						<div
							key={task.path + ':' + task.line}
							class={`dashboard-calendar-event${task.checked ? ' is-done' : ''}${task.priority ? ` prio-${task.priority}` : ''}${!task.checked && dateBucketOf(task.due) === 'overdue' ? ' is-overdue' : ''}`}
						>
							{taskDayTime(task, preview.iso) && (
								<div class="dashboard-calendar-event-time">{taskDayTime(task, preview.iso)}</div>
							)}
							<div class="dashboard-calendar-event-text">
								<InlineLinks text={task.text} app={app} context={context} />
							</div>
							<OriginMark task={task} iso={preview.iso} />
						</div>
					))}
			</div>
		</div>,
		preview.anchor.ownerDocument.body,
	);
}
export function useDayPreview(app: App, context: DashboardRenderContext) {
	const [preview, setPreview] = useState<Preview | null>(null);
	const timer = useRef<{ win: Window; id: number } | null>(null);
	const clear = () => {
		if (timer.current) timer.current.win.clearTimeout(timer.current.id);
		timer.current = null;
	};
	useLayoutEffect(() => clear, []);
	return {
		content: preview ? <DayPreview preview={preview} app={app} context={context} /> : null,
		close: () => {
			clear();
			setPreview(null);
		},
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
