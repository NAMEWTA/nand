// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDownUp, ChevronLeft, Ellipsis, Eye, EyeOff, FilePlus, FileText, Folder, LayoutList, ListTree, Pin, Search } from 'lucide-react';
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	DropdownMenuItem,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
} from '../../../ui/components/dropdown-menu';
import { Button } from '../../../ui/components/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../ui/components/tooltip';
import { EmptyState } from '../../../ui/components/nand/EmptyState';
import { cn } from '../../../ui/lib/utils';
import { useT } from '../../../ui/react/hooks';
import { formatNoteDate } from '../core/format-date';
import { HEADER_ROW_HEIGHT, noteRowHeight, thumbnailSize, type RowMetrics } from '../core/layout';
import type { ListAppearance } from '../core/appearance';
import { tagTerm } from '../core/search';
import { isSelected } from '../core/selection';
import type { NoteEntry } from '../core/types';
import type { NavigatorSettings } from '../settings';
import { EntryIcon } from './EntryIcon';
import { InlineEditor } from './InlineEditor';
import { PaneMenu } from './PaneMenu';
import { SearchBar } from './SearchBar';
import { startDrag } from './dnd';
import { useEnv, useIconsVersion, useIndexVersion, useNav, useNavigatorSettings, usePreviewVersion } from './hooks';
import { bucketLabel, contextLabel, folderLabel, uiLocale } from './labels';
import { focusWhenVisible, handlePaneKey, usePaneKeyScope } from './keys';
import { noteMenu, type MenuEntry } from './menus';
import { ToolbarButton } from './NavPane';

function metricsOf(settings: NavigatorSettings, appearance: ListAppearance): RowMetrics {
	return {
		compact: appearance.compact,
		titleRows: appearance.titleRows,
		previewRows: appearance.previewRows,
		showPreview: settings.showPreview,
		showThumbnail: settings.showThumbnail,
		showDate: settings.showDate,
		showTags: settings.showNoteTags,
		showParentFolder: settings.showParentFolder,
	};
}

