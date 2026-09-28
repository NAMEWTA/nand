import type { HabitService } from '../../../platform/obsidian/habit/habit-service';
const TOUCH_DRAG_MS = 200;
const TOUCH_CANCEL_PX = 10;
function dropHalf(e: { clientY: number }, card: HTMLElement): 'top' | 'bottom' {
	const rect = card.getBoundingClientRect();
	return e.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom';
}

function indicateDrop(body: HTMLElement, card: HTMLElement, half: 'top' | 'bottom'): void {
	clearDropIndicators(body);
	card.addClass(
		half === 'top' ? 'dashboard-habit-stats-card--drop-before' : 'dashboard-habit-stats-card--drop-after',
	);
}

function clearDropIndicators(body: HTMLElement): void {
	body.querySelectorAll('.dashboard-habit-stats-card--drop-before, .dashboard-habit-stats-card--drop-after').forEach(
		(el) =>
			el.classList.remove('dashboard-habit-stats-card--drop-before', 'dashboard-habit-stats-card--drop-after'),
	);
}

/**
 * Grip-gated HTML5 drag (desktop): dragging arms only while the grip is held,
 * so rename/delete stay clickable; the hovered card's half decides the insert
 * slot. Committing calls service.moveHabit, whose notify fan-out re-renders
 * the overlay — the same path rename and delete already take.
 */
function cardAtPoint(body: HTMLElement, x: number, y: number): HTMLElement | null {
	const cards = Array.from(body.querySelectorAll<HTMLElement>('.dashboard-habit-stats-card'));
	for (const c of cards) {
		if (c.hasClass('dashboard-habit-stats-card--dragging')) continue;
		const rect = c.getBoundingClientRect();
		if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return c;
	}
	return null;
}

/** Clone following the dragged card under the finger (mobile). Appended to
 *  the overlay — not doc.body — so the clone keeps the theme's --db-* vars. */
function createCardGhost(card: HTMLElement, x: number, y: number): HTMLElement {
	const ghost = card.cloneNode(true) as HTMLElement;
	ghost.addClass('dashboard-habit-stats-card--ghost');
	ghost.setCssProps({
		position: 'fixed',
		width: `${card.offsetWidth}px`,
		left: `${x - card.offsetWidth / 2}px`,
		top: `${y - card.offsetHeight / 2}px`,
		zIndex: '9999',
		pointerEvents: 'none',
		opacity: '0.85',
		transform: 'rotate(2deg)',
	});
	const host = card.closest('.dashboard-habit-stats-modal') ?? card.ownerDocument.body;
	host.appendChild(ghost);
	return ghost;
}

/**
 * Long-press drag on the card head (mobile): HTML5 DnD never fires from a
 * touch, so the grip-less path reuses the card-DnD ghost convention. A short
 * press stays a plain tap; moving TOUCH_CANCEL_PX before the timer fires is
 * read as a scroll and cancels the drag before it starts.
 */
export function wireCardTouchDrag(
	body: HTMLElement,
	card: HTMLElement,
	index: number,
	service: HabitService,
): () => void {
	const win = card.ownerDocument.defaultView!;
	let ghost: HTMLElement | null = null;
	let startX = 0;
	let startY = 0;
	let isDragging = false;
	let timer: number | null = null;

	const cleanupDrag = (): void => {
		if (ghost) {
			ghost.remove();
			ghost = null;
		}
		card.removeClass('dashboard-habit-stats-card--dragging');
		clearDropIndicators(body);
		isDragging = false;
	};

	const onTouchStart = (e: TouchEvent) => {
		const t0 = e.touches[0];
		if (!t0) return;
		// Only the head row starts a drag; icon buttons handle their own taps.
		const target = e.target as HTMLElement;
		if (!target.closest('.dashboard-habit-stats-card-head')) return;
		if (target.closest('.dashboard-habit-stats-icon-btn')) return;

		startX = t0.clientX;
		startY = t0.clientY;
		isDragging = false;

		timer = win.setTimeout(() => {
			isDragging = true;
			ghost = createCardGhost(card, startX, startY);
			card.addClass('dashboard-habit-stats-card--dragging');
		}, TOUCH_DRAG_MS);
	};

	const onTouchMove = (e: TouchEvent) => {
		if (!isDragging) {
			if (timer) {
				const t = e.touches[0];
				if (!t) return;
				if (Math.abs(t.clientX - startX) > TOUCH_CANCEL_PX || Math.abs(t.clientY - startY) > TOUCH_CANCEL_PX) {
					win.clearTimeout(timer);
					timer = null;
				}
			}
			return;
		}

		e.preventDefault();
		const t = e.touches[0];
		if (!t) return;

		if (ghost) {
			ghost.style.left = `${t.clientX - ghost.offsetWidth / 2}px`;
			ghost.style.top = `${t.clientY - ghost.offsetHeight / 2}px`;
		}

		const target = cardAtPoint(body, t.clientX, t.clientY);
		if (target) {
			indicateDrop(body, target, dropHalf(t, target));
		} else {
			clearDropIndicators(body);
		}
	};

	const onTouchEnd = (e: TouchEvent) => {
		if (timer) {
			win.clearTimeout(timer);
			timer = null;
		}
		if (!isDragging) return;

		const t = e.changedTouches[0];
		cleanupDrag();
		if (!t) return;

		const target = cardAtPoint(body, t.clientX, t.clientY);
		if (!target) return;
		const toIndex = Number(target.dataset.index ?? '-1');
		if (toIndex < 0) return;
		const to = dropHalf(t, target) === 'top' ? toIndex : toIndex + 1;
		if (index !== to) service.moveHabit(index, to);
	};

	// touchcancel fires on system interruptions (edge gestures, scroll hijack,
	// notifications) instead of touchend; without it the ghost strands on screen.
	const onTouchCancel = () => {
		if (timer) {
			win.clearTimeout(timer);
			timer = null;
		}
		cleanupDrag();
	};

	card.addEventListener('touchstart', onTouchStart, { passive: true });
	card.addEventListener('touchmove', onTouchMove, { passive: false });
	card.addEventListener('touchend', onTouchEnd, { passive: true });
	card.addEventListener('touchcancel', onTouchCancel, { passive: true });
	return () => {
		onTouchCancel();
		card.removeEventListener('touchstart', onTouchStart);
		card.removeEventListener('touchmove', onTouchMove);
		card.removeEventListener('touchend', onTouchEnd);
		card.removeEventListener('touchcancel', onTouchCancel);
	};
}
