import { Notice, type App, type TFile } from 'obsidian';
import { Fragment } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import type { DashboardColumn } from '../../core/board/types';
import type { MediaTagService } from '../../platform/media/media-tags';
import { t } from '../../../../shared/i18n';
import { Icon } from '../../../../ui/primitives/Icon';
import { Pagination } from '../library/Pagination';
import { ToolbarDropdown } from '../ui/ToolbarDropdown';
import { showConfirmDialog } from '../ui/confirm-dialog';
import { MediaFilter, emptyMediaFilter, normalizeMediaFolder } from './MediaFilter';
import { MediaViews } from './MediaViews';
import { MediaLightboxModal } from './media-lightbox-modal';
import {
	PAGE_SIZE_OPTIONS,
	THUMB_SIZE_STORAGE_KEY,
	extsFor,
	groupMediaResults,
	queryMediaFiles,
	readStoredThumbSize,
	sortMedia,
	type MediaGroupMode,
	type MediaViewMode,
	type ThumbSize,
} from './media-model';
import { formatDate, type MediaFileResult } from './media-presentation';
import { MediaTagEditModal } from './media-tag-editor-modal';
import { trashMediaFile } from './media-utils';
export function MediaPanel({
	app,
	column,
	openNote,
	tagService,
}: {
	app: App;
	column: DashboardColumn;
	openNote?: (file: TFile) => void;
	tagService?: MediaTagService;
}) {
	const [query, setQuery] = useState(''),
		[sort, setSort] = useState('modified'),
		[desc, setDesc] = useState(true);
	const [groupBy, setGroupBy] = useState<MediaGroupMode>('none'),
		[collapsed, setCollapsed] = useState(new Set<string>());
	const [view, setView] = useState<MediaViewMode>('grid'),
		[size, setSize] = useState(() => readStoredThumbSize(app));
	const [filter, setFilter] = useState(emptyMediaFilter),
		[anchor, setAnchor] = useState<HTMLElement | null>(null);
	const [page, setPage] = useState(1),
		[pageSize, setPageSize] = useState(20),
		[revision, revise] = useState(0);
	const refresh = () => revise((n) => n + 1);
	const kind = column.sectionType === 'videos' ? 'video' : 'image';
	const results = useMemo(() => {
		const exts = extsFor(column.sectionType ?? '');
		if (!exts) return [];
		const q = query.trim().toLowerCase();
		const folders = filter.folders.map(normalizeMediaFolder).filter(Boolean);
		const items = queryMediaFiles(
			app,
			exts,
			column.libraryConfig?.excludeFolders ?? [],
			column.libraryConfig?.includeFolders ?? [],
			tagService,
		).filter((r) => {
			if (q && !r.basename.toLowerCase().includes(q) && !r.path.toLowerCase().includes(q)) return false;
			if (filter.tags.length && !r.tags.some((tag) => filter.tags.includes(tag))) return false;
			const date = formatDate(filter.property === 'created' ? r.ctime : r.mtime);
			if ((filter.start && date < filter.start) || (filter.end && date > filter.end)) return false;
			return (
				!folders.length || folders.some((folder) => r.path.toLowerCase().startsWith(folder.toLowerCase() + '/'))
			);
		});
		sortMedia(items, sort, desc);
		return items;
	}, [app, column, query, sort, desc, filter, revision, tagService]);
	const groups = useMemo(() => groupMediaResults(results, groupBy), [results, groupBy]);
	const pages = Math.max(1, Math.ceil(results.length / pageSize)),
		current = Math.min(page, pages),
		start = (current - 1) * pageSize;
	const collapseAll = groups.some((group) => !collapsed.has(group.key));
	const tagHooks = tagService
		? {
				getTags: (file: TFile) => tagService.getTags(file.path),
				getAllTags: () => tagService.getAllTags(),
				onTagsChange: (file: TFile, tags: string[]) => {
					tagService.setTags(file.path, tags);
					refresh();
				},
			}
		: undefined;
	const remove = async (file: TFile) => {
		if (
			!(await showConfirmDialog(app, {
				title: t('common.confirmDelete'),
				message: t('media.confirmDelete', { name: file.basename }),
			}))
		)
			return;
		try {
			await trashMediaFile(app, file);
			new Notice(t('media.deleted'));
			refresh();
		} catch (error) {
			console.error('[Dashboard] media delete failed', error);
		}
	};
	const editTags = tagService
		? (result: MediaFileResult) =>
				new MediaTagEditModal(
					app,
					result.file,
					tagService.getTags(result.path),
					tagService.getAllTags(),
					(tags) => {
						if (tagService.setTags(result.path, tags)) refresh();
					},
				).open()
		: undefined;
	const display = groupBy === 'none' ? results : groups.flatMap((group) => group.items);
	const renderItems = (items: MediaFileResult[], offset: number) => (
		<MediaViews
			app={app}
			results={items}
			kind={kind}
			size={size}
			view={view}
			open={(index) =>
				new MediaLightboxModal(
					app,
					display.map((r) => r.file),
					offset + index,
					kind,
					tagHooks,
				).open()
			}
			remove={(file) => void remove(file)}
			refresh={refresh}
			openNote={openNote}
			editTags={editTags}
		/>
	);
	const hasFilter = !!(filter.start || filter.end || filter.folders.length || filter.tags.length);
	const updateFilter = (value: typeof filter) => {
		setFilter(value);
		setPage(1);
	};
	return (
		<>
			<div class="dashboard-library-toolbar">
				<input
					class="dashboard-library-search"
					type="text"
					placeholder={t('library.searchPlaceholder')}
					value={query}
					onInput={(e) => {
						setQuery(e.currentTarget.value);
						setPage(1);
					}}
				/>
				<select
					class="dashboard-library-sort"
					value={sort}
					onChange={(e) => {
						setSort(e.currentTarget.value);
						setPage(1);
					}}
				>
					{(['modified', 'created', 'name'] as const).map((key) => (
						<option key={key} value={key}>
							{t(`library.sort${key[0]!.toUpperCase()}${key.slice(1)}`)}
						</option>
					))}
				</select>
				<div
					class="dashboard-library-sort-dir"
					role="button"
					onClick={() => {
						setDesc(!desc);
						setPage(1);
					}}
				>
					<Icon name={desc ? 'arrow-down-wide-narrow' : 'arrow-up-wide-narrow'} />
				</div>
				<select
					class="dashboard-library-sort dashboard-media-group-select"
					aria-label={t('media.groupBy')}
					title={t('media.groupBy')}
					value={groupBy}
					onChange={(e) => {
						setGroupBy(e.currentTarget.value as MediaGroupMode);
						setPage(1);
					}}
				>
					<option value="none">{t('media.groupNone')}</option>
					<option value="folder">{t('media.groupByFolder')}</option>
					<option value="tag">{t('media.groupByTag')}</option>
				</select>
				<div
					class={`dashboard-library-view-toggle dashboard-media-collapse-toggle${groups.length ? '' : ' is-hidden'}`}
				>
					<div
						class="dashboard-library-view-btn"
						role="button"
						title={t(collapseAll ? 'library.collapseAllGroups' : 'library.expandAllGroups')}
						aria-label={t(collapseAll ? 'library.collapseAllGroups' : 'library.expandAllGroups')}
						onClick={() => setCollapsed(collapseAll ? new Set(groups.map((g) => g.key)) : new Set())}
					>
						<Icon name={collapseAll ? 'chevrons-down-up' : 'chevrons-up-down'} />
					</div>
				</div>
				<div class="dashboard-library-view-toggle">
					<ToolbarDropdown
						currentKey={view}
						items={(['grid', 'list'] as const).map((key) => ({
							key,
							label: t(key === 'grid' ? 'media.viewGrid' : 'media.viewList'),
							icon: key === 'grid' ? 'layout-grid' : 'list',
						}))}
						pick={(key) => {
							setView(key as MediaViewMode);
							setPage(1);
						}}
					/>
				</div>
				<div class="dashboard-library-view-toggle dashboard-media-size-toggle">
					<ToolbarDropdown
						currentKey={size}
						items={(['small', 'medium', 'large'] as const).map((key) => ({
							key,
							label: t(`media.size${key[0]!.toUpperCase()}${key.slice(1)}`),
							short: key[0]!.toUpperCase(),
						}))}
						pick={(key) => {
							setSize(key as ThumbSize);
							app.saveLocalStorage(THUMB_SIZE_STORAGE_KEY, key);
						}}
					/>
				</div>
				<div
					class={`dashboard-library-filter-btn${hasFilter ? ' active' : ''}`}
					title={t('media.quickFilter')}
					role="button"
					onClick={(e) => {
						e.stopPropagation();
						setAnchor(anchor ? null : e.currentTarget);
					}}
				>
					<Icon name="filter" />
				</div>
				<div class="dashboard-library-filter-tags">
					{filter.tags.map((tag) => (
						<div key={tag} class="dashboard-library-filter-tag dashboard-library-filter-tag--tag">
							<span class="dashboard-library-filter-tag-label">#{tag}</span>
							<span
								class="dashboard-library-filter-tag-x"
								onClick={() => updateFilter({ ...filter, tags: filter.tags.filter((v) => v !== tag) })}
							>
								×
							</span>
						</div>
					))}
					{(filter.start || filter.end) && (
						<div class="dashboard-library-filter-tag">
							{filter.property}: {filter.start || '...'} ~ {filter.end || '...'}
							<span
								class="dashboard-library-filter-tag-x"
								onClick={() => updateFilter({ ...filter, start: '', end: '' })}
							>
								×
							</span>
						</div>
					)}
					{filter.folders.map((folder) => (
						<div key={folder} class="dashboard-library-filter-tag">
							<span class="dashboard-library-filter-tag-label" title={folder}>
								{folder.split('/').pop()}
							</span>
							<span
								class="dashboard-library-filter-tag-x"
								onClick={() =>
									updateFilter({ ...filter, folders: filter.folders.filter((v) => v !== folder) })
								}
							>
								×
							</span>
						</div>
					))}
				</div>
				<div class="dashboard-library-toolbar-spacer" />
				<div class="dashboard-library-count">{t('library.fileCount', { count: results.length })}</div>
				<select
					class="dashboard-library-page-size"
					value={String(pageSize)}
					onChange={(e) => {
						setPageSize(Number(e.currentTarget.value));
						setPage(1);
					}}
				>
					{PAGE_SIZE_OPTIONS.map((value) => (
						<option key={value} value={String(value)}>
							{t('library.pageSize', { count: value })}
						</option>
					))}
				</select>
			</div>
			<div class="dashboard-media-area">
				{!results.length ? (
					<div class="dashboard-library-empty">
						{t(kind === 'video' ? 'media.noVideos' : 'media.noImages')}
					</div>
				) : groupBy === 'none' ? (
					renderItems(results.slice(start, start + pageSize), start)
				) : (
					groups.map((group) => (
						<Fragment key={group.key}>
							<div
								class={`dashboard-media-group-header${collapsed.has(group.key) ? ' is-collapsed' : ''}`}
								data-group-key={group.key}
								onClick={() =>
									setCollapsed((old) => {
										const next = new Set(old);
										if (next.has(group.key)) next.delete(group.key);
										else next.add(group.key);
										return next;
									})
								}
							>
								<Icon
									className="dashboard-media-group-chevron"
									name={collapsed.has(group.key) ? 'chevron-right' : 'chevron-down'}
								/>
								<div class="dashboard-media-group-name">{group.key}</div>
								<div class="dashboard-media-group-count">{group.items.length}</div>
							</div>
							<div class={`dashboard-media-group-body${collapsed.has(group.key) ? ' is-hidden' : ''}`}>
								{renderItems(group.items, group.offset)}
							</div>
						</Fragment>
					))
				)}
			</div>
			<div class="dashboard-library-pagination">
				{groupBy === 'none' && pages > 1 && <Pagination page={current} pages={pages} change={setPage} />}
			</div>
			{anchor && (
				<MediaFilter
					app={app}
					anchor={anchor}
					value={filter}
					update={updateFilter}
					tags={tagService?.getAllTags()}
					close={() => setAnchor(null)}
				/>
			)}
		</>
	);
}