/** List pane: the notes of the selected folder or tag, grouped and virtualized. */
export function ListPane() {
	const env = useEnv();
	const { service } = env;
	const t = useT();
	const titleId = useId();
	const settings = useNavigatorSettings(service);
	useIndexVersion(service);
	usePreviewVersion(env);
	const iconsVersion = useIconsVersion(env);
	const context = useNav(service, (state) => state.context);
	const selection = useNav(service, (state) => state.selection);
	const renaming = useNav(service, (state) => state.renaming);
	const pane = useNav(service, (state) => state.pane);
	const scroll = useNav(service, (state) => state.listScroll);
	const focusNonce = useNav(service, (state) => state.focusNonce);
	const menuRequest = useNav(service, (state) => state.menuRequest);
	const searchOpen = useNav(service, (state) => state.search.open);
	const items = service.listItems();
	const notes = service.contextNotes();
	const appearance = service.appearance();
	const matcher = service.hidden();
	const scrollRef = useRef<HTMLDivElement>(null);
	const [menu, setMenu] = useState<MenuEntry[]>([]);
	const metrics = metricsOf(settings, appearance);
	const rowHeight = noteRowHeight(metrics);
	const byPath = useMemo(() => new Map(notes.map((note): [string, NoteEntry] => [note.path, note])), [notes]);
	const indexOfPath = useMemo(() => {
		const map = new Map<string, number>();
		items.forEach((item, index) => { if (item.kind === 'note') map.set(item.path, index); });
		return map;
	}, [items]);
	const single = settings.layout === 'single';

	const virtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: (index) => (items[index]?.kind === 'header' ? HEADER_ROW_HEIGHT : rowHeight),
		overscan: 8,
		getItemKey: (index) => items[index]?.key ?? index,
	});
	// Row heights are a pure function of the settings; remeasure when they change.
	useEffect(() => { virtualizer.measure(); }, [rowHeight, virtualizer]);

	useEffect(() => {
		if (!scroll) return;
		const index = indexOfPath.get(scroll.key);
		if (index !== undefined) virtualizer.scrollToIndex(index, { align: 'auto' });
		// eslint-disable-next-line react-hooks/exhaustive-deps -- run once per scroll request
	}, [scroll?.nonce]);

	useEffect(() => {
		if (pane === 'list' && focusNonce > 0) focusWhenVisible(scrollRef.current);
	}, [focusNonce, pane]);

	// The keyboard's "context menu" key opens the menu of the row under the cursor.
	useEffect(() => {
		if (!menuRequest || menuRequest.pane !== 'list' || !selection.cursor) return;
		const row = scrollRef.current?.querySelector<HTMLElement>(`#${CSS.escape(rowId(selection.cursor))}`);
		if (!row) return;
		const rect = row.getBoundingClientRect();
		const View = row.ownerDocument.defaultView ?? window;
		row.dispatchEvent(new View.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: rect.left + 24, clientY: rect.top + rect.height / 2 }));
		// eslint-disable-next-line react-hooks/exhaustive-deps -- run once per request
	}, [menuRequest?.nonce]);

	const pageSize = () => Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? 400) / rowHeight) - 1);
	const handleKey = (event: KeyboardEvent) => !service.state.getState().renaming && handlePaneKey(env, 'list', event, pageSize());
	usePaneKeyScope(env, scrollRef, handleKey);
	const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		if (event.target !== event.currentTarget || !handleKey(event.nativeEvent)) return;
		event.preventDefault();
		event.stopPropagation();
	};

	const click = (event: MouseEvent, path: string) => {
		const mod = env.isMac ? event.metaKey : event.ctrlKey;
		service.selectNote(path, event.shiftKey ? 'range' : mod ? 'toggle' : 'only');
		scrollRef.current?.focus({ preventScroll: true });
	};

	const cursor = selection.cursor;
	const total = notes.length;

	return (
		<section aria-labelledby={titleId} className="@container flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground" data-navigator-pane="list">
			<header className="flex shrink-0 items-center gap-1 border-b border-sidebar-border px-2 py-1">
				{single && (
					<ToolbarButton label={t('navigator.back')} onClick={() => service.setSingleView('nav')}><ChevronLeft /></ToolbarButton>
				)}
				<div className="min-w-0 flex-1 px-1">
					<span id={titleId} className="block truncate text-[13px] font-medium">{contextLabel(context)}</span>
					<span className="block truncate whitespace-nowrap text-[11px] text-muted-foreground">{t('navigator.noteCount', { count: total })}</span>
				</div>
				{/* Narrow panes keep only the menu; everything else is inside it. */}
				<div className="hidden shrink-0 items-center @min-[16rem]:flex">
					<ToolbarButton label={t('navigator.search')} active={searchOpen} onClick={() => (searchOpen ? service.closeSearch() : service.openSearch())}><Search /></ToolbarButton>
					<ToolbarButton label={t('navigator.newNote')} onClick={() => { void service.newNote().catch(env.report); }}><FilePlus /></ToolbarButton>
					<ToolbarButton label={t('navigator.includeDescendants')} active={appearance.includeDescendants} onClick={() => service.toggleDescendants()}><ListTree /></ToolbarButton>
					<SortMenu appearance={appearance} settings={settings} env={env} />
				</div>
				<div className="shrink-0"><MoreMenu appearance={appearance} settings={settings} env={env} searchOpen={searchOpen} /></div>
			</header>
			{searchOpen && <SearchBar />}
			<PaneMenu entries={menu}>
				<div
					ref={scrollRef}
					role="listbox"
					aria-multiselectable
					tabIndex={0}
					aria-labelledby={titleId}
					aria-activedescendant={cursor ? rowId(cursor) : undefined}
					className="h-full overflow-y-auto outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
					onKeyDown={onKeyDown}
					onFocus={(event) => { if (event.target === event.currentTarget) service.setPane('list'); }}
				>
					{items.length === 0 ? (
						<EmptyState icon={<FileText />} title={t('navigator.empty')} description={t('navigator.emptyHint')} className="h-full" />
					) : (
						<div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
							{virtualizer.getVirtualItems().map((virtual) => {
								const item = items[virtual.index];
								if (!item) return null;
								const placement = { height: virtual.size, transform: `translateY(${virtual.start}px)` };
								if (item.kind === 'header') {
									return (
										<div key={virtual.key} role="presentation" className="absolute left-0 top-0 flex w-full items-end gap-1.5 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" style={placement}>
											{item.section === 'pinned' && <Pin aria-hidden className="mb-0.5 size-3" />}
											<span className="truncate">
												{item.section === 'pinned' ? t('navigator.pinned') : item.section === 'date' && item.bucket ? bucketLabel(item.bucket) : item.section === 'property' ? (item.value ?? t('navigator.none')) : folderLabel(item.folder ?? '/')}
											</span>
											<span className="tabular-nums">{item.count}</span>
										</div>
									);
								}
								const note = byPath.get(item.path);
								if (!note) return null;
								const selected = isSelected(selection, item.path);
								return (
									<NoteRow
										key={virtual.key}
										note={note}
										pinned={item.pinned}
										metrics={metrics}
										appearance={appearance}
										hidden={settings.showHidden && matcher.note(note)}
										selected={selected}
										focused={pane === 'list' && cursor === item.path}
										editing={renaming?.folder === false && renaming.path === item.path}
										style={placement}
										onSelect={(event) => click(event, item.path)}
										onMenu={() => {
											if (!selected) service.selectNote(item.path, 'only');
											setMenu(noteMenu(env, item.path));
										}}
										iconsVersion={iconsVersion}
									/>
								);
							})}
						</div>
					)}
				</div>
			</PaneMenu>
		</section>
	);
}

