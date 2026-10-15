// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/browser-pane/annotate/MarkupOverlay.tsx and MarkupToolbar.tsx. Drawing uses NAND's existing core/markup-model.
import { useLayoutEffect, useRef, useState } from 'react';
import {
	canRedo,
	clearShapes,
	canUndo,
	commitShape,
	createMarkupDocument,
	MARKUP_COLORS,
	normalizeRect,
	redoShape,
	undoShape,
	arrowHeadGeometry,
	highlightWidth,
	type MarkupPoint,
	type MarkupShape,
	type MarkupTool,
} from '../../core/markup-model';
import { MarkupToolbar } from './MarkupToolbar';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import { t } from '../../../../shared/i18n';

export function drawMarkup(context: CanvasRenderingContext2D, shapes: MarkupShape[]): void {
	for (const shape of shapes) {
		context.save();
		context.strokeStyle = shape.color;
		context.fillStyle = shape.color;
		context.lineCap = 'round';
		context.lineJoin = 'round';
		if (shape.kind === 'text') {
			context.font = `${shape.fontSize}px sans-serif`;
			context.fillText(shape.text, shape.at.x, shape.at.y);
			context.restore();
			continue;
		}
		context.lineWidth = shape.width;
		context.beginPath();
		if (shape.kind === 'pen' || shape.kind === 'highlight') {
			if (shape.kind === 'highlight') {
				context.globalAlpha = 0.35;
				context.lineWidth = highlightWidth(shape.width);
			}
			shape.points.forEach((p, index) => (index ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y)));
			context.stroke();
		} else if (shape.kind === 'rect' || shape.kind === 'ellipse') {
			const r = normalizeRect(shape.from, shape.to);
			if (shape.kind === 'rect') context.strokeRect(r.x, r.y, r.width, r.height);
			else {
				context.ellipse(r.x + r.width / 2, r.y + r.height / 2, r.width / 2, r.height / 2, 0, 0, Math.PI * 2);
				context.stroke();
			}
		} else {
			context.moveTo(shape.from.x, shape.from.y);
			context.lineTo(shape.to.x, shape.to.y);
			context.stroke();
			const head = arrowHeadGeometry(shape.from, shape.to, shape.width);
			if (head) {
				context.beginPath();
				context.moveTo(head.left.x, head.left.y);
				context.lineTo(head.tip.x, head.tip.y);
				context.lineTo(head.right.x, head.right.y);
				context.stroke();
			}
		}
		context.restore();
	}
}
export function MarkupPanel({
	data,
	viewportWidth,
	finish,
	close,
}: {
	data: string;
	viewportWidth: number;
	finish: (data: string) => void;
	close: () => void;
}) {
	const canvas = useRef<HTMLCanvasElement>(null),
		image = useRef<HTMLImageElement | undefined>(undefined);
	const [doc, setDoc] = useState(createMarkupDocument),
		[tool, setTool] = useState<MarkupTool>('pen');
	const [color, setColor] = useState<string>(MARKUP_COLORS[0]),
		[width, setWidth] = useState(4),
		[label, setLabel] = useState(''),
		[fontSize, setFontSize] = useState(18);
	const [draft, setDraft] = useState<MarkupShape | null>(null),
		draftRef = useRef<MarkupShape | null>(null);
	const [imageReady, setImageReady] = useState(false);
	useLayoutEffect(() => {
		const c = canvas.current,
			img = image.current,
			ctx = c?.getContext('2d');
		if (!c || !img || !ctx || !img.complete || !img.naturalWidth) return;
		c.width = img.naturalWidth;
		c.height = img.naturalHeight;
		ctx.drawImage(img, 0, 0);
		ctx.save();
		ctx.scale(c.width / viewportWidth, c.width / viewportWidth);
		drawMarkup(ctx, draft ? [...doc.shapes, draft] : doc.shapes);
		ctx.restore();
	}, [doc, draft, viewportWidth, imageReady]);

	useLayoutEffect(() => {
		const c = canvas.current;
		if (!c) return;
		// Obsidian createEl appends to its receiver; this image must remain detached.
		const img = c.doc.createElement('img');
		image.current = img;
		img.onload = () => {
			setImageReady(true);
		};
		img.src = data;
		return () => {
			img.onload = null;
			image.current = undefined;
		};
	}, [data]);
	const point = (event: { clientX: number; clientY: number }): MarkupPoint => {
		const rect = canvas.current!.getBoundingClientRect();
		return {
			x: ((event.clientX - rect.left) * viewportWidth) / rect.width,
			y: ((event.clientY - rect.top) * viewportWidth) / rect.width,
		};
	};
	const update = (value: MarkupShape | null) => {
		draftRef.current = value;
		setDraft(value);
	};
	return (
		<div className="relative flex h-full min-h-0 flex-col overflow-hidden">
			<div className="absolute inset-x-3 bottom-3 z-20 flex flex-col items-center gap-2">
				<MarkupToolbar
					tool={tool}
					onToolChange={setTool}
					color={color}
					onColorChange={setColor}
					width={width}
					onWidthChange={setWidth}
					fontSize={fontSize}
					onFontSizeChange={setFontSize}
					canUndo={canUndo(doc)}
					canRedo={canRedo(doc)}
					onUndo={() => setDoc(undoShape(doc))}
					onRedo={() => setDoc(redoShape(doc))}
					onClear={() => setDoc(clearShapes(doc))}
				/>
				<div className="flex items-center gap-2 rounded-md border border-border bg-card/95 p-1 shadow-md backdrop-blur">
					{tool === 'text' && (
						<Input
							aria-label={t('browser.textValue')}
							value={label}
							onChange={(e) => setLabel(e.currentTarget.value)}
						/>
					)}
					<Button size="sm" variant="ghost" onClick={close}>
						{t('browser.cancel')}
					</Button>
					<Button
						size="sm"
						disabled={!imageReady}
						onClick={() => {
							if (canvas.current) finish(canvas.current.toDataURL('image/png'));
						}}
					>
						{t('browser.drawDone')}
					</Button>
				</div>
			</div>
			<div className="min-h-0 flex-1 overflow-auto">
				<canvas
					className="max-w-full touch-none"
					ref={canvas}
					data-ready={imageReady}
					onPointerDown={(e) => {
						if (!imageReady) return;
						e.currentTarget.setPointerCapture(e.pointerId);
						const p = point(e),
							id = crypto.randomUUID();
						if (tool === 'text') {
							if (label)
								setDoc(commitShape(doc, { kind: 'text', id, color, at: p, text: label, fontSize }));
							return;
						}
						update(
							tool === 'pen' || tool === 'highlight'
								? { kind: tool, id, color, width, points: [p] }
								: { kind: tool, id, color, width, from: p, to: p },
						);
					}}
					onPointerMove={(e) => {
						const shape = draftRef.current;
						if (!shape) return;
						const p = point(e);
						update(
							shape.kind === 'pen' || shape.kind === 'highlight'
								? { ...shape, points: [...shape.points, p] }
								: shape.kind === 'text'
									? shape
									: { ...shape, to: p },
						);
					}}
					onPointerUp={() => {
						if (draftRef.current) setDoc(commitShape(doc, draftRef.current));
						update(null);
					}}
					onPointerCancel={() => update(null)}
				/>
			</div>
		</div>
	);
}
