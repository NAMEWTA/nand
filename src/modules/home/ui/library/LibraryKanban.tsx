import { Notice, Platform, type TFile } from 'obsidian';
import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { t } from '../../../../shared/i18n/index';
import { libraryStageMove } from '../../core/board/library-stage';
import { noteHover } from '../cards/InlineLinks';
import { KANBAN_FILE_DRAG_TYPE } from '../ui/dnd';
import { Cover, LibraryDeleteButton, PropertyBadges, type LibraryViewProps } from './LibraryViews';
import { formatDate } from './library-file-result';
import {
	ancestorGroupKeys,
	buildKanbanGroupFolders,
	groupLibraryResults,
	nextGroupPropertyValue,
	type LibraryResultGroup,
} from './library-groups';
import { extractCoverValue, omitFrontmatterKey, openFile } from './library-presentation';
const pendingMoves = new WeakSet<TFile>();
export function LibraryKanban({ app, config, context, results, onDelete }: LibraryViewProps) {
	const folder = config.groupMode === 'folder',
		property = config.kanbanGroupBy ?? 'tags';
	const folders = useMemo(() => buildKanbanGroupFolders(results, config.folders ?? []), [results, config.folders]);
	const initial = useMemo(() => {
		const groups = groupLibraryResults(results, folder ? 'folder' : 'property', property, config.folders ?? []);
		if (!folder) return groups;
		const suppressed = ancestorGroupKeys(folders),
			missing = groups.find((group) => group.isNoGroup);
		const loose = groups.filter((group) => suppressed.has(group.key)).flatMap((group) => group.items);
		const visible = groups.filter((group) => !suppressed.has(group.key) && !group.isNoGroup);
		if (missing || loose.length)
			visible.push({
				key: '\u0000__nogroup__',
				label: t('library.notSet'),
				isNoGroup: true,
				items: [...(missing?.items ?? []), ...loose],
			});
		return visible;
	}, [results, folder, property, config.folders, folders]);
	const [groups, setGroups] = useState(initial);
	useLayoutEffect(() => setGroups(initial), [initial]);
	const drag = useRef<{ file: TFile; from: string | null } | null>(null);
	const root = useRef<HTMLDivElement>(null);
	const clearHints = () =>
		root.current
			?.querySelectorAll('.dashboard-library-kanban-col--drag-over')
			.forEach((el) => el.classList.remove('dashboard-library-kanban-col--drag-over'));
	const move = async (target: LibraryResultGroup) => {
		const source = drag.current;
		if (!source || target.isNoGroup || pendingMoves.has(source.file)) return;
		const file = source.file,
			destination = folders.get(target.key);
		if (folder) {
			if (!destination || file.path === `${destination}/${file.name}`) return;
			if (!app.vault.getAbstractFileByPath(destination)) {
				new Notice(t('library.moveFailed'));
				return;
			}
		} else if (
			nextGroupPropertyValue(
				app.metadataCache.getFileCache(file)?.frontmatter?.[property],
				target.key,
				source.from,
			) === undefined
		)
			return;
		const siblingNames = folder && destination && app.vault.getAbstractFileByPath(`${destination}/${file.name}`) ? [file.name] : [];
		const decision = libraryStageMove({
			mode: folder ? 'folder' : 'property',
			path: file.path,
			destination: folder ? destination! : target.key,
			siblingNames,
			statusField: property,
			stageValue: target.key,
			writeStatus: () => 'ok',
			rename: () => 'ok',
		});
		if (decision.status === 'refused') {
			new Notice(decision.error === 'name-clash' ? t('library.moveNameConflict', { name: file.basename, folder: destination ?? target.label }) : t('library.moveFailed'));
			return;
		}
		const original = groups,
			result = groups.flatMap((group) => group.items).find((item) => item.file === file);
		if (!result) return;
		pendingMoves.add(file);
		setGroups(
			groups.map((group) => ({
				...group,
				items:
					group.key === target.key
						? group.items.some((item) => item.file === file)
							? group.items
							: [...group.items, result]
						: (group.isNoGroup ? null : group.key) === source.from
							? group.items.filter((item) => item.file !== file)
							: group.items,
			})),
		);
		try {
			if (folder) {
				await app.fileManager.renameFile(file, `${destination!}/${file.name}`);
				new Notice(t('library.moved', { name: file.basename, folder: destination! }));
			} else {
				await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
					const next = nextGroupPropertyValue(frontmatter[property], target.key, source.from);
					if (next !== undefined) frontmatter[property] = next;
				});
				new Notice(t('library.propertyMoved', { name: file.basename, prop: property, value: target.key }));
			}
		} catch (error) {
			setGroups(original);
			console.error('[Dashboard] library kanban move failed:', error);
			new Notice(t(folder ? 'library.moveFailed' : 'library.propertyMoveFailed'));
		} finally {
			pendingMoves.delete(file);
		}
	};
	return (
		<div ref={root} class="dashboard-library-kanban">
			{groups.map((group) => {
				const accepts = !group.isNoGroup && (!folder || folders.has(group.key));
				return (
					<div
						class="dashboard-library-kanban-col"
						key={group.key}
						data-group-label={group.label}
						onDragOver={(event) => {
							if (Platform.isMobile || !event.dataTransfer?.types.includes(KANBAN_FILE_DRAG_TYPE)) return;
							event.preventDefault();
							event.stopPropagation();
							event.dataTransfer.dropEffect = accepts ? 'move' : 'none';
							event.currentTarget.classList.toggle('dashboard-library-kanban-col--drag-over', accepts);
						}}
						onDragLeave={(event) => {
							if (!event.currentTarget.contains(event.relatedTarget as Node))
								event.currentTarget.classList.remove('dashboard-library-kanban-col--drag-over');
						}}
						onDrop={(event) => {
							if (!drag.current || Platform.isMobile) return;
							event.preventDefault();
							event.stopPropagation();
							clearHints();
							if (accepts) void move(group);
						}}
					>
						<div class="dashboard-library-kanban-col-title">
							{group.label} ({group.items.length})
						</div>
						{group.items.map((result) => {
							const cover = config.kanbanShowCovers ? extractCoverValue(result.frontmatter) : null;
							let frontmatter = cover
								? omitFrontmatterKey(result.frontmatter, cover.key)
								: result.frontmatter;
							if (!folder) frontmatter = omitFrontmatterKey(frontmatter, property);
							return (
								<div
									class="dashboard-library-kanban-card"
									key={result.file.path}
									draggable={!Platform.isMobile}
									title={t(folder ? 'library.kanbanDragHint' : 'library.kanbanDragHintProperty')}
									onMouseOver={(event) => noteHover(app, context, result.file, event)}
									onClick={(event) => {
										if ((event.target as HTMLElement).closest('.dashboard-library-table-delete')) return;
										openFile(app, result.file, event.currentTarget);
									}}
									onDragStart={(event) => {
										const target = event.target as HTMLElement | null;
										if (target?.closest('.dashboard-library-table-delete')) {
											event.preventDefault();
											event.stopPropagation();
											return;
										}
										drag.current = { file: result.file, from: group.isNoGroup ? null : group.key };
										event.currentTarget.classList.add('dashboard-library-kanban-card--dragging');
										if (event.dataTransfer) {
											event.dataTransfer.effectAllowed = 'move';
											event.dataTransfer.setData(KANBAN_FILE_DRAG_TYPE, result.file.path);
										}
									}}
									onDragEnd={(event) => {
										drag.current = null;
										clearHints();
										event.currentTarget.classList.remove('dashboard-library-kanban-card--dragging');
									}}
								>
									<LibraryDeleteButton file={result.file} onDelete={onDelete} />
									{config.kanbanShowCovers && <Cover app={app} result={result} kanban />}
									<div class="dashboard-library-kanban-card-title">{result.basename}</div>
									<div class="dashboard-library-kanban-card-date">{formatDate(result.mtime)}</div>
									<PropertyBadges frontmatter={frontmatter} config={config} />
								</div>
							);
						})}
					</div>
				);
			})}
		</div>
	);
}
