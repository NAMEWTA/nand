import { Menu, Notice, type App, type TFile } from 'obsidian';
import { Fragment } from 'preact';
import { createPortal } from 'preact/compat';
import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { LibraryConfig, LibraryViewMode } from '../../core/board/types/index';
import { t } from '../../../../shared/i18n/index';
import { Icon } from '../../../../ui/primitives/Icon';
import { IconButton } from '../../../../ui/primitives/IconButton';
import { applyModalTheme } from '../appearance/modal-theme';
import type { DashboardRenderContext } from '../renderer/render-context';
import { ToolbarDropdown } from '../ui/ToolbarDropdown';
import { showConfirmDialog } from '../ui/confirm-dialog';
import { closeOwnedDashboardDialogs } from '../ui/dialog-scope';
import { LibraryKanban } from './LibraryKanban';
import { FileCards, FileList, FileTable } from './LibraryViews';
import { Pagination } from './Pagination';
import {
	DEFAULT_PAGE_SIZE,
	PAGE_SIZE_OPTIONS,
	extractFrontmatterProperties,
	localDateKey,
	queryVaultFiles,
	showCalendarPopup,
} from './library-file-result';
import { groupLibraryResults } from './library-groups';
import { trashLibraryFile } from './library-presentation';
import { libraryTableCandidates, libraryTableColumns } from '../../core/board/table-columns';
import { TableColumnsEditor } from './TableColumnsEditor';
import { GroupWindow, useProgressiveResults } from './ProgressiveResults';
import { SECTION_CANDIDATE_LIMIT } from '../../core/board/progressive-results';
const modes: LibraryViewMode[] = ['grid', 'gallery', 'list', 'table', 'kanban'];
const icons = { grid: 'layout-grid', gallery: 'image', list: 'list', table: 'table', kanban: 'columns' };
function QuickFilter({
	anchor,
	config,
	update,
	close,
}: {
	anchor: HTMLElement;
	config: LibraryConfig;
	update: (config: LibraryConfig) => void;
	close: () => void;
}) {
	const popup = useRef<HTMLDivElement>(null);
	const filter = config.quickDateFilter,
		[property, setProperty] = useState(filter?.property ?? 'created');
	const rect = anchor.getBoundingClientRect();
	useLayoutEffect(() => {
		const doc = anchor.ownerDocument,
			node = popup.current;
		if (node) applyModalTheme(node);
		const outside = (event: MouseEvent) => {
			const target = event.target as HTMLElement;
			if (popup.current?.contains(target) || anchor.contains(target) || target.closest?.('.modal-container'))
				return;
			close();
		};
		const key = (event: KeyboardEvent) => {
			if (event.key === 'Escape') close();
		};
		doc.addEventListener('click', outside);
		doc.addEventListener('keydown', key);
		return () => {
			doc.removeEventListener('click', outside);
			doc.removeEventListener('keydown', key);
		};
	}, [anchor]);
	return createPortal(
		<div
			ref={popup}
			class="dashboard-library-filter-popup"
			style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, zIndex: 10000 }}
		>
			<div class="dashboard-library-quickfilter-title">{t('library.quickFilterTitle')}</div>
			<div class="dashboard-library-quickfilter-row dashboard-library-quickfilter-row--main">
				<select
					class="dashboard-library-filter-popup-prop"
					value={property}
					onChange={(event) => setProperty(event.currentTarget.value as 'created' | 'modified')}
				>
					<option value="created">{t('library.created')}</option>
					<option value="modified">{t('library.modified')}</option>
				</select>
				<button
					class={`dashboard-library-filter-date-btn dashboard-library-filter-range-btn${filter?.start || filter?.end ? ' has-value' : ''}`}
					onClick={(event) => {
						event.stopPropagation();
						showCalendarPopup(event.currentTarget, filter?.start ?? '', filter?.end ?? '', (start, end) =>
							update({ ...config, quickDateFilter: start || end ? { property, start, end } : undefined }),
						);
					}}
				>
					{filter?.start || filter?.end
						? `${filter.start || '…'} ~ ${filter.end || '…'}`
						: t('library.filterDateRange')}
				</button>
			</div>
			<div class="dashboard-library-quickfilter-row">
				<div class="dashboard-library-quickfilter-label">{t('library.quickRange')}</div>
				<div class="dashboard-library-filter-popup-dates">
					{[3, 7, 30].map((days) => (
						<button
							key={days}
							class={`dashboard-library-filter-date-btn${filter?.days === days ? ' has-value' : ''}`}
							onClick={() =>
								update({
									...config,
									quickDateFilter:
										filter?.days === days ? undefined : { property, start: '', end: '', days },
								})
							}
						>
							{t('library.lastNDays', { n: days })}
						</button>
					))}
				</div>
			</div>
			{(filter || config.folderFilter?.length) && (
				<button
					class="dashboard-library-filter-popup-clear"
					onClick={() => {
						update({ ...config, quickDateFilter: undefined, folderFilter: undefined });
						close();
					}}
				>
					{t('library.clearFilters')}
				</button>
			)}
		</div>,
		anchor.ownerDocument.body,
	);
}
export interface LibraryColumn {
	name: string;
	color: string;
	sectionType?: string;
	libraryConfig?: LibraryConfig;
}
export function LibraryPanel({
	column,
	app,
	root,
	context,
	onConfigChange,
}: {
	column: LibraryColumn;
	app: App;
	root: HTMLElement;
	context: DashboardRenderContext;
	onConfigChange: (config: LibraryConfig) => void;
}) {
	const [config, setConfig] = useState<LibraryConfig>(() => ({
		filters: [],
		viewMode: 'grid',
		sortBy: 'modified',
		sortDesc: true,
		...column.libraryConfig,
	}));
	const [query, setQuery] = useState(''),
		[search, setSearch] = useState(''),
		[page, setPage] = useState(1),
		[revision, setRevision] = useState(0),
		[collapsed, setCollapsed] = useState(new Set<string>()),
		[filterOpen, setFilterOpen] = useState(false);
	const [columnsOpen, setColumnsOpen] = useState(false);
	useLayoutEffect(() => {
		const win = root.ownerDocument.defaultView;
		let timer: number | undefined;
		// Vault writes can precede indexing; query again when frontmatter is ready.
		const refresh = () => {
			win?.clearTimeout(timer);
			timer = win?.setTimeout(() => setRevision(value => value + 1), 100);
		};
		const ref = app.metadataCache.on('changed', refresh);
		root.addEventListener('dashboard-library-refresh', refresh);
		return () => { app.metadataCache.offref(ref); root.removeEventListener('dashboard-library-refresh', refresh); win?.clearTimeout(timer); closeOwnedDashboardDialogs(app, root); };
	}, [app, root]);
	const filterButton = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const win = root.ownerDocument.defaultView;
		const timer = win?.setTimeout(() => {
			setSearch(query.trim().toLowerCase());
			setPage(1);
		}, 200);
		return () => win?.clearTimeout(timer);
	}, [query, root]);
	const update = (next: LibraryConfig) => {
		setSearch(query.trim().toLowerCase());
		setConfig(next);
		setPage(1);
		onConfigChange(next);
	};
	const results = useMemo(() => {
		let found = queryVaultFiles(app, config);
		if (search) found = found.filter((result) => result.basename.toLowerCase().includes(search));
		const filter = config.quickDateFilter;
		if (filter) {
			const days = Math.max(0, filter.days ?? 0),
				start = days ? localDateKey(Date.now() - (days - 1) * 86400000) : filter.start,
				end = days ? localDateKey(Date.now()) : filter.end;
			found = found.filter((result) => {
				const date = localDateKey(filter.property === 'modified' ? result.mtime : result.ctime);
				return (!start || date >= start) && (!end || date <= end);
			});
		}
		const folders = (config.folderFilter ?? [])
			.map((folder) =>
				folder
					.trim()
					.replace(/^\/+|\/+$/g, '')
					.toLowerCase(),
			)
			.filter(Boolean);
		if (folders.length)
			found = found.filter((result) =>
				folders.some((folder) => result.file.path.toLowerCase().startsWith(folder + '/')),
			);
		return found;
	}, [app, config, search, revision]);
	const grouped =
		config.viewMode !== 'kanban' &&
		(config.viewGroupMode === 'folder' || (config.viewGroupMode === 'property' && !!config.viewGroupBy));
	const tableCandidates = useMemo(() => config.viewMode === 'table' ? libraryTableCandidates(results, config.filters) : [], [results, config.viewMode, config.filters]);
	const tableColumns = libraryTableColumns(config, tableCandidates).visible;
	const windowKey = JSON.stringify([search, config.viewMode, config.viewGroupMode, config.viewGroupBy, config.kanbanGroupBy, config.groupMode, config.filters, config.folders, config.excludeFolders, config.folderFilter, config.quickDateFilter, config.sortBy, config.sortDesc]);
	const progressive = useProgressiveResults(results, windowKey);
	const groups = useMemo(
		() =>
			grouped
				? groupLibraryResults(
						results,
						config.viewGroupMode === 'folder' ? 'folder' : 'property',
						config.viewGroupBy,
						config.folders ?? [],
					)
				: [],
		[results, grouped, config.viewGroupMode, config.viewGroupBy, config.folders],
	);
	const skip = grouped || config.viewMode === 'kanban',
		size = Math.max(1, config.pageSize ?? DEFAULT_PAGE_SIZE),
		pages = skip ? 1 : Math.max(1, Math.ceil(results.length / size)),
		current = Math.min(page, pages);
	const items = skip ? results : results.slice((current - 1) * size, current * size);
	const collapse = groups.some((group) => !collapsed.has(group.key));
	const groupKey =
		config.viewGroupMode === 'folder'
			? 'folder'
			: config.viewGroupMode === 'property' && config.viewGroupBy
				? `prop:${config.viewGroupBy}`
				: 'none';
	const groupLabel =
		groupKey === 'folder'
			? `${t('library.viewGroup')}: ${t('library.groupByFolder')}`
			: groupKey.startsWith('prop:')
				? `${t('library.viewGroup')}: ${groupKey.slice(5)}`
				: t('library.viewGroup');
	const remove = async (file: TFile) => {
		if (
			!(await showConfirmDialog(app, {
				title: t('common.confirmDelete'),
				message: t('library.confirmDelete', { name: file.basename }),
				owner: root,
			}))
		)
			return;
		try {
			await trashLibraryFile(app, file);
			new Notice(t('library.deleted'));
			setRevision((value) => value + 1);
		} catch (error) {
			console.error('[Dashboard] library delete failed:', error);
			new Notice(t('library.deleteFailed'));
		}
	};
	const view = (rows: typeof results) => {
		const props = {
			results: rows,
			app,
			config,
			context,
			windowKey,
			showTags: column.sectionType === 'folder',
			onDelete: (file: TFile) => {
				void remove(file);
			},
		};
		return config.viewMode === 'kanban' ? (
			<LibraryKanban {...props} />
		) : config.viewMode === 'list' ? (
			<FileList {...props} />
		) : config.viewMode === 'table' ? (
			<FileTable {...props} tableColumns={tableColumns} />
		) : (
			<FileCards {...props} covers={config.viewMode === 'gallery'} />
		);
	};
	return (
		<>
			<div class="dashboard-library-toolbar">
				<input
					class="dashboard-library-search"
					type="text"
					placeholder={t('library.searchPlaceholder')}
					value={query}
					onInput={(event) => setQuery(event.currentTarget.value)}
				/>
				<select
					class="dashboard-library-sort"
					value={config.sortBy}
					onChange={(event) => update({ ...config, sortBy: event.currentTarget.value })}
				>
					{[
						['modified', 'library.sortModified'],
						['created', 'library.sortCreated'],
						['name', 'library.sortName'],
					].map(([value, key]) => (
						<option value={value} key={value}>
							{t(key!)}
						</option>
					))}
				</select>
				<div
					class="dashboard-library-sort-dir"
					role="button"
					tabIndex={0}
					onClick={() => update({ ...config, sortDesc: !config.sortDesc })}
				>
					<Icon name={config.sortDesc ? 'arrow-down-wide-narrow' : 'arrow-up-wide-narrow'} />
				</div>
				<div class="dashboard-library-view-toggle">
					<ToolbarDropdown
						currentKey={config.viewMode}
						items={modes.map((mode) => ({
							key: mode,
							label: ({ grid: t('library.viewGrid'), gallery: t('library.viewGallery'), list: t('library.viewList'), table: t('library.viewTable'), kanban: t('library.viewKanban') })[mode],
							icon: icons[mode],
						}))}
						pick={(mode) => update({ ...config, viewMode: mode as LibraryViewMode })}
					/>
				</div>
				<div
					class={`dashboard-library-view-toggle dashboard-library-size-toggle${['grid', 'gallery'].includes(config.viewMode) ? '' : ' is-hidden'}`}
				>
					<ToolbarDropdown
						currentKey={config.cardSize ?? 'medium'}
						items={(['small', 'medium', 'large'] as const).map((size) => ({
							key: size,
							label: ({ small: t('library.sizeSmall'), medium: t('library.sizeMedium'), large: t('library.sizeLarge') })[size],
							short: size[0]!.toUpperCase(),
						}))}
						pick={(size) => update({ ...config, cardSize: size as LibraryConfig['cardSize'] })}
					/>
				</div>
				<div
					class={`dashboard-library-view-toggle dashboard-library-group-toggle${config.viewMode === 'kanban' ? ' is-hidden' : ''}`}
				>
					<div
						class="dashboard-library-view-btn"
						role="button"
						tabIndex={0}
						title={groupLabel}
						aria-label={groupLabel}
						aria-haspopup="menu"
						onClick={(event) => {
							const pick = (key: string) => {
								if (key === groupKey) return;
								setCollapsed(new Set());
								update({
									...config,
									viewGroupMode:
										key === 'folder' ? 'folder' : key.startsWith('prop:') ? 'property' : undefined,
									viewGroupBy: key.startsWith('prop:') ? key.slice(5) : undefined,
								});
							};
							const menu = new Menu();
							menu.addItem((item) =>
								item
									.setTitle(t('library.viewGroupNone'))
									.setChecked(groupKey === 'none')
									.onClick(() => pick('none')),
							);
							menu.addSeparator();
							menu.addItem((item) =>
								item
									.setTitle(t('library.groupByFolder'))
									.setIcon('folder')
									.setChecked(groupKey === 'folder')
									.onClick(() => pick('folder')),
							);
							menu.addSeparator();
							for (const key of [
								'tags',
								...Array.from(extractFrontmatterProperties(app).keys())
									.filter((key) => !['modified', 'created', 'path', 'tags'].includes(key))
									.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
							])
								menu.addItem((item) =>
									item
										.setTitle(key)
										.setChecked(groupKey === `prop:${key}`)
										.onClick(() => pick(`prop:${key}`)),
								);
							menu.showAtMouseEvent(event);
						}}
					>
						<Icon name="rows-3" />
					</div>
				</div>
				<div
					class={`dashboard-library-view-toggle dashboard-library-collapse-toggle${grouped && groups.length ? '' : ' is-hidden'}`}
				>
					<div
						class="dashboard-library-view-btn"
						role="button"
						tabIndex={0}
						title={t(collapse ? 'library.collapseAllGroups' : 'library.expandAllGroups')}
						aria-label={t(collapse ? 'library.collapseAllGroups' : 'library.expandAllGroups')}
						onClick={() => setCollapsed(collapse ? new Set(groups.map((group) => group.key)) : new Set())}
					>
						<Icon name={collapse ? 'chevrons-down-up' : 'chevrons-up-down'} />
					</div>
				</div>
				<div
					ref={filterButton}
					class={`dashboard-library-filter-btn${config.quickDateFilter || config.folderFilter?.length ? ' active' : ''}`}
					role="button"
					tabIndex={0}
					title={t('library.quickFilter')}
					onClick={() => setFilterOpen(!filterOpen)}
				>
					<Icon name="filter" />
				</div>
				{filterOpen && filterButton.current && (
					<QuickFilter
						anchor={filterButton.current}
						config={config}
						update={update}
						close={() => setFilterOpen(false)}
					/>
				)}
				<div class="dashboard-library-toolbar-spacer" />
				<div class="dashboard-library-count">{t('library.fileCount', { count: results.length })}</div>
				<select
					class={`dashboard-library-page-size${grouped ? ' is-hidden' : ''}`}
					value={size}
					onChange={(event) =>
						update({ ...config, pageSize: Number(event.currentTarget.value) || DEFAULT_PAGE_SIZE })
					}
				>
					{PAGE_SIZE_OPTIONS.map((size) => (
						<option key={size} value={size}>
							{t('library.pageSize', { count: size })}
						</option>
					))}
				</select>
				<IconButton
					className="dashboard-library-newnote-btn"
					icon="file-plus"
					label={t('library.newNote')}
					onClick={(event) =>
						root.dispatchEvent(
							new CustomEvent('dashboard-library-new-note', {
								detail: { columnName: column.name, x: event.clientX, y: event.clientY },
								bubbles: true,
							}),
						)
					}
				/>
				{config.viewMode === 'table' && <IconButton className="dashboard-library-columns-btn" icon="columns-3" label={t('library.tableColumns')} ariaExpanded={columnsOpen} onClick={() => setColumnsOpen(value => !value)} />}
				<IconButton
					className="dashboard-library-config-btn"
					icon="settings"
					label={t('library.configure')}
					onClick={() =>
						root.dispatchEvent(
							new CustomEvent('dashboard-library-config', {
								detail: { columnName: column.name },
								bubbles: true,
							}),
						)
					}
				/>
			</div>
			{config.viewMode === 'table' && columnsOpen && <TableColumnsEditor config={config} candidates={tableCandidates} change={update} />}
			{skip && results.length > SECTION_CANDIDATE_LIMIT && <p class="dashboard-library-window-notice" role="status">{t('library.windowLimit', { limit: SECTION_CANDIDATE_LIMIT, total: results.length })}</p>}
			<div class="dashboard-library-files" data-view-mode={config.viewMode}>
				{results.length === 0 ? (
					<div class="dashboard-library-empty">
						{t(!config.filters.length && !config.folders?.length ? 'library.noConfig' : 'library.noFiles')}
					</div>
				) : grouped ? (
					groups.map((group) => {
						const window = progressive.group(group.key, group.items);
						return <Fragment key={group.key}>
							<div
								class={`dashboard-library-group-header${collapsed.has(group.key) ? ' is-collapsed' : ''}${group.isNoGroup ? ' is-nogroup' : ''}`}
								data-group-key={group.key}
								onClick={() =>
									setCollapsed((previous) => {
										const next = new Set(previous);
										if (next.has(group.key)) next.delete(group.key);
										else next.add(group.key);
										return next;
									})
								}
							>
								<div class="dashboard-library-group-chevron">
									<Icon name={collapsed.has(group.key) ? 'chevron-right' : 'chevron-down'} />
								</div>
								<div class="dashboard-library-group-name">{group.label}</div>
								<div class="dashboard-library-group-count">{group.items.length}</div>
							</div>
							<div class={`dashboard-library-group-body${collapsed.has(group.key) ? ' is-hidden' : ''}`}>
								{view(window.items)}
								<GroupWindow label={group.label} {...window} more={() => progressive.more(group.key, window.available)} />
							</div>
						</Fragment>;
					})
				) : (
					view(items)
				)}
			</div>
			<div class="dashboard-library-pagination">
				{!skip && pages > 1 && (
					<Pagination
						page={current}
						pages={pages}
						change={(next) => {
							setPage(next);
							root.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
						}}
					/>
				)}
			</div>
		</>
	);
}
