import type { App } from 'obsidian';
import type { TargetedDragEvent } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import type { RenderCallbacks } from '../render-contract';
import type { DashboardRenderContext } from '../renderer/render-context';
import { ITEM_DRAG_TYPE } from '../ui/dnd';
import { attachFileSuggest } from '../ui/file-suggest';

type DragEvent = TargetedDragEvent<HTMLDivElement>;
type Kind = 'task' | 'doc';
const dragClasses = [
	'dashboard-task-item--drag-top',
	'dashboard-task-item--drag-bottom',
	'dashboard-task-item--drag-nest',
];
function clearHints(context: DashboardRenderContext) {
	context.root
		.querySelectorAll(dragClasses.map((name) => '.' + name).join(','))
		.forEach((el) => el.classList.remove(...dragClasses));
}
export function itemDrag(
	context: DashboardRenderContext,
	callbacks: RenderCallbacks,
	kind: Kind,
	cardId: string,
	path: number[],
) {
	const source = () =>
		kind === 'task'
			? context.taskDragSource.current && {
					cardId: context.taskDragSource.current.cardId,
					path: context.taskDragSource.current.taskPath,
				}
			: context.docDragSource.current && {
					cardId: context.docDragSource.current.cardId,
					path: context.docDragSource.current.docPath,
				};
	const same = () => source()?.cardId === cardId && JSON.stringify(source()?.path) === JSON.stringify(path);
	const mode = (event: DragEvent) => {
		const rect = event.currentTarget.getBoundingClientRect();
		const ratio = (event.clientY - rect.top) / rect.height;
		return ratio < 0.3 ? 'before' : ratio > 0.7 ? 'after' : 'nest';
	};
	return {
		onDragStart(event: DragEvent) {
			event.stopPropagation();
			if (kind === 'task') context.taskDragSource.current = { cardId, taskPath: path };
			else context.docDragSource.current = { cardId, docPath: path };
			event.currentTarget.classList.add('dashboard-task-item--dragging');
			if (event.dataTransfer) {
				event.dataTransfer.effectAllowed = 'move';
				event.dataTransfer.setData('text/plain', JSON.stringify(path));
				event.dataTransfer.setData(ITEM_DRAG_TYPE, '1');
			}
		},
		onDragEnd(event: DragEvent) {
			event.currentTarget.classList.remove('dashboard-task-item--dragging');
			clearHints(context);
			if (kind === 'task') context.taskDragSource.current = null;
			else context.docDragSource.current = null;
		},
		onDragOver(event: DragEvent) {
			if (!source()) return;
			event.preventDefault();
			event.stopPropagation();
			clearHints(context);
			if (same()) return;
			if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
			event.currentTarget.classList.add(
				dragClasses[mode(event) === 'before' ? 0 : mode(event) === 'after' ? 1 : 2]!,
			);
		},
		onDragLeave(event: DragEvent) {
			event.currentTarget.classList.remove(...dragClasses);
		},
		onDrop(event: DragEvent) {
			const src = source();
			if (!src) return;
			event.preventDefault();
			event.stopPropagation();
			clearHints(context);
			if (same()) return;
			const placement = mode(event);
			if (kind === 'task') {
				if (src.cardId !== cardId) callbacks.onTaskMoveToCard(src.cardId, src.path, cardId, path, placement);
				else if (placement === 'nest') callbacks.onTaskNestInto(cardId, src.path, path);
				else callbacks.onTaskReorder(cardId, src.path, path, placement === 'before');
			} else {
				if (src.cardId !== cardId) callbacks.onDocMoveToCard(src.cardId, src.path, cardId, path, placement);
				else if (placement === 'nest') callbacks.onDocNest(cardId, src.path);
				else callbacks.onDocReorder(cardId, src.path, path, placement === 'before');
			}
		},
	};
}
export function listDrop(
	context: DashboardRenderContext,
	callbacks: RenderCallbacks,
	kind: Kind,
	cardId: string,
	count: number,
) {
	const cls = kind === 'task' ? 'dashboard-task-list--drop-target' : 'dashboard-project-docs--drop-target';
	const source = () => (kind === 'task' ? context.taskDragSource.current : context.docDragSource.current);
	return {
		onDragOver(event: DragEvent) {
			if (!source() || source()?.cardId === cardId) return;
			event.preventDefault();
			if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
			event.currentTarget.classList.add(cls);
		},
		onDragLeave(event: DragEvent) {
			if (!event.currentTarget.contains(event.relatedTarget as Node)) event.currentTarget.classList.remove(cls);
		},
		onDrop(event: DragEvent) {
			event.currentTarget.classList.remove(cls);
			if (event.defaultPrevented || source()?.cardId === cardId) return;
			if (kind === 'task') {
				const src = context.taskDragSource.current;
				if (src) {
					event.preventDefault();
					event.stopPropagation();
					callbacks.onTaskMoveToCard(src.cardId, src.taskPath, cardId, [count], 'before');
				}
			} else {
				const src = context.docDragSource.current;
				if (src) {
					event.preventDefault();
					event.stopPropagation();
					callbacks.onDocMoveToCard(src.cardId, src.docPath, cardId, [count], 'before');
				}
			}
		},
	};
}
export function useFileSuggest<T extends HTMLInputElement | HTMLTextAreaElement>(app: App) {
	const input = useRef<T>(null);
	const suggest = useRef<ReturnType<typeof attachFileSuggest> | null>(null);
	useLayoutEffect(() => {
		if (!input.current) return;
		suggest.current = attachFileSuggest(input.current, app);
		return () => {
			suggest.current?.destroy();
			suggest.current = null;
		};
	}, [app]);
	return { input, suggest };
}

