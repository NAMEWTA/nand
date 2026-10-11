import { t } from '../../../../shared/i18n';
import { pixelsToRows } from '../../core/board/board-tiles';
import { beginGesture, CANONICAL_COLUMNS, dropAtPointer, edgeScrollStep, effectiveColumns, GRID_GAP_PX, GRID_ROW_PX, nudgeTile, previewGesture, projectLayout, resizeTile, type GridTile, type LayoutGesture } from '../../core/board/immersive-grid';

/** One owner-window controller. Display measurements never enter the save callback. */
export function attachGridController(grid: HTMLElement, source: readonly GridTile[], save: (tiles: readonly GridTile[]) => void): () => void {
	const win = grid.ownerDocument.defaultView!;
	const elements = new Map([...grid.querySelectorAll<HTMLElement>('[data-tile]')].map(el => [el.dataset.tile!, el]));
	const liveRegion = grid.querySelector<HTMLElement>('.nand-immersive-live')!;
	const ghost = grid.querySelector<HTMLElement>('.nand-immersive-ghost')!;
	let canonical = source.map(tile => ({ ...tile }));
	let columns = CANONICAL_COLUMNS;
	let live: GridTile[] = [];
	let gesture: LayoutGesture | null = null;
	let lifted: string | null = null;
	let pointer: { id: number; control: HTMLElement; mode: string; x: number; y: number; originX: number; originY: number; scroll: number; started: boolean } | null = null;
	let frame = 0;
	let measuring = 0;
	let closed = false;
	const scrollHost = () => grid.closest<HTMLElement>('.dashboard-scroll-region') ?? grid.closest<HTMLElement>('.dashboard-kanban') ?? grid;
	const position = (el: HTMLElement, tile: GridTile) => { el.style.gridColumn = `${tile.x + 1} / span ${tile.w}`; el.style.gridRow = `${tile.y + 1} / span ${tile.h}`; };
	const paint = (tiles: readonly GridTile[]) => {
		live = tiles.map(tile => ({ ...tile }));
		grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
		grid.dataset.columns = String(columns);
		for (const tile of live) {
			const el = elements.get(tile.id);
			if (!el) continue;
			position(el, tile);
			el.dataset.fixed = String(!!tile.fixed);
			for (const control of el.querySelectorAll<HTMLButtonElement>('[data-grid-action]')) control.disabled = columns !== CANONICAL_COLUMNS;
			el.querySelector('[data-grid-action="fit"]')?.setAttribute('aria-pressed', String(!tile.fixed));
		}
		grid.parentElement!.querySelector<HTMLElement>('.nand-immersive-projection')!.hidden = columns === CANONICAL_COLUMNS;
	};
	const say = (id: string) => {
		const tile = live.find(item => item.id === id);
		if (tile) liveRegion.textContent = t('renderer.tilePlace', { x: tile.x + 1, y: tile.y + 1, w: tile.w, h: tile.h });
	};
	const measure = () => {
		measuring = 0;
		if (closed || gesture) return;
		// Preserve saved caps and positions. Content fit is a disposable display copy.
		const fitted = canonical.map(tile => {
			if (tile.fixed) return tile;
			const el = elements.get(tile.id);
			const content = el?.querySelector<HTMLElement>('.nand-immersive-content');
			const chrome = el?.querySelector<HTMLElement>('.nand-immersive-toolbar');
			if (!content) return tile;
			const height = content.scrollHeight + (chrome?.offsetHeight ?? 32) + 2;
			return { ...tile, h: Math.min(tile.cap ?? tile.h, Math.max(tile.minH ?? 3, pixelsToRows(height))) };
		});
		const projection = projectLayout(fitted, grid.clientWidth);
		columns = projection.columns;
		paint(projection.display);
	};
	const scheduleMeasure = () => { if (!closed && !measuring) measuring = win.requestAnimationFrame(measure); };
	const stopFrame = () => { if (frame) win.cancelAnimationFrame(frame); frame = 0; };
	const finish = (commit: boolean) => {
		if (!gesture) return;
		stopFrame();
		const id = lifted!;
		const before = gesture.start, after = gesture.preview;
		const control = pointer?.control ?? elements.get(id)?.querySelector<HTMLElement>('[data-grid-action="move"]');
		const captured = pointer;
		gesture = null; lifted = null; pointer = null;
		ghost.hidden = true;
		grid.removeAttribute('data-dragging');
		for (const el of elements.values()) el.removeAttribute('data-lifted');
		if (captured?.control.hasPointerCapture?.(captured.id)) captured.control.releasePointerCapture(captured.id);
		const changed = JSON.stringify(before) !== JSON.stringify(after);
		if (commit && changed && columns === CANONICAL_COLUMNS) {
			// Save all swap participants, but restore the canonical height caps.
			canonical = after.map(tile => ({ ...tile, explicit: true }));
			paint(after);
			say(id);
			save(canonical);
		} else { paint(before); say(id); }
		control?.focus({ preventScroll: true });
		scheduleMeasure();
	};
	const pickup = (id: string) => {
		if (columns !== CANONICAL_COLUMNS) return false;
		if (gesture) finish(false);
		lifted = id;
		gesture = beginGesture(live);
		elements.get(id)?.setAttribute('data-lifted', 'true');
		say(id);
		return true;
	};
	const previewPointer = () => {
		if (!pointer || !gesture || !lifted) return;
		const dx = pointer.x - pointer.originX, dy = pointer.y - pointer.originY;
		if (!pointer.started && Math.hypot(dx, dy) < 5) return;
		pointer.started = true;
		grid.dataset.dragging = 'true';
		const tile = gesture.start.find(item => item.id === lifted)!;
		const y = pointer.y + scrollHost().scrollTop - pointer.scroll;
		const pitch = (grid.clientWidth + GRID_GAP_PX) / columns;
		const preview = pointer.mode === 'move' ? dropAtPointer(gesture.start, lifted, pointer.x, y, pointer.originX, pointer.originY, columns, pitch)
			: resizeTile(gesture.start, lifted, tile.w + Math.round(Math.round(dx / 8) * 8 / pitch), tile.h + Math.round(Math.round((y - pointer.originY) / 8) * 8 / GRID_ROW_PX), columns);
		gesture = previewGesture(gesture, preview);
		paint(preview);
		const target = preview.find(item => item.id === lifted)!;
		position(ghost, target); ghost.hidden = false;
		say(lifted);
	};
	const tick = () => {
		frame = 0;
		if (closed || !pointer || !gesture) return;
		if (!grid.isConnected) { finish(false); return; }
		pointer.started ||= Math.hypot(pointer.x - pointer.originX, pointer.y - pointer.originY) >= 5;
		let step = 0;
		if (pointer.started) {
			const host = scrollHost(), box = host.getBoundingClientRect();
			step = edgeScrollStep(pointer.y, box.top, box.height, host.scrollTop, Math.max(0, host.scrollHeight - host.clientHeight));
			host.scrollTop += step;
		}
		previewPointer();
		if (pointer?.started && step !== 0) frame = win.requestAnimationFrame(tick);
	};
	const requestFrame = () => { if (!frame) frame = win.requestAnimationFrame(tick); };
	const action = (event: Event) => {
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, [contenteditable="true"]')) return null;
		const control = target?.closest<HTMLElement>('[data-grid-action]');
		return control && grid.contains(control) ? control : null;
	};
	const down = (event: PointerEvent) => {
		const control = action(event), mode = control?.dataset.gridAction;
		if (event.button !== 0 || !control || (mode !== 'move' && mode !== 'resize') || control.hasAttribute('disabled')) return;
		const id = control.closest<HTMLElement>('[data-tile]')!.dataset.tile!;
		if (!pickup(id)) return;
		event.preventDefault(); event.stopPropagation(); control.focus({ preventScroll: true });
		pointer = { id: event.pointerId, control, mode, x: event.clientX, y: event.clientY, originX: event.clientX, originY: event.clientY, scroll: scrollHost().scrollTop, started: false };
		control.setPointerCapture(event.pointerId);
	};
	const move = (event: PointerEvent) => { if (!pointer || pointer.id !== event.pointerId) return; pointer.x = event.clientX; pointer.y = event.clientY; requestFrame(); };
	const up = (event: PointerEvent) => { if (!pointer || pointer.id !== event.pointerId) return; pointer.x = event.clientX; pointer.y = event.clientY; previewPointer(); finish(true); };
	const cancel = () => finish(false);
	const keyboard = (event: KeyboardEvent) => {
		if (event.key === 'Escape' && gesture) { event.preventDefault(); finish(false); return; }
		const control = action(event);
		if (!control || !['move', 'resize'].includes(control.dataset.gridAction ?? '')) return;
		const id = control.closest<HTMLElement>('[data-tile]')!.dataset.tile!;
		if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (lifted === id) finish(true); else pickup(id); return; }
		if (lifted !== id || !gesture) return;
		const dx = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
		const dy = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
		if (!dx && !dy) return;
		event.preventDefault();
		const tile = gesture.preview.find(item => item.id === id)!;
		const preview = event.shiftKey || control.dataset.gridAction === 'resize' ? resizeTile(gesture.preview, id, tile.w + dx, tile.h + dy, columns) : nudgeTile(gesture.preview, id, dx, dy, columns);
		gesture = previewGesture(gesture, preview); paint(preview); say(id);
	};
	const click = (event: MouseEvent) => {
		const control = action(event);
		if (control?.dataset.gridAction !== 'fit' || columns !== CANONICAL_COLUMNS) return;
		finish(false);
		const id = control.closest<HTMLElement>('[data-tile]')!.dataset.tile!;
		canonical = canonical.map(tile => tile.id === id ? { ...tile, fixed: !tile.fixed } : tile);
		save(canonical); scheduleMeasure();
	};
	grid.addEventListener('pointerdown', down); grid.addEventListener('pointermove', move); grid.addEventListener('pointerup', up);
	grid.addEventListener('pointercancel', cancel); grid.addEventListener('lostpointercapture', cancel); grid.addEventListener('keydown', keyboard); grid.addEventListener('click', click);
	win.addEventListener('blur', cancel);
	const Observer = (win as Window & { ResizeObserver: typeof ResizeObserver }).ResizeObserver;
	const observer = new Observer(() => {
		// A move can remove the vertical scrollbar and change width by a few pixels.
		// Only a change of grid columns invalidates the captured gesture geometry.
		if (gesture && effectiveColumns(grid.clientWidth) !== columns) finish(false);
		scheduleMeasure();
	});
	observer.observe(grid);
	for (const el of elements.values()) { const body = el.querySelector<HTMLElement>('.nand-immersive-content'); if (body) observer.observe(body); }
	measure();
	return () => {
		closed = true; finish(false); stopFrame(); observer.disconnect();
		if (measuring) win.cancelAnimationFrame(measuring);
		grid.removeEventListener('pointerdown', down); grid.removeEventListener('pointermove', move); grid.removeEventListener('pointerup', up);
		grid.removeEventListener('pointercancel', cancel); grid.removeEventListener('lostpointercapture', cancel); grid.removeEventListener('keydown', keyboard); grid.removeEventListener('click', click);
		win.removeEventListener('blur', cancel);
	};
}
