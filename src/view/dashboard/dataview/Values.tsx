import { Platform } from 'obsidian';
import { Fragment } from 'preact';
import type { DqlLink, DqlValue, ResultRow } from '../../../core/dql/types';
import { formatValue, kindOf } from '../../../core/dql/values';
import type { DataviewContext } from './context';
import { INLINE_TOKEN_RE, resolveDvFile } from './value-model';
export function rowOpen(context: DataviewContext, row: ResultRow) {
	const file = row.page ? context.app.vault.getFileByPath(row.page.file.path) : null;
	return {
		class: file ? 'is-clickable' : '',
		onMouseOver: (event: MouseEvent) => {
			if (file && context.hoverParent && !Platform.isMobile)
				context.app.workspace.trigger('hover-link', {
					event,
					source: 'nand-dashboard',
					hoverParent: context.hoverParent,
					targetEl: event.currentTarget,
					linktext: file.path,
					sourcePath: '',
				});
		},
		onClick: (event: MouseEvent) => {
			if (
				file &&
				!(event.target as HTMLElement).closest('a,.dashboard-wikilink,.dashboard-dataview-task-checkbox')
			)
				context.opener?.(file);
		},
	};
}
function Link({ content, context }: { content: string; context: DataviewContext }) {
	const pipe = content.indexOf('|'),
		target = pipe < 0 ? content : content.slice(0, pipe),
		alias = pipe < 0 ? undefined : content.slice(pipe + 1);
	const hash = target.indexOf('#'),
		path = hash < 0 ? target : target.slice(0, hash),
		fragment = hash < 0 ? undefined : target.slice(hash);
	const name = path.split('/').pop()?.replace(/\.md$/, '') ?? path;
	const file = resolveDvFile(context.app, path);
	const open = () => {
		if (file) context.opener?.(file, fragment);
	};
	return (
		<span
			class="dashboard-wikilink"
			role="link"
			tabIndex={0}
			onClick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				open();
			}}
			onKeyDown={(e) => {
				if (e.key === 'Enter') open();
			}}
			onMouseOver={(event) => {
				if (file && context.hoverParent && !Platform.isMobile)
					context.app.workspace.trigger('hover-link', {
						event,
						source: 'nand-dashboard',
						hoverParent: context.hoverParent,
						targetEl: event.currentTarget,
						linktext: file.path + (fragment ?? ''),
						sourcePath: '',
					});
			}}
		>
			{alias ?? (fragment ? `${name} > ${fragment.slice(1)}` : name)}
		</span>
	);
}
export function InlineValue({ text, context }: { text: string; context: DataviewContext }) {
	return (
		<>
			{text.split(INLINE_TOKEN_RE).map((part, index) => {
				const inner = (n: number) => <InlineValue text={part.slice(n, -n)} context={context} />;
				let content;
				if (part.startsWith('[[') && part.endsWith(']]'))
					content = <Link content={part.slice(2, -2)} context={context} />;
				else if (
					((part.startsWith('**') && part.endsWith('**')) ||
						(part.startsWith('__') && part.endsWith('__'))) &&
					part.length > 4
				)
					content = <strong>{inner(2)}</strong>;
				else if (part.startsWith('==') && part.endsWith('==') && part.length > 4)
					content = <mark class="dashboard-dataview-mark">{inner(2)}</mark>;
				else if (part.startsWith('~~') && part.endsWith('~~') && part.length > 4) content = <s>{inner(2)}</s>;
				else if (part.startsWith('*') && part.endsWith('*') && part.length > 2) content = <em>{inner(1)}</em>;
				else if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
					content = <code class="dashboard-dataview-code">{part.slice(1, -1)}</code>;
				else {
					const ext = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
					content = ext ? (
						<a class="dashboard-dataview-extlink" href={ext[2]} target="_blank" rel="noopener">
							{ext[1]}
						</a>
					) : (
						part
					);
				}
				return <Fragment key={index}>{content}</Fragment>;
			})}
		</>
	);
}
export function Value({ value, context }: { value: DqlValue; context: DataviewContext }) {
	if (value == null || (Array.isArray(value) && !value.length)) return <span class="dashboard-dataview-null">—</span>;
	if (kindOf(value) === 'link') {
		const link = value as DqlLink;
		return <Link content={`${link.path}${link.display ? `|${link.display}` : ''}`} context={context} />;
	}
	if (Array.isArray(value))
		return (
			<>
				{value.map((v, i) => (
					<Fragment key={i}>
						{i > 0 && ', '}
						<Value value={v} context={context} />
					</Fragment>
				))}
			</>
		);
	return (
		<span class="dashboard-dataview-text">
			<InlineValue text={formatValue(value)} context={context} />
		</span>
	);
}
