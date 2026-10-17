// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { useEffect, useId, useRef, useState, type DragEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CalendarDays, ChevronRight, ChevronsDownUp, ChevronsUpDown, Eye, EyeOff, FolderPlus, Layers, Search, Settings2 } from 'lucide-react';
import { Button } from '../../../ui/components/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../ui/components/tooltip';
import { cn } from '../../../ui/lib/utils';
import { useOwnerWindow, useT } from '../../../ui/react/hooks';
import { contextKey, ROOT_FOLDER } from '../core/types';
import { NAV_ROW_HEIGHT } from '../core/layout';
import type { NavRow } from '../core/nav-tree';
import { normalizeSections, type SectionId } from '../core/sections';
import { makeShortcut, shortcutContext, shortcutForContext } from '../core/shortcuts';
import { propertyTerm, tagTerm } from '../core/search';
import type { IconTarget } from '../../icons/api';
import { CalendarPanel } from './Calendar';
import { EntryIcon } from './EntryIcon';
import { InlineEditor } from './InlineEditor';
import { PaneMenu } from './PaneMenu';
import {
	addTargetPayload,
	hasDragPaths,
	hasDragType,
	readDragPaths,
	readTargetPayload,
	SECTION_DND,
	SHORTCUT_DND,
	startDrag,
	startPayloadDrag,
	TARGET_DND,
	upperHalf,
} from './dnd';
import { useEnv, useIconsVersion, useIndexVersion, useNav, useNavigatorSettings } from './hooks';
import { focusWhenVisible, handlePaneKey, usePaneKeyScope } from './keys';
import { navMenu, type MenuEntry } from './menus';

const SPRING_MS = 650;
const rowId = (key: string) => `nav-row-${encodeURIComponent(key)}`;

/** Where a dragged row would land relative to the row under the pointer. */
interface DropMark { key: string; edge: 'before' | 'after' | 'into' }

function iconTarget(row: NavRow): IconTarget | null {
	switch (row.kind) {
		case 'folder': return { kind: 'folder', key: row.path };
		case 'tag': return { kind: 'tag', key: row.display ?? row.path };
		case 'property':
		case 'propertyValue': return { kind: 'property', key: row.path };
		case 'untagged': return { kind: 'property', key: '' };
		case 'recent': return { kind: 'file', key: row.path };
		case 'shortcut': {
			const shortcut = row.shortcut;
			if (!shortcut) return null;
			switch (shortcut.kind) {
				case 'note': return { kind: 'file', key: shortcut.key };
				case 'folder': return { kind: 'folder', key: shortcut.key };
				case 'tag': return { kind: 'tag', key: shortcut.key };
				case 'property': {
					const context = shortcutContext(shortcut);
					return { kind: 'property', key: context?.kind === 'property' ? context.key : shortcut.key };
				}
				default: return null;
			}
		}
		default: return null;
	}
}

/** The search term a Mod-click on a tag or property row adds. */
function filterTerm(row: NavRow): string | undefined {
	if (row.kind === 'tag') return tagTerm(row.display ?? row.path);
	if (row.kind === 'property') return propertyTerm(row.label);
	if (row.kind === 'propertyValue') return propertyTerm(row.path, row.label);
	return undefined;
}