/** Touch gestures own only transient pointer state; rows and nesting remain Preact state. */
export function useTaskTouch(onNest: () => void, onUnnest: () => void) {
	const row = useRef<HTMLDivElement>(null);
	const actions = useRef({ onNest, onUnnest });
	actions.current = { onNest, onUnnest };
	useLayoutEffect(() => {
		const el = row.current;
		const win = el?.ownerDocument.defaultView;
		if (!el || !win) return;
		let state: { x: number; y: number; time: number; moved: boolean; dragging: boolean } | null = null;
		let timer: number | undefined;
		const cancel = () => {
			win.clearTimeout(timer);
			state = null;
			el.style.removeProperty('transform');
			el.classList.remove('dashboard-task-item--dragging');
		};
		const start = (event: TouchEvent) => {
			cancel();
			const touch = event.touches[0];
			if (!touch) return;
			state = { x: touch.clientX, y: touch.clientY, time: Date.now(), moved: false, dragging: false };
			timer = win.setTimeout(() => {
				if (state && !state.moved) {
					state.dragging = true;
					el.classList.add('dashboard-task-item--dragging');
				}
			}, 500);
		};
		const move = (event: TouchEvent) => {
			const touch = event.touches[0];
			if (!state || !touch) return;
			const dx = touch.clientX - state.x,
				dy = touch.clientY - state.y;
			if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
				state.moved = true;
				win.clearTimeout(timer);
			}
			if (!state.dragging && state.moved && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy))
				el.style.transform = `translateX(${Math.max(-40, Math.min(40, dx * 0.5))}px)`;
		};
		const end = (event: TouchEvent) => {
			const old = state;
			cancel();
			if (!old || old.dragging) return;
			const touch = event.changedTouches[0];
			const dx = touch ? touch.clientX - old.x : 0,
				dy = touch ? touch.clientY - old.y : 0;
			if (Date.now() - old.time < 500 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
				if (dx > 0) actions.current.onNest();
				else actions.current.onUnnest();
			} else if (!old.moved) {
				const active = el.classList.contains('dashboard-task-item--touched');
				el.ownerDocument
					.querySelectorAll('.dashboard-task-item--touched')
					.forEach((item) => item.classList.remove('dashboard-task-item--touched'));
				if (!active) el.classList.add('dashboard-task-item--touched');
			}
		};
		el.addEventListener('touchstart', start, { passive: true });
		el.addEventListener('touchmove', move, { passive: true });
		el.addEventListener('touchend', end, { passive: true });
		el.addEventListener('touchcancel', cancel);
		return () => {
			cancel();
			el.removeEventListener('touchstart', start);
			el.removeEventListener('touchmove', move);
			el.removeEventListener('touchend', end);
			el.removeEventListener('touchcancel', cancel);
		};
	}, []);
	return row;
}