const rowId = (path: string) => `note-row-${encodeURIComponent(path)}`;

function NoteRow({ note, pinned, metrics, appearance, hidden, selected, focused, editing, style, onSelect, onMenu, iconsVersion }: {
	note: NoteEntry;
	pinned: boolean;
	metrics: RowMetrics;
	appearance: ListAppearance;
	hidden: boolean;
	selected: boolean;
	focused: boolean;
	editing: boolean;
	style: { height: number; transform: string };
	onSelect: (event: MouseEvent) => void;
	onMenu: () => void;
	iconsVersion: number;
}) {
	const env = useEnv();
	const { service } = env;
	const t = useT();
	const settings = useNavigatorSettings(service);
	const wantsContent = settings.showPreview || settings.showThumbnail;
	useEffect(() => {
		if (wantsContent) env.previews.request(note.path);
	}, [env, note.path, note.mtime, wantsContent, settings.imageProperties]);
	const record = wantsContent ? env.previews.get(note.path) : undefined;
	const [brokenImage, setBrokenImage] = useState<string | null>(null);
	const date = settings.showDate ? formatNoteDate(settings.sortBy === 'created' ? note.ctime : note.mtime, Date.now(), settings.dateFormat, uiLocale()) : '';
	const thumb = settings.showThumbnail && record?.image && record.image !== brokenImage && !metrics.compact ? thumbnailSize(style.height) : 0;
	const visibleTags = settings.showNoteTags ? note.tags.slice(0, 3) : [];
	const hasMeta = !!date || visibleTags.length > 0 || settings.showParentFolder;

	return (
		<div
			id={rowId(note.path)}
			role="option"
			aria-selected={selected}
			data-note-path={note.path}
			draggable={!editing}
			className={cn(
				'absolute left-0 top-0 flex w-full cursor-default items-start gap-2 border-b border-sidebar-border/40 px-3 py-1.5 text-left',
				selected ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-sidebar-accent/50',
				focused && 'ring-[3px] ring-inset ring-ring/50',
				metrics.compact && 'items-center py-0',
				hidden && 'opacity-50',
			)}
			style={style}
			onClick={onSelect}
			onDoubleClick={() => service.openNote(note.path, { focus: true })}
			onAuxClick={(event) => { if (event.button === 1) { event.preventDefault(); service.openNote(note.path, { newTab: true }); } }}
			onContextMenu={onMenu}
			onDragStart={(event) => startDrag(event, service.dragPaths(note.path), true)}
		>
			{metrics.compact && <EntryIcon env={env} version={iconsVersion} target={{ kind: 'file', key: note.path }} />}
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-1.5">
					{!metrics.compact && pinned && <Pin aria-hidden className="size-3 shrink-0 text-muted-foreground" />}
					{editing ? (
						<InlineEditor initial={note.name} ariaLabel={t('navigator.rename')} onCommit={(name) => service.commitRename(name)} onCancel={() => service.cancelRename()} />
					) : (
						<span className="line-clamp-(--title-rows) min-w-0 flex-1 break-words text-[13px] font-medium leading-5" style={{ ['--title-rows' as string]: appearance.titleRows }}>{note.name}</span>
					)}
					{metrics.compact && date && <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{date}</span>}
				</div>
				{!metrics.compact && settings.showPreview && (
					<p
						className="m-0 line-clamp-(--preview-rows) break-words text-[12px] leading-4 text-muted-foreground"
						style={{ ['--preview-rows' as string]: appearance.previewRows, height: record ? undefined : appearance.previewRows * 16 }}
					>
						{record?.preview}
					</p>
				)}
				{!metrics.compact && hasMeta && (
					<div className="flex h-[18px] items-center gap-1.5 overflow-hidden text-[11px] text-muted-foreground">
						{date && <span className="shrink-0 tabular-nums">{date}</span>}
						{settings.showParentFolder && (
							<span className="flex min-w-0 items-center gap-0.5 truncate"><Folder aria-hidden className="size-3 shrink-0" />{folderLabel(note.folder)}</span>
						)}
						{visibleTags.map((tag) => (
							<button
								key={tag}
								type="button"
								tabIndex={-1}
								className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] leading-4 text-muted-foreground hover:text-foreground"
								onClick={(event) => {
									event.stopPropagation();
									// Mod adds the tag to the search (AND, or OR with Shift); a plain click goes to the tag.
									if (env.isMac ? event.metaKey : event.ctrlKey) service.toggleSearchFilter(tagTerm(tag.toLowerCase()), event.shiftKey ? 'or' : 'and');
									else service.selectContext({ kind: 'tag', key: tag.toLowerCase() });
								}}
							>
								#{tag}
							</button>
						))}
						{note.tags.length > visibleTags.length && settings.showNoteTags && <span className="shrink-0">+{note.tags.length - visibleTags.length}</span>}
					</div>
				)}
			</div>
			{thumb > 0 && record?.image && (
				<img
					alt=""
					loading="lazy"
					draggable={false}
					src={env.imageUrl(record.image)}
					className="shrink-0 rounded-md bg-muted object-cover"
					style={{ width: thumb, height: thumb }}
					onError={() => setBrokenImage(record.image)}
				/>
			)}
		</div>
	);
}