/** Navigation pane: shortcuts, recent notes, folders, tags and properties in one virtualized list. */
export function NavPane() {
	const env = useEnv();
	const { service } = env;
	const t = useT();
	const titleId = useId();
	const win = useOwnerWindow();
	const settings = useNavigatorSettings(service);
	useIndexVersion(service);
	const iconsVersion = useIconsVersion(env);
	const expandedFolders = useNav(service, (state) => state.expandedFolders);
	const expandedTags = useNav(service, (state) => state.expandedTags);
	const expandedProperties = useNav(service, (state) => state.expandedProperties);
	const context = useNav(service, (state) => state.context);
	const renaming = useNav(service, (state) => state.renaming);
	const pane = useNav(service, (state) => state.pane);
	const searchOpen = useNav(service, (state) => state.search.open);
	const scroll = useNav(service, (state) => state.navScroll);
	const focusNonce = useNav(service, (state) => state.focusNonce);
	const navFocus = useNav(service, (state) => state.navFocus);
	const menuRequest = useNav(service, (state) => state.menuRequest);
	const tree = service.navTree();
	const matcher = service.hidden();
	void expandedFolders; void expandedTags; void expandedProperties;
	const scrollRef = useRef<HTMLDivElement>(null);
	const [menu, setMenu] = useState<MenuEntry[]>([]);
	const [mark, setMark] = useState<DropMark | null>(null);
	const spring = useRef<{ key: string; timer: number } | null>(null);
	const selectedKey = contextKey(context);
	// The row the keyboard is on: a section, shortcut or recent row while one has it, otherwise the selected row.
	const navFocusKey = navFocus && tree.indexByKey.has(navFocus) ? navFocus : selectedKey;
	const sections = normalizeSections(settings.sections);

	const virtualizer = useVirtualizer({
		count: tree.rows.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => NAV_ROW_HEIGHT,
		overscan: 10,
		getItemKey: (index) => tree.rows[index]?.key ?? index,
	});

	useEffect(() => {
		if (!scroll) return;
		const index = tree.indexByKey.get(scroll.key);
		if (index !== undefined) virtualizer.scrollToIndex(index, { align: 'auto' });
		// eslint-disable-next-line react-hooks/exhaustive-deps -- run once per scroll request
	}, [scroll?.nonce]);

	useEffect(() => {
		if (pane === 'nav' && focusNonce > 0) focusWhenVisible(scrollRef.current);
	}, [focusNonce, pane]);

	// The keyboard's "context menu" key opens the menu of the row it is on, as a right click there would.
	useEffect(() => {
		if (!menuRequest || menuRequest.pane !== 'nav') return;
		const row = scrollRef.current?.querySelector<HTMLElement>(`#${CSS.escape(rowId(navFocusKey))}`);
		if (!row) return;
		const rect = row.getBoundingClientRect();
		const View = row.ownerDocument.defaultView ?? window;
		row.dispatchEvent(new View.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: rect.left + 24, clientY: rect.top + rect.height / 2 }));
		// eslint-disable-next-line react-hooks/exhaustive-deps -- run once per request
	}, [menuRequest?.nonce]);

	useEffect(() => () => { if (spring.current) win.clearTimeout(spring.current.timer); }, [win]);

	const pageSize = () => Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? 320) / NAV_ROW_HEIGHT) - 1);
	const handleKey = (event: KeyboardEvent) => !service.state.getState().renaming && handlePaneKey(env, 'nav', event, pageSize());
	usePaneKeyScope(env, scrollRef, handleKey);
	const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		if (event.target !== event.currentTarget || !handleKey(event.nativeEvent)) return;
		event.preventDefault();
		event.stopPropagation();
	};

	const clearSpring = () => {
		if (spring.current) win.clearTimeout(spring.current.timer);
		spring.current = null;
	};
	const armSpring = (row: NavRow) => {
		if (row.kind !== 'folder' || !row.hasChildren || row.expanded || spring.current?.key === row.key) return;
		clearSpring();
		spring.current = { key: row.key, timer: win.setTimeout(() => { spring.current = null; service.setExpanded(row, true); }, SPRING_MS) };
	};

	const modKey = (event: MouseEvent) => (env.isMac ? event.metaKey : event.ctrlKey);
	const canMove = (row: NavRow, transfer: DataTransfer | null) => hasDragPaths(transfer) && (row.kind === 'folder' || row.kind === 'tag');
	const pinsTarget = (transfer: DataTransfer | null) => hasDragPaths(transfer) || hasDragType(transfer, TARGET_DND);

	/** What dragging over `row` would do, or null when it does not take the dragged data. */
	const dropEdge = (row: NavRow, event: DragEvent): DropMark['edge'] | null => {
		const transfer = event.dataTransfer;
		if (row.kind === 'section' && hasDragType(transfer, SECTION_DND)) return upperHalf(event) ? 'before' : 'after';
		if (row.kind === 'shortcut' && hasDragType(transfer, SHORTCUT_DND)) return upperHalf(event) ? 'before' : 'after';
		if ((row.kind === 'shortcut' || (row.kind === 'section' && row.section === 'shortcuts')) && pinsTarget(transfer)) return 'into';
		return canMove(row, transfer) ? 'into' : null;
	};

	/** Pin whatever was dragged: folders and notes by path, folders/tags/properties by their target payload. */
	const pinDropped = (transfer: DataTransfer) => {
		const target = readTargetPayload(transfer);
		if (target) {
			const shortcut = makeShortcut(target.kind, target.key);
			if (!service.isShortcut(shortcut.kind, shortcut.key)) service.toggleShortcut(shortcut);
			return;
		}
		for (const path of readDragPaths(transfer)) {
			const folder = service.index.folders().includes(path);
			const shortcut = makeShortcut(folder ? 'folder' : 'note', path);
			if (!service.isShortcut(shortcut.kind, shortcut.key)) service.toggleShortcut(shortcut);
		}
	};

	const drop = (row: NavRow, event: DragEvent) => {
		const transfer = event.dataTransfer;
		const edge = dropEdge(row, event);
		setMark(null);
		clearSpring();
		if (!edge) return;
		event.preventDefault();
		if (row.kind === 'section' && hasDragType(transfer, SECTION_DND)) {
			const moving = transfer.getData(SECTION_DND) as SectionId;
			const at = sections.indexOf(row.section!);
			service.moveSection(moving, edge === 'before' ? row.section! : (sections[at + 1] ?? null));
		} else if (row.kind === 'shortcut' && hasDragType(transfer, SHORTCUT_DND) && row.shortcut) {
			const list = settings.shortcuts;
			const at = list.findIndex((entry) => entry.id === row.shortcut!.id);
			service.moveShortcut(transfer.getData(SHORTCUT_DND), edge === 'before' ? row.shortcut.id : (list[at + 1]?.id ?? null));
		} else if (row.kind === 'shortcut' || row.kind === 'section') {
			pinDropped(transfer);
		} else {
			const paths = readDragPaths(transfer);
			if (!paths.length) return;
			const task = row.kind === 'folder' ? service.dropOnFolder(paths, row.path) : service.dropOnTag(paths, row.path);
			void task.catch(env.report);
		}
	};

	const allExpanded = tree.rows.some((row) => row.hasChildren && row.expanded && row.depth > 0);
	const profiles = service.profiles();
	const activeProfile = profiles.find((profile) => profile.active);
	const banner = activeProfile?.banner ? env.imageUrl(activeProfile.banner) : '';

	return (
		<section aria-labelledby={titleId} className="@container flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground" data-navigator-pane="nav">
			<header className="flex shrink-0 items-center justify-between gap-1 border-b border-sidebar-border px-2 py-1">
				<span id={titleId} className="truncate px-1 text-xs font-medium text-muted-foreground @max-[10rem]:hidden">{profiles.length > 1 && activeProfile ? activeProfile.name : t('navigator.navigation')}</span>
				<div className="flex items-center">
					<ToolbarButton label={t('navigator.search')} active={searchOpen} onClick={() => service.openSearch()}><Search /></ToolbarButton>
					<ToolbarButton label={t('navigator.newFolder')} onClick={() => { void service.newFolder().catch(env.report); }}><FolderPlus /></ToolbarButton>
					<ToolbarButton label={t(allExpanded ? 'navigator.collapseAll' : 'navigator.expandAll')} onClick={() => (allExpanded ? service.collapseAll() : service.expandAll())}>
						{allExpanded ? <ChevronsDownUp /> : <ChevronsUpDown />}
					</ToolbarButton>
					{(!matcher.empty || settings.showHidden) && (
						<ToolbarButton label={t(settings.showHidden ? 'navigator.hideHidden' : 'navigator.showHidden')} active={settings.showHidden} onClick={() => service.toggleShowHidden()}>
							{settings.showHidden ? <Eye /> : <EyeOff />}
						</ToolbarButton>
					)}
					{env.actions && <div className="hidden @min-[12rem]:block"><ToolbarButton label={t('navigator.calendar')} active={settings.calendarOpen} onClick={() => service.toggleCalendar()}><CalendarDays /></ToolbarButton></div>}
					{env.actions && profiles.length > 1 && <div className="hidden @min-[14rem]:block"><ToolbarButton label={t('navigator.selectProfile')} onClick={() => { void env.actions?.chooseProfile().catch(env.report); }}><Layers /></ToolbarButton></div>}
					<div className="hidden @min-[9rem]:block"><ToolbarButton label={t('navigator.settings')} onClick={env.openSettings}><Settings2 /></ToolbarButton></div>
				</div>
			</header>
			{banner && <img alt="" src={banner} className="h-16 w-full shrink-0 object-cover" data-navigator-banner />}
			<PaneMenu entries={menu} className="min-h-24">
				<div
					ref={scrollRef}
					role="tree"
					tabIndex={0}
					aria-labelledby={titleId}
					aria-activedescendant={rowId(navFocusKey)}
					className="h-full overflow-y-auto outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
					onKeyDown={onKeyDown}
					onFocus={(event) => { if (event.target === event.currentTarget) service.setPane('nav'); }}
				>
					<div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
						{virtualizer.getVirtualItems().map((item) => {
							const row = tree.rows[item.index];
							if (!row) return null;
							const isSection = row.kind === 'section';
							const selected = !isSection && (row.context ? row.key === selectedKey : false);
							const editing = renaming?.folder === true && row.kind === 'folder' && renaming.path === row.path;
							const shownHidden = !!row.hidden || (settings.showHidden && row.kind === 'folder' && matcher.folder(row.path));
							const keyboardFocus = pane === 'nav' && row.key === navFocusKey && !!navFocus;
							const target = iconTarget(row);
							const marked = mark?.key === row.key ? mark.edge : null;
							const draggable = !editing && (row.kind === 'section' || row.kind === 'shortcut' || row.kind === 'tag' || row.kind === 'property' || row.kind === 'propertyValue' || (row.kind === 'folder' && row.path !== ROOT_FOLDER));
							return (
								<div
									key={item.key}
									id={rowId(row.key)}
									role={isSection ? 'presentation' : 'treeitem'}
									aria-level={row.depth + 1}
									aria-selected={isSection ? undefined : selected}
									aria-expanded={row.hasChildren ? row.expanded : undefined}
									data-nav-key={row.key}
									data-nav-kind={row.kind}
									data-missing={row.missing || undefined}
									draggable={draggable}
									className={cn(
										'absolute left-0 top-0 flex w-full items-center gap-1 pr-2 text-[13px]',
										isSection ? 'cursor-default pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground' : 'cursor-default rounded-md',
										selected && 'bg-sidebar-accent text-sidebar-accent-foreground',
										keyboardFocus && 'ring-[3px] ring-inset ring-ring/50',
										!selected && !isSection && 'hover:bg-sidebar-accent/50',
										(row.missing || shownHidden) && 'opacity-50',
										marked === 'into' && 'bg-primary/15 ring-1 ring-inset ring-primary',
										marked === 'before' && 'shadow-[inset_0_2px_0_0_var(--primary)]',
										marked === 'after' && 'shadow-[inset_0_-2px_0_0_var(--primary)]',
									)}
									style={{ height: item.size, transform: `translateY(${item.start}px)`, paddingLeft: 8 + row.depth * 14 }}
									onClick={(event) => {
										const term = filterTerm(row);
										if (term && modKey(event)) { service.toggleSearchFilter(term, event.shiftKey ? 'or' : 'and'); return; }
										service.activateRow(row);
									}}
									onDoubleClick={() => { if (row.hasChildren) service.toggleExpanded(row); }}
									onContextMenu={(event) => {
										if (row.context) service.selectContext(row.context);
										const entries = navMenu(env, row);
										setMenu(entries);
										if (!entries.length) event.stopPropagation();
									}}
									onDragStart={(event) => {
										if (row.kind === 'section' && row.section) { startPayloadDrag(event, SECTION_DND, row.section); return; }
										if (row.kind === 'shortcut' && row.shortcut) { startPayloadDrag(event, SHORTCUT_DND, row.shortcut.id); return; }
										if (row.kind === 'folder') {
											startDrag(event, [row.path], false);
											addTargetPayload(event, { kind: 'folder', key: row.path });
										} else if (row.context) {
											if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copyMove';
											const shortcut = shortcutForContext(row.context);
											if (shortcut) addTargetPayload(event, { kind: shortcut.kind as 'tag' | 'property', key: shortcut.key });
										}
									}}
									onDragOver={(event) => {
										const edge = dropEdge(row, event);
										if (!edge) return;
										event.preventDefault();
										event.dataTransfer.dropEffect = 'move';
										if (mark?.key !== row.key || mark.edge !== edge) setMark({ key: row.key, edge });
										armSpring(row);
									}}
									onDragLeave={(event) => {
										if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
										setMark((current) => (current?.key === row.key ? null : current));
										if (spring.current?.key === row.key) clearSpring();
									}}
									onDrop={(event) => drop(row, event)}
									onDragEnd={() => setMark(null)}
								>
									{isSection ? (
										<SectionHeader row={row} />
									) : (
										<>
											<span
												aria-hidden
												className={cn('inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-sidebar-accent', !row.hasChildren && 'invisible')}
												onClick={(event) => { event.stopPropagation(); service.toggleExpanded(row); }}
											>
												<ChevronRight className={cn('size-3.5 transition-transform motion-reduce:transition-none', row.expanded && 'rotate-90')} />
											</span>
											{target ? <EntryIcon env={env} version={iconsVersion} open={row.expanded} target={target} /> : <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
											{editing ? (
												<InlineEditor
													initial={row.label}
													ariaLabel={t('navigator.rename')}
													onCommit={(name) => service.commitRename(name)}
													onCancel={() => service.cancelRename()}
												/>
											) : (
												<span className={cn('min-w-0 flex-1 truncate', row.missing && 'line-through')}>{row.label}</span>
											)}
											{!editing && row.count > 0 && <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{row.count}</span>}
										</>
									)}
								</div>
							);
						})}
					</div>
				</div>
			</PaneMenu>
			{settings.calendarOpen && <CalendarPanel />}
		</section>
	);
}

/** A section title that folds and unfolds its rows. */
function SectionHeader({ row }: { row: NavRow }) {
	const { service } = useEnv();
	return (
		<button
			type="button"
			tabIndex={-1}
			aria-expanded={row.expanded}
			className="flex h-auto min-w-0 flex-1 cursor-pointer items-center justify-start gap-1 rounded-sm border-0 bg-transparent p-0 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground shadow-none"
			onClick={(event) => { event.stopPropagation(); if (row.section) service.toggleSection(row.section); }}
		>
			<ChevronRight aria-hidden className={cn('size-3 shrink-0 transition-transform motion-reduce:transition-none', row.expanded && 'rotate-90')} />
			<span className="truncate">{row.label}</span>
		</button>
	);
}

export function ToolbarButton({ label, onClick, children, active }: { label: string; onClick: () => void; children: ReactNode; active?: boolean }) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button type="button" variant="ghost" size="icon-sm" aria-label={label} aria-pressed={active} className={cn('text-muted-foreground [&_svg]:size-4', active && 'bg-sidebar-accent text-foreground')} onClick={onClick}>
					{children}
				</Button>
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}
