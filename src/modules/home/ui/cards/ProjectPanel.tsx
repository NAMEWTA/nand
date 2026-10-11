import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { DocNode } from '../../core/board/types/index';
import { documentLink } from '../../core/board/document-link';
import { iconForExtension } from '../../../../shared/file-types';
import { t } from '../../../../shared/i18n/index';
import { Icon } from '../../../../ui/primitives/Icon';
import { getSearchableFiles, resolveNoteFile } from '../renderer/render-context';
import { showConfirmDialog } from '../ui/confirm-dialog';
import { noteHover } from './InlineLinks';
import type { CardBodyProps } from './TaskPanel';
import { itemDrag, listDrop } from './card-interactions';
function DocRow({
	doc,
	path,
	hidden = false,
	...props
}: CardBodyProps & { doc: DocNode; path: number[]; hidden?: boolean }) {
	const { card, callbacks, context, app } = props;
	const [collapsed, setCollapsed] = useState(doc.collapsed);
	useLayoutEffect(() => setCollapsed(doc.collapsed), [doc.collapsed]);
	const target = documentLink(doc.path);
	const file = resolveNoteFile(app, target.path);
	const name = file?.basename ?? target.path.split('/').pop() ?? target.path;
	const hasChildren = !!doc.children?.length;
	return (
		<>
			<div
				class={`dashboard-project-doc-item${path.length > 1 ? ' dashboard-project-doc-item--child' : ''}${hidden ? ' dashboard-project-doc-item--hidden' : ''}`}
				style={{ marginLeft: (path.length - 1) * 18 }}
				draggable
				data-doc-path={JSON.stringify(path)}
				{...itemDrag(context, callbacks, 'doc', card.id, path)}
			>
				{hasChildren && (
					<button
						class="dashboard-task-toggle dashboard-task-toggle--active"
						type="button"
						aria-expanded={!collapsed}
						aria-label={t(collapsed ? 'renderer.expandDoc' : 'renderer.collapseDoc')}
						onPointerDown={(event) => event.stopPropagation()}
						onClick={(event) => {
							event.stopPropagation();
							setCollapsed(!collapsed);
							callbacks.onDocToggleCollapse(card.id, path);
						}}
					>
						<Icon name={collapsed ? 'chevron-right' : 'chevron-down'} />
					</button>
				)}
				<a
					class="dashboard-project-doc-link"
					href={file ? file.path + (target.subpath ?? '') : undefined}
					aria-disabled={file ? undefined : true}
					draggable={false}
					onMouseOver={(event) => noteHover(app, context, file, event, target.subpath)}
					onClick={(event) => {
						event.preventDefault(); event.stopPropagation();
						if (file) context.noteOpener?.(file, target.subpath);
					}}
				>
					<span class="dashboard-project-doc-icon"><Icon name={iconForExtension(file?.extension ?? '')} /></span>
					<span class="dashboard-project-doc-name">{target.alias || (target.subpath ? `${name} > ${target.subpath.slice(1)}` : name)}</span>
				</a>
				<button
					class="dashboard-project-doc-remove"
					type="button"
					aria-label={t('renderer.removeDoc')}
					onPointerDown={(event) => event.stopPropagation()}
					onClick={(event) => {
						event.stopPropagation();
						void showConfirmDialog(app, {
							title: t('renderer.removeDoc'),
							message: t('renderer.removeDocMessage'),
							confirmLabel: t('renderer.removeDoc'),
							owner: event.currentTarget,
						}).then((confirmed) => {
							if (confirmed) callbacks.onDocDelete(card.id, path);
						});
					}}
				>
					<Icon name="x" />
				</button>
			</div>
			{doc.children?.map((child, index) => (
				<DocRow key={index} {...props} doc={child} path={[...path, index]} hidden={hidden || collapsed} />
			))}
		</>
	);
}
export function ProjectPanel(props: CardBodyProps) {
	const { card, callbacks, context, app } = props;
	const [query, setQuery] = useState('');
	const [focused, setFocused] = useState(false);
	const search = useRef<HTMLInputElement>(null);
	const addDocument = async (path: string): Promise<void> => {
		const owner = search.current;
		setQuery('');
		owner?.focus();
		try { await callbacks.onDocAdd(card.id, path); }
		catch { /* The board save state already reports failures and owns retry. */ }
		if (!owner || owner.isConnected || !context.root.isConnected || context.root.closest('[inert], [hidden]') || owner.doc.activeElement !== owner.doc.body) return;
		const current = [...context.root.querySelectorAll<HTMLElement>('.dashboard-project-add-doc')].find(element => element.dataset.cardId === card.id);
		current?.querySelector('input')?.focus({ preventScroll: true });
	};
	const paths = new Set<string>();
	const collect = (docs: DocNode[]) => {
		for (const doc of docs) {
			const target = documentLink(doc.path);
			paths.add(resolveNoteFile(app, target.path)?.path ?? target.path);
			if (doc.children) collect(doc.children);
		}
	};
	collect(card.docs);
	const normalized = query.toLowerCase().trim();
	const files =
		focused && normalized
			? getSearchableFiles(app)
					.filter(
						(file) =>
							!paths.has(file.path) &&
							(file.path.toLowerCase().includes(normalized) ||
								file.basename.toLowerCase().includes(normalized)),
					)
					.slice(0, 50)
			: [];
	return (
		<>
			<div
				class="dashboard-project-docs"
				data-card-id={card.id}
				{...listDrop(context, callbacks, 'doc', card.id, card.docs.length)}
			>
				{card.docs.map((doc, index) => (
					<DocRow key={index} {...props} doc={doc} path={[index]} />
				))}
			</div>
			<div class="dashboard-project-add-doc" data-card-id={card.id} onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
			}}>
				<input
					ref={search}
					class="dashboard-task-input"
					type="text"
					placeholder={t('renderer.addDocument')}
					aria-label={t('renderer.addDocument')}
					value={query}
					onInput={(event) => setQuery(event.currentTarget.value)}
				/>
				<div class="dashboard-project-doc-results">
					{files.map((file) => (
						<button
							key={file.path}
							class="dashboard-project-doc-result"
							type="button"
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => { void addDocument(file.path); }}
						>
							{file.basename}
						</button>
					))}
				</div>
			</div>
		</>
	);
}
