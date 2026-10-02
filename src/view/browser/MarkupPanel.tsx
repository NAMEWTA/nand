import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import {
	canRedo,
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
} from '../../core/browser/markup-model';
import { t } from '../../shared/i18n';

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
		image = useRef<HTMLImageElement>();
	const [doc, setDoc] = useState(createMarkupDocument),
		[tool, setTool] = useState<MarkupTool>('pen');
	const [color, setColor] = useState<string>(MARKUP_COLORS[0]),
		[width, setWidth] = useState(4),
		[label, setLabel] = useState('');
	const [draft, setDraft] = useState<MarkupShape | null>(null),
		draftRef = useRef<MarkupShape | null>(null);
	const [imageReady, setImageReady] = useState(false);
	const redraw = () => {
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
	};
	useLayoutEffect(() => {
		const c = canvas.current;
		if (!c) return;
		// Obsidian createEl appends to its receiver; this image must remain detached.
		const img = c.doc.createElement('img');
		image.current = img;
		setImageReady(false);
		img.onload = () => {
			redraw();
			setImageReady(true);
		};
		img.src = data;
		return () => {
			img.onload = null;
			image.current = undefined;
		};
	}, [data]);
	useLayoutEffect(redraw, [doc, draft]);
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
		<div class="nand-browser-overlay nand-browser-markup">
			<div class="nand-ui-toolbar nand-browser-markup-tools">
				{(['pen', 'highlight', 'arrow', 'rect', 'ellipse', 'text'] as const).map((kind) => (
					<button
						class={`nand-ui-btn-ghost${tool === kind ? ' is-active' : ''}`}
						aria-pressed={tool === kind}
						onClick={() => setTool(kind)}
					>
						{t(`browser.${kind}`)}
					</button>
				))}
				<select aria-label={t('browser.ink')} value={color} onChange={(e) => setColor(e.currentTarget.value)}>
					{MARKUP_COLORS.map((value) => (
						<option value={value}>{value}</option>
					))}
				</select>
				<select
					aria-label={t('browser.width')}
					value={width}
					onChange={(e) => setWidth(Number(e.currentTarget.value))}
				>
					{[2, 4, 8].map((value) => (
						<option value={value}>{value}</option>
					))}
				</select>
				{tool === 'text' && (
					<input
						aria-label={t('browser.textValue')}
						value={label}
						onInput={(e) => setLabel(e.currentTarget.value)}
					/>
				)}
				<button class="nand-ui-btn-ghost" disabled={!canUndo(doc)} onClick={() => setDoc(undoShape(doc))}>
					{t('browser.undo')}
				</button>
				<button class="nand-ui-btn-ghost" disabled={!canRedo(doc)} onClick={() => setDoc(redoShape(doc))}>
					{t('browser.redo')}
				</button>
				<button class="nand-ui-btn-ghost" onClick={close}>
					{t('browser.cancel')}
				</button>
				<button
					class="nand-ui-btn mod-cta"
					disabled={!imageReady}
					onClick={() => {
						if (canvas.current) finish(canvas.current.toDataURL('image/png'));
					}}
				>
					{t('browser.copyImage')}
				</button>
			</div>
			<div class="nand-browser-markup-canvas">
				<canvas
					ref={canvas}
					data-ready={imageReady}
					onPointerDown={(e) => {
						if (!imageReady) return;
						e.currentTarget.setPointerCapture(e.pointerId);
						const p = point(e),
							id = crypto.randomUUID();
						if (tool === 'text') {
							if (label)
								setDoc(commitShape(doc, { kind: 'text', id, color, at: p, text: label, fontSize: 24 }));
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
