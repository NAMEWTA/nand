import { useLayoutEffect, useState } from 'preact/hooks';
import type { DocNode } from '../../core/board/types/index';
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
	const file = resolveNoteFile(app, doc.path);
	const hasChildren = !!doc.children?.length;
	return (
		<>
			<div
				class={`dashboard-project-doc-item${path.length > 1 ? ' dashboard-project-doc-item--child' : ''}${hidden ? ' dashboard-project-doc-item--hidden' : ''}`}
				style={{ marginLeft: (path.length - 1) * 18 }}
				draggable
				data-doc-path={JSON.stringify(path)}
				aria-expanded={hasChildren ? !collapsed : undefined}
				onMouseOver={(event) => noteHover(app, context, file, event)}
				onClick={() => {
					if (file) context.noteOpener?.(file);
				}}
				{...itemDrag(context, callbacks, 'doc', card.id, path)}
			>
				{hasChildren && (
					<div
						class="dashboard-task-toggle dashboard-task-toggle--active"
						role="button"
						tabIndex={0}
						aria-label={t(collapsed ? 'renderer.expandDoc' : 'renderer.collapseDoc')}
						onClick={(event) => {
							event.stopPropagation();
							setCollapsed(!collapsed);
							callbacks.onDocToggleCollapse(card.id, path);
						}}
						onKeyDown={(event) => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault();
								event.currentTarget.click();
							}
						}}
					>
						<Icon name={collapsed ? 'chevron-right' : 'chevron-down'} />
					</div>
				)}
				<span class="dashboard-project-doc-icon">
					<Icon name={iconForExtension(file?.extension ?? '')} />
				</span>
				<span class="dashboard-project-doc-name">
					{file?.basename ?? doc.path.split('/').pop() ?? doc.path}
				</span>
				<button
					class="dashboard-project-doc-remove"
					aria-label={t('renderer.removeDoc')}
					onClick={(event) => {
						event.stopPropagation();
						void showConfirmDialog(app, {
							title: t('common.confirmDelete'),
							message: t('common.confirmDeleteMessage'),
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
	const paths = new Set<string>();
	const collect = (docs: DocNode[]) => {
		for (const doc of docs) {
			paths.add(doc.path);
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
			<div class="dashboard-project-add-doc">
				<input
					class="dashboard-task-input"
					type="text"
					placeholder={t('renderer.addDocument')}
					value={query}
					onInput={(event) => setQuery(event.currentTarget.value)}
					onFocus={() => setFocused(true)}
					onBlur={() => setFocused(false)}
				/>
				<div class="dashboard-project-doc-results">
					{files.map((file) => (
						<div
							key={file.path}
							class="dashboard-project-doc-result"
							role="button"
							tabIndex={0}
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => {
								callbacks.onDocAdd(card.id, file.path);
								setQuery('');
							}}
							onKeyDown={(event) => {
								if (event.key === 'Enter') {
									callbacks.onDocAdd(card.id, file.path);
									setQuery('');
								}
							}}
						>
							{file.basename}
						</div>
					))}
				</div>
			</div>
		</>
	);
}
