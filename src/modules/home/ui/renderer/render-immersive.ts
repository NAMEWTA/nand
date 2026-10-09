import { setLocalizedText } from '../../../../ui/primitives/localized-dom';
import { t } from '../../../../shared/i18n';
import { cardTiles } from '../../core/board/board-grid';
import type { DashboardData } from '../../core/board/types/index';
import {
	beginGesture,
	cancelGesture,
	CANONICAL_COLUMNS,
	commitGesture,
	dropAtPointer,
	edgeScrollStep,
	GRID_GAP_PX,
	GRID_ROW_PX,
	nudgeTile,
	previewGesture,
	projectLayout,
	resizeTile,
	type GridTile,
	type LayoutGesture,
} from '../../core/board/immersive-grid';
import type { RenderCallbacks } from '../render-contract';

const pitch = GRID_ROW_PX + GRID_GAP_PX;

/** One immersive board: the shared grid engine places tiles; a narrow width only changes the copy on screen. */
export function renderImmersiveBoard(container: HTMLElement, data: DashboardData, callbacks: RenderCallbacks): void {
	const cards = data.columns.flatMap((column) => column.cards);
	const projected = projectLayout(cardTiles(cards), container.clientWidth || 960);
	const canonical = projected.columns === CANONICAL_COLUMNS;
	const grid = container.createDiv({ cls: 'nand-immersive-grid' });
	grid.tabIndex = 0;
	grid.style.gridTemplateColumns = `repeat(${projected.columns}, minmax(0, 1fr))`;
	const liveRegion = grid.createDiv({
		cls: 'nand-immersive-live nand-visually-hidden',
		attr: { role: 'status', 'aria-live': 'polite' },
	});
	let gesture: LayoutGesture = beginGesture(projected.display);
	let live = projected.display.map((tile) => ({ ...tile }));
	let active: {
		id: string;
		mode: 'move' | 'resize';
		x: number;
		y: number;
		originX: number;
		originY: number;
		originScroll: number;
	} | null = null;
	let lifted: string | null = null;
	let frame = 0;

	const view = () => grid.ownerDocument.defaultView;
	const scrollHost = (): HTMLElement => grid.closest('.dashboard-scroll-region') ?? grid.parentElement ?? grid;
	const say = (id: string) => {
		const tile = live.find((item) => item.id === id);
		if (!tile) return;
		liveRegion.textContent = t('renderer.tilePlace', { x: tile.x, y: tile.y, w: tile.w, h: tile.h });
	};
	const paint = (tiles: readonly GridTile[]) => {
		live = tiles.map((tile) => ({ ...tile }));
		for (const tile of live) {
			const el = grid.querySelector<HTMLElement>(`[data-tile="${CSS.escape(tile.id)}"]`);
			if (!el) continue;
			el.style.gridColumn = `${tile.x} / span ${tile.w}`;
			el.style.gridRow = `${tile.y} / span ${tile.h}`;
		}
	};
	const stopScroll = () => {
		const win = view();
		if (frame && win) win.cancelAnimationFrame(frame);
		frame = 0;
	};
	const previewAt = () => {
		const current = active;
		if (!current) return;
		const host = scrollHost();
		const scrolled = host.scrollTop - current.originScroll;
		const pointerY = current.y + scrolled;
		const preview =
			current.mode === 'move'
				? dropAtPointer(
						gesture.start,
						current.id,
						current.x,
						pointerY,
						current.originX,
						current.originY,
						projected.columns,
					)
				: resizeTile(
						gesture.start,
						current.id,
						(gesture.start.find((item) => item.id === current.id)?.w ?? 1) +
							Math.round((current.x - current.originX) / pitch),
						(gesture.start.find((item) => item.id === current.id)?.h ?? 1) +
							Math.round((pointerY - current.originY) / pitch),
						projected.columns,
					);
		gesture = previewGesture(gesture, preview);
		paint(preview);
		say(current.id);
	};
	const tick = () => {
		frame = 0;
		if (!active || !grid.isConnected) return;
		const host = scrollHost();
		const box = host.getBoundingClientRect();
		const max = Math.max(0, host.scrollHeight - host.clientHeight);
		const step = edgeScrollStep(active.y, box.top, box.height, host.scrollTop, max);
		if (step === 0) return;
		host.scrollTop += step;
		previewAt();
		const win = view();
		if (active && grid.isConnected && win) frame = win.requestAnimationFrame(tick);
	};
	const armScroll = () => {
		if (frame || !active) return;
		const win = view();
		if (!win) return;
		frame = win.requestAnimationFrame(tick);
	};
	const restore = () => {
		stopScroll();
		const id = lifted ?? active?.id ?? null;
		const cancelled = cancelGesture(gesture);
		gesture = beginGesture(cancelled.tiles);
		lifted = null;
		active = null;
		paint(cancelled.tiles);
		if (id) say(id);
	};
	const commit = (id: string) => {
		stopScroll();
		const done = commitGesture(gesture);
		const before = gesture.start.find((tile) => tile.id === id);
		const after = done.tiles.find((tile) => tile.id === id);
		gesture = beginGesture(done.tiles);
		lifted = null;
		active = null;
		paint(done.tiles);
		say(id);
		if (!canonical || !before || !after) return;
		if (after.x !== before.x || after.y !== before.y) callbacks.onCardGridMove(id, after.x, after.y);
		else if (after.w !== before.w || after.h !== before.h) callbacks.onCardGridChange(id, after.w, after.h);
	};

	for (const tile of projected.display) {
		const card = cards.find((item) => item.id === tile.id);
		const el = grid.createDiv({ cls: 'nand-immersive-tile' });
		el.dataset.tile = tile.id;
		el.style.gridColumn = `${tile.x} / span ${tile.w}`;
		el.style.gridRow = `${tile.y} / span ${tile.h}`;
		const grip = el.createEl('button', { cls: 'nand-immersive-grip', attr: { type: 'button' } });
		grip.textContent = card?.title || tile.id;
		const resize = el.createEl('button', { cls: 'nand-immersive-resize', attr: { type: 'button' } });
		setLocalizedText(resize, 'renderer.resizeTile');
		resize.setAttribute('aria-label', t('renderer.resizeTile'));

		const start = (event: PointerEvent, mode: 'move' | 'resize') => {
			if (event.button !== 0 || event.target !== event.currentTarget) return;
			event.preventDefault();
			event.stopPropagation();
			lifted = tile.id;
			active = {
				id: tile.id,
				mode,
				x: event.clientX,
				y: event.clientY,
				originX: event.clientX,
				originY: event.clientY,
				originScroll: scrollHost().scrollTop,
			};
			gesture = beginGesture(live);
			(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
			say(tile.id);
		};
		grip.addEventListener('pointerdown', (event) => start(event, 'move'));
		resize.addEventListener('pointerdown', (event) => start(event, 'resize'));
		const move = (event: PointerEvent) => {
			if (!active || active.id !== tile.id) return;
			active = { ...active, x: event.clientX, y: event.clientY };
			previewAt();
			armScroll();
		};
		grip.addEventListener('pointermove', move);
		resize.addEventListener('pointermove', move);
		const end = (commitMove: boolean) => {
			if (!active || active.id !== tile.id) return;
			if (commitMove) commit(tile.id);
			else restore();
		};
		grip.addEventListener('pointerup', () => end(true));
		resize.addEventListener('pointerup', () => end(true));
		grip.addEventListener('pointercancel', () => end(false));
		resize.addEventListener('pointercancel', () => end(false));
	}

	grid.addEventListener('keydown', (event) => {
		const id =
			lifted ??
			(event.target as HTMLElement | null)?.closest?.('[data-tile]')?.getAttribute('data-tile') ??
			undefined;
		if (!id) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			restore();
			return;
		}
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			if (lifted === id) commit(id);
			else {
				lifted = id;
				gesture = beginGesture(live);
				say(id);
			}
			return;
		}
		if (lifted !== id) return;
		const key = event.key;
		const dx = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0;
		const dy = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0;
		if (dx === 0 && dy === 0) return;
		event.preventDefault();
		const preview = event.shiftKey
			? resizeTile(
					gesture.preview,
					id,
					(gesture.preview.find((tile) => tile.id === id)?.w ?? 1) + dx,
					(gesture.preview.find((tile) => tile.id === id)?.h ?? 1) + dy,
					projected.columns,
				)
			: nudgeTile(gesture.preview, id, dx, dy, projected.columns);
		gesture = previewGesture(gesture, preview);
		paint(preview);
		say(id);
	});
}