type Env = ReturnType<typeof useEnv>;

function SortItems({ appearance, settings, env }: { appearance: ListAppearance; settings: NavigatorSettings; env: Env }) {
	const t = useT();
	const { service } = env;
	const group = appearance.groupBy === 'property' ? `property:${appearance.groupProperty}` : appearance.groupBy;
	return (
		<>
			<DropdownMenuLabel>{t('navigator.sortBy')}</DropdownMenuLabel>
			<DropdownMenuRadioGroup value={appearance.sortBy} onValueChange={(value) => service.setListOptions({ sortBy: value as NavigatorSettings['sortBy'] })}>
				<DropdownMenuRadioItem value="modified">{t('navigator.sortModified')}</DropdownMenuRadioItem>
				<DropdownMenuRadioItem value="created">{t('navigator.sortCreated')}</DropdownMenuRadioItem>
				<DropdownMenuRadioItem value="name">{t('navigator.sortName')}</DropdownMenuRadioItem>
			</DropdownMenuRadioGroup>
			<DropdownMenuSeparator />
			<DropdownMenuRadioGroup value={appearance.sortDirection} onValueChange={(value) => service.setListOptions({ sortDirection: value as NavigatorSettings['sortDirection'] })}>
				<DropdownMenuRadioItem value="desc">{t('navigator.descending')}</DropdownMenuRadioItem>
				<DropdownMenuRadioItem value="asc">{t('navigator.ascending')}</DropdownMenuRadioItem>
			</DropdownMenuRadioGroup>
			<DropdownMenuSeparator />
			<DropdownMenuLabel>{t('navigator.groupBy')}</DropdownMenuLabel>
			<DropdownMenuRadioGroup
				value={group}
				onValueChange={(value) => {
					if (value.startsWith('property:')) service.setListOptions({ groupBy: 'property', groupProperty: value.slice(9) });
					else service.setListOptions({ groupBy: value as NavigatorSettings['groupBy'] });
				}}
			>
				<DropdownMenuRadioItem value="none">{t('navigator.groupNone')}</DropdownMenuRadioItem>
				<DropdownMenuRadioItem value="date">{t('navigator.groupDate')}</DropdownMenuRadioItem>
				<DropdownMenuRadioItem value="folder">{t('navigator.groupFolder')}</DropdownMenuRadioItem>
				{settings.groupProperties.map((property) => (
					<DropdownMenuRadioItem key={property} value={`property:${property}`}>{t('navigator.groupProperty', { property })}</DropdownMenuRadioItem>
				))}
			</DropdownMenuRadioGroup>
		</>
	);
}

