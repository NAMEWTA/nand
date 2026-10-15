// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/drag-guard.ts, src/view.ts
import { useRef } from 'react';
import { Button } from '../../../../ui/components/button';
export function ResizeHandle({
	value,
	min,
	max,
	axis,
	label,
	className,
	scale = 1,
	onPreview,
	onCommit,
}: {
	value: number | (() => number);
	min: number;
	max: number;
	axis: 'x' | 'y';
	label: string;
	className: string;
	scale?: number | (() => number);
	onPreview(this: void, value: number): void;
	onCommit(this: void, value: number): void;
}) {
	const drag = useRef<{ start: number; value: number; next: number } | null>(null);
	const currentValue = () => (typeof value === 'function' ? value() : value);
	const currentScale = () => (typeof scale === 'function' ? scale() : scale);
	const clamp = (n: number) => Math.round(Math.min(max, Math.max(min, n)));
	return (
		<Button
			variant="ghost"
			size="icon-xs"
			aria-label={label}
			className={`touch-none p-0 ${className}`}
			onPointerDown={(e) => {
				drag.current = {
					start: axis === 'x' ? e.clientX : e.clientY,
					value: currentValue(),
					next: currentValue(),
				};
				e.currentTarget.setPointerCapture(e.pointerId);
			}}
			onPointerMove={(e) => {
				const d = drag.current;
				if (!d) return;
				d.next = clamp(d.value + ((axis === 'x' ? e.clientX : e.clientY) - d.start) * currentScale());
				onPreview(d.next);
			}}
			onPointerUp={(e) => {
				const d = drag.current;
				drag.current = null;
				e.currentTarget.releasePointerCapture(e.pointerId);
				if (d && d.next !== d.value) onCommit(d.next);
			}}
			onPointerCancel={() => {
				const previous = drag.current?.value ?? currentValue();
				drag.current = null;
				onPreview(previous);
			}}
			onKeyDown={(e) => {
				const delta = ['ArrowRight', 'ArrowDown'].includes(e.key)
					? 8
					: ['ArrowLeft', 'ArrowUp'].includes(e.key)
						? -8
						: 0;
				if (!delta) return;
				e.preventDefault();
				const next = clamp(currentValue() + delta);
				onPreview(next);
				onCommit(next);
			}}
		/>
	);
}
