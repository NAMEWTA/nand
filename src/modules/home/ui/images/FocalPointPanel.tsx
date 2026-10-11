import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { TargetedPointerEvent } from 'preact';
import { t } from '../../../../shared/i18n';
import { Button } from '../../../../ui/primitives/Button';
import { TextField } from '../../../../ui/primitives/TextField';
import { displayFocal, type FocalPoint } from '../../core/board/board-experience';
import { displayedFocalPoint } from '../../core/board/focal-point';

export interface FocalPointOptions {
	source: string | null;
	value: unknown;
	ratio: number;
	change: (point: FocalPoint) => void;
	captureEscape?: (cancel: () => void) => () => void;
}

export function FocalPointPanel({ source, value, ratio, change, captureEscape }: FocalPointOptions) {
	const [preview, setPreview] = useState<FocalPoint | null>(null);
	const pointer = useRef<number | null>(null);
	const releaseEscape = useRef<(() => void) | undefined>(undefined);
	useLayoutEffect(() => () => releaseEscape.current?.(), []);
	const point = preview ?? displayedFocalPoint(value);
	const fromPointer = (event: TargetedPointerEvent<HTMLButtonElement>): FocalPoint => {
		const rect = event.currentTarget.getBoundingClientRect();
		return displayFocal({ x: (event.clientX - rect.left) / rect.width * 100, y: (event.clientY - rect.top) / rect.height * 100 });
	};
	const cancel = () => { pointer.current = null; setPreview(null); releaseEscape.current?.(); releaseEscape.current = undefined; };
	return <div class="nand-ui-stack nand-focal-editor">
		<p class="nand-field-hint">{t('focal.hint')}</p>
		<button type="button" class="nand-focal-preview" disabled={!source}
			aria-label={t('focal.preview', { x: String(point.x), y: String(point.y) })}
			style={{ aspectRatio: String(ratio), backgroundImage: source ? `url(${JSON.stringify(source)})` : undefined, backgroundPosition: `${point.x}% ${point.y}%` }}
			onPointerDown={event => {
				if (!source || event.button !== 0 || pointer.current !== null) return;
				event.preventDefault(); event.stopPropagation(); event.currentTarget.focus();
				pointer.current = event.pointerId;
				releaseEscape.current = captureEscape?.(cancel);
				event.currentTarget.setPointerCapture(event.pointerId);
				setPreview(fromPointer(event));
			}}
			onPointerMove={event => { if (pointer.current === event.pointerId) setPreview(fromPointer(event)); }}
			onPointerUp={event => {
				if (pointer.current !== event.pointerId) return;
				const next = fromPointer(event);
				cancel(); event.currentTarget.releasePointerCapture(event.pointerId); change(next);
			}}
			onPointerCancel={cancel}
			onLostPointerCapture={cancel}
			onKeyDown={event => {
				if (event.key === 'Escape' && pointer.current !== null) { event.preventDefault(); event.stopPropagation(); cancel(); return; }
				const delta = event.shiftKey ? 10 : 1;
				const step = { ArrowLeft: [-delta, 0], ArrowRight: [delta, 0], ArrowUp: [0, -delta], ArrowDown: [0, delta] }[event.key];
				if (!step) return;
				event.preventDefault(); event.stopPropagation();
				change(displayFocal({ x: point.x + step[0]!, y: point.y + step[1]! }));
			}}>
			{source ? <span class="nand-focal-marker" style={{ left: `${point.x}%`, top: `${point.y}%` }} aria-hidden="true" /> : t('focal.noImage')}
		</button>
		<div class="nand-focal-axes">
			{(['x', 'y'] as const).map(axis => <TextField key={axis} label={t(axis === 'x' ? 'focal.horizontal' : 'focal.vertical')} type="number" value={String(point[axis])} disabled={!source}
				onInput={raw => { const next = Number(raw); if (Number.isFinite(next)) change(displayFocal({ ...point, [axis]: next })); }} />)}
		</div>
		<Button disabled={!source} onClick={() => change({ x: 50, y: 50 })}>{t('focal.reset')}</Button>
	</div>;
}