function SortMenu({ appearance, settings, env }: { appearance: ListAppearance; settings: NavigatorSettings; env: Env }) {
	const t = useT();
	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<Button type="button" variant="ghost" size="icon-sm" aria-label={t('navigator.sort')} className="text-muted-foreground [&_svg]:size-4"><ArrowDownUp /></Button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent>{t('navigator.sort')}</TooltipContent>
			</Tooltip>
			<DropdownMenuContent align="end">
				<SortItems appearance={appearance} settings={settings} env={env} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function MoreMenu({ appearance, settings, env, searchOpen }: { appearance: ListAppearance; settings: NavigatorSettings; env: Env; searchOpen: boolean }) {
	const t = useT();
	const { service } = env;
	const hasRules = !service.hidden().empty;
	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<Button type="button" variant="ghost" size="icon-sm" aria-label={t('navigator.more')} className="text-muted-foreground [&_svg]:size-4"><Ellipsis /></Button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent>{t('navigator.more')}</TooltipContent>
			</Tooltip>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onSelect={() => { void service.newNote().catch(env.report); }}>{t('navigator.newNote')}</DropdownMenuItem>
				{env.actions && (
					<DropdownMenuItem onSelect={() => { void env.actions?.newNoteFromTemplate().catch(env.report); }}>{t('navigator.newNoteFromTemplate')}</DropdownMenuItem>
				)}
				{env.actions && settings.createCommands.map((command) => (
					<DropdownMenuItem key={command.id} onSelect={() => { void env.actions?.runCreateCommand(command.id).catch(env.report); }}>{command.name}</DropdownMenuItem>
				))}
				<DropdownMenuCheckboxItem checked={searchOpen} onCheckedChange={() => (searchOpen ? service.closeSearch() : service.openSearch())}>{t('navigator.search')}</DropdownMenuCheckboxItem>
				<DropdownMenuCheckboxItem checked={appearance.includeDescendants} onCheckedChange={() => service.toggleDescendants()}>{t('navigator.includeDescendants')}</DropdownMenuCheckboxItem>
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>{t('navigator.sort')}</DropdownMenuSubTrigger>
					<DropdownMenuSubContent><SortItems appearance={appearance} settings={settings} env={env} /></DropdownMenuSubContent>
				</DropdownMenuSub>
				<DropdownMenuItem onSelect={() => env.openAppearance(service.state.getState().context)}>
					<LayoutList aria-hidden />
					{t('navigator.appearance')}
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuCheckboxItem checked={appearance.compact} onCheckedChange={() => service.toggleCompact()}>{t('navigator.compact')}</DropdownMenuCheckboxItem>
				{(hasRules || settings.showHidden) && (
					<DropdownMenuCheckboxItem checked={settings.showHidden} onCheckedChange={() => service.toggleShowHidden()}>
						{settings.showHidden ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
						{t('navigator.showHidden')}
					</DropdownMenuCheckboxItem>
				)}
				<DropdownMenuCheckboxItem checked={settings.layout === 'single'} onCheckedChange={() => service.toggleLayout()}>{t('navigator.singlePane')}</DropdownMenuCheckboxItem>
				<DropdownMenuCheckboxItem disabled={settings.layout === 'single'} checked={settings.orientation === 'horizontal'} onCheckedChange={() => service.toggleOrientation()}>{t('navigator.sideBySide')}</DropdownMenuCheckboxItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={env.openSettings}>{t('navigator.settings')}</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
