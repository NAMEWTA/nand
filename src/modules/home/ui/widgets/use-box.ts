import { useEffect, useRef, useState, type RefObject } from 'react';

export interface Box {
	width: number;
	height: number;
}

/**
 * The content box of an element, kept current with a ResizeObserver of the element's own window. Widgets choose their
 * layout from it, so a tile adapts to whatever size it was given, whether by tier or by a free resize.
 */
export function useBox<T extends HTMLElement>(initial: Box = { width: 0, height: 0 }): [RefObject<T | null>, Box] {
	const ref = useRef<T>(null),
		[box, setBox] = useState(initial);
	useEffect(() => {
		const el = ref.current,
			win = el?.ownerDocument.defaultView;
		if (!el || !win?.ResizeObserver) return;
		const measure = () => {
			const next = { width: el.clientWidth, height: el.clientHeight };
			setBox((prev) => (prev.width === next.width && prev.height === next.height ? prev : next));
		};
		measure();
		const observer = new win.ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);
	return [ref, box];
}
