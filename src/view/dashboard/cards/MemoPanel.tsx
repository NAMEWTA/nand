import { Component, MarkdownRenderer } from 'obsidian';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { extractCardParts } from '../../../core/dashboard/parser/index';
import { memoCardText } from '../../../platform/obsidian/dashboard/card-move';
import { t } from '../../../shared/i18n/index';
import { memoMarkdownSource, wireMemoMarkdownLinks } from '../renderer/memo-markdown-source';
import { bindRenderContext } from '../renderer/render-context';
import { InlineLinks } from './InlineLinks';
import type { CardBodyProps } from './TaskPanel';
import { useFileSuggest } from './card-interactions';

/** The native renderer owns only this empty DOM island and a child Component. */
function MemoPreview({ text, app, context }: Pick<CardBodyProps, 'app' | 'context'> & { text: string }) {
	const native = useRef<HTMLDivElement>(null);
	const [rendered, setRendered] = useState(false);
	useLayoutEffect(() => {
		const host = native.current;
		const parent = context.markdownComponent;
		setRendered(false);
		if (!host || !parent || !text) return;
		const component = parent.addChild(new Component());
		const output = host.ownerDocument.createElement('div');
		let disposed = false;
		bindRenderContext(host, context);
		void MarkdownRenderer.render(app, memoMarkdownSource(text), output, '', component)
			.then(() => {
				if (disposed || !output.hasChildNodes()) return;
				host.replaceChildren(...Array.from(output.childNodes));
				wireMemoMarkdownLinks(host, app);
				setRendered(true);
			})
			.catch(() => {
				/* The synchronous fallback remains visible. */
			});
		return () => {
			disposed = true;
			parent.removeChild(component);
			host.replaceChildren();
		};
	}, [text, app, context]);
	return (
		<>
			<div ref={native} class="dashboard-memo-view--md" style={{ display: rendered ? '' : 'none' }} />
			{!rendered &&
				(text
					? text.split('\n').map((line, index) => (
							<>
								{index > 0 && <br />}
								{line.startsWith('> ') ? (
									<div class="dashboard-note-quote">{line.slice(2)}</div>
								) : (
									<InlineLinks text={line} app={app} context={context} />
								)}
							</>
						))
					: t('renderer.writeThoughts'))}
		</>
	);
}
export function MemoPanel({ card, app, callbacks, context }: CardBodyProps) {
	const initial = memoCardText(card);
	const [text, setText] = useState(initial);
	const [editing, setEditing] = useState(false);
	const { input } = useFileSuggest<HTMLTextAreaElement>(app);
	useLayoutEffect(() => {
		setText(initial);
		if (input.current && !editing) input.current.value = initial;
	}, [initial]);
	useLayoutEffect(() => {
		if (editing && input.current) {
			input.current.value = text;
			input.current.focus();
		}
	}, [editing]);
	const finish = () => {
		const value = input.current?.value ?? text;
		setEditing(false);
		setText(value);
		if (value === text) return;
		const parts = extractCardParts(value);
		callbacks.onMemoUpdate(card, {
			body: parts.cleanBody,
			blockquote: parts.blockquote,
			tasks: parts.tasks,
			docs: parts.docs,
			wikiLink: '',
			url: '',
			type: 'generic',
		});
	};
	return (
		<>
			<div
				class={`dashboard-memo-view${text ? '' : ' dashboard-memo-view--empty'}`}
				style={{ display: editing ? 'none' : '' }}
				onClick={() => setEditing(true)}
			>
				<MemoPreview text={text} app={app} context={context} />
			</div>
			<textarea
				ref={input}
				class="dashboard-memo-textarea"
				placeholder={t('renderer.writeThoughts')}
				style={{ display: editing ? '' : 'none' }}
				onBlur={finish}
			/>
		</>
	);
}
