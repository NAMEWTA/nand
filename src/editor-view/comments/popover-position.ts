export interface PopoverRect {
	left: number;
	right: number;
	top: number;
	bottom: number;
}

export function intersectRects(...rects: PopoverRect[]): PopoverRect | null {
	const rect = {
		left: Math.max(...rects.map((r) => r.left)),
		right: Math.min(...rects.map((r) => r.right)),
		top: Math.max(...rects.map((r) => r.top)),
		bottom: Math.min(...rects.map((r) => r.bottom)),
	};
	return rect.right > rect.left && rect.bottom > rect.top ? rect : null;
}

export function placePopover(anchor: PopoverRect, bounds: PopoverRect, width: number, height: number): { left: number; top: number } | null {
	const gap = 8;
	if (width > bounds.right - bounds.left - gap * 2 || height > bounds.bottom - bounds.top - gap * 2) return null;
	const above = anchor.top - height - gap;
	const top = above >= bounds.top + gap ? above : anchor.bottom + gap;
	return {
		left: Math.max(bounds.left + gap, Math.min(anchor.left, bounds.right - width - gap)),
		top: Math.max(bounds.top + gap, Math.min(top, bounds.bottom - height - gap)),
	};
}
