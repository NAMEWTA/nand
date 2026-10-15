// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/browser-pane/assemble-chrome/browser-navigation-control-row.tsx, browser-chrome-toolbar.tsx, BrowserAddressBar.tsx, BrowserAddressBarSuggestionList.tsx, BrowserFind.tsx, browser-toolbar-menu-dropdown.tsx; src/renderer/src/components/browser-pane/navigate/browser-page-download-list.tsx, browser-load-failure-overlay.tsx
import { createElement, useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { useStore } from 'zustand';
import {
	ArrowLeft,
	ArrowRight,
	RefreshCw,
	Loader2,
	Ellipsis,
	Crosshair,
	MessageSquarePlus,
	PenTool,
	SquareCode,
	ExternalLink,
	Shield,
	ShieldAlert,
	FileText,
	ChevronUp,
	ChevronDown,
	X,
	CloudOff,
	Check,
	Plus,
	Globe,
	Search,
} from 'lucide-react';
import { toast } from 'sonner';
import type { BrowserPageHandle } from '../api';
import type { BrowserEngine } from '../services/host';
import { historySuggestions, normalizeBrowserNavigationUrl } from '../core/url';
import { useOwnerDocument } from '../../../ui/react/contexts';
import { useT } from '../../../ui/react/hooks';
import { Command, CommandGroup, CommandItem, CommandList } from '../../../ui/components/command';
import { Button } from '../../../ui/components/button';
import { Input } from '../../../ui/components/input';
import { Popover, PopoverTrigger, PopoverContent, PopoverAnchor } from '../../../ui/components/popover';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	DropdownMenuSub,
	DropdownMenuSubTrigger,
	DropdownMenuSubContent,
} from '../../../ui/components/dropdown-menu';
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from '../../../ui/components/context-menu';
import { Tooltip, TooltipTrigger, TooltipContent } from '../../../ui/components/tooltip';
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogCancel,
	AlertDialogAction,
} from '../../../ui/components/alert-dialog';
import { EmptyState } from '../../../ui/components/nand/EmptyState';
import { NewProfileDialog } from './NewProfileDialog';
import { CookieImport } from './cookies/CookieImport';
import { DesignTools } from './design/DesignTools';
import { mountBrowserKeyScope } from './browser-key-scope';
function Tool({
	icon: Icon,
	label,
	onClick,
	disabled = false,
	badge,
}: {
	icon: ComponentType<{ className?: string }>;
	label: string;
	onClick: () => void;
	disabled?: boolean;
	badge?: number;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					size="icon"
					variant="ghost"
					className="relative h-7 w-7 min-h-8 min-w-8 shrink-0"
					aria-label={label}
					disabled={disabled}
					onClick={onClick}
				>
					<Icon className="size-4" />
					{!!badge && (
						<span className="absolute -right-1 -top-1 rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
							{badge}
						</span>
					)}
				</Button>
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}
export function renderBrowserChrome(host: BrowserEngine, page: BrowserPageHandle) {
	return createElement(BrowserChrome, { host, page });
}
export function BrowserChrome({ host, page }: { host: BrowserEngine; page: BrowserPageHandle }) {
	const state = useStore(page.store),
		profiles = useStore(host.profiles),
		t = useT(),
		ownerDocument = useOwnerDocument();
	const root = useRef<HTMLDivElement>(null),
		address = useRef<HTMLInputElement>(null);
	const [draft, setInput] = useState(''),
		[dirty, setDirty] = useState(false),
		[editing, setEditing] = useState(false),
		[suggesting, setSuggesting] = useState(false),
		[selected, setSelected] = useState(0),
		[error, setError] = useState('');
	const input = editing && dirty ? draft : state.url === 'about:blank' ? '' : state.url;
	const addressParts = /^(https?:\/\/)([^/]+)(.*)$/.exec(input);
	const [width, setWidth] = useState(1000),
		[find, setFind] = useState(false),
		[query, setQuery] = useState(''),
		[matchCase, setMatchCase] = useState(false),
		[newProfile, setNewProfile] = useState(false),
		[switchTo, setSwitchTo] = useState(''),
		[count, setCount] = useState<number>();
	const [now, setNow] = useState(Date.now);
	const [design, setDesign] = useState<
		'copy' | 'annotate' | 'draw' | 'screenshot' | 'full' | 'annotations' | undefined
	>();
	const resetDesign = useCallback(() => setDesign(undefined), []);
	const run = (promise: Promise<unknown>) => {
		void promise.catch((error) => toast.error(String(error)));
	};
	const focusAddress = () => {
		address.current?.focus();
		address.current?.select();
	};
	useEffect(() => {
		let live = true;
		void host
			.cookieCount(page.profileId)
			.then((n) => {
				if (live) setCount(n);
			})
			.catch(() => undefined);
		return () => {
			live = false;
		};
	}, [host, page, state.profileId, profiles]);
	useEffect(() => {
		const el = root.current;
		if (!el) return;
		const observer = new (el.win as Window & { ResizeObserver: typeof ResizeObserver }).ResizeObserver(() =>
			setWidth(el.clientWidth),
		);
		observer.observe(el);
		const win = el.win;
		const timer = win.setInterval(() => setNow(Date.now()), 60000);
		return () => {
			observer.disconnect();
			win.clearInterval(timer);
		};
	}, [ownerDocument]);
	useEffect(() => {
		if (state.url === 'about:blank') focusAddress();
	}, [state.url]);
	useEffect(() => {
		if (!query) {
			try {
				page.stopFind();
			} catch {
				/* Guest is starting. */
			}
			return;
		}
		const el = root.current;
		if (!el) return;
		const win = el.win;
		const id = win.setTimeout(() => page.find(query, { matchCase }), 150);
		return () => win.clearTimeout(id);
	}, [page, query, matchCase, ownerDocument]);
	useEffect(() => {
		const el = root.current;
		if (!el) return;
		const shortcut = (key: string) => {
			if (key === 'f') setFind(true);
			else if (key === 'l') focusAddress();
			else if (key === 'r' || key === 'Shift+r') run(page.reload(key === 'Shift+r'));
			else if (['+', '=', '-', '0'].includes(key))
				page.setZoom(key === '0' ? 1 : page.store.getState().zoom + (key === '-' ? -0.1 : 0.1));
			else if (key === 'Shift+c') setDesign('copy');
			else if (key === 'Escape') {
				setFind(false);
				setDesign(undefined);
				run(page.stopGrab());
			}
		};
		page.setShortcutHandler(shortcut);
		const off = mountBrowserKeyScope(host.app, el, host.app.scope, {
			find: () => setFind(true),
			address: focusAddress,
			shortcut,
			escape: () => {
				if (find) {
					setFind(false);
					page.stopFind();
					page.focus();
					return true;
				}
				return false;
			},
		});
		return () => {
			off();
			page.setShortcutHandler(undefined);
		};
	}, [host, page, find, ownerDocument]);
	useEffect(
		() =>
			page.store.subscribe((next, previous) => {
				for (const download of next.downloads)
					if (
						download.state === 'completed' &&
						previous.downloads.find((d) => d.id === download.id)?.state !== 'completed'
					)
						toast.success(t('browser.download.finished', { name: download.name }), {
							action: {
								label: t('browser.openFile'),
								onClick: () => page.downloadAction(download.id, 'open'),
							},
						});
			}),
		[page, t],
	);
	const resolvedAddress = host.resolveInput(input);
	const isSearch = !!resolvedAddress && normalizeBrowserNavigationUrl(input) === null;
	const engine = host.settings.get().searchEngine;
	const engineLabel =
		engine === 'custom'
			? t('browser.custom')
			: { google: 'Google', bing: 'Bing', baidu: '百度', duckduckgo: 'DuckDuckGo' }[engine];
	const suggestions = [
		{
			title: resolvedAddress ? input || resolvedAddress : t('browser.unsupportedAddress'),
			url: input,
			subtitle: isSearch ? t('browser.searchSuggestion', { engine: engineLabel }) : (resolvedAddress ?? ''),
			isSearch,
		},
		...historySuggestions(host.historyStore.history, input).map((row) => ({
			title: row.title || row.url,
			url: row.url,
			subtitle: row.url,
			isSearch: false,
		})),
		...host.workspace
			.list()
			.filter((p) => p.id !== page.id && `${p.title} ${p.url}`.toLowerCase().includes(input.toLowerCase()))
			.slice(0, 4)
			.map((p) => ({
				title: `${p.title} · ${t('browser.switchTab')}`,
				url: p.url,
				subtitle: p.url,
				isSearch: false,
				id: p.id,
			})),
	];
	const navigate = (index = 0) => {
		const suggestion = suggestions[index];
		if (!suggestion) return;
		if ('id' in suggestion && typeof suggestion.id === 'string') {
			host.workspace.activate(suggestion.id);
		} else {
			const url = host.resolveInput(suggestion.url);
			if (url === null) {
				setError(t('browser.unsupportedAddress'));
				return;
			}
			setError('');
			run(page.navigate(url));
		}
		setEditing(false);
		setSuggesting(false);
		address.current?.blur();
	};
	const tools = [
		{ icon: Crosshair, label: t('browser.design'), run: () => setDesign('copy') },
		{ icon: MessageSquarePlus, Globe, Search, label: t('browser.annotate'), run: () => setDesign('annotate') },
		{ icon: PenTool, label: t('browser.markup'), run: () => setDesign('draw') },
		{ icon: SquareCode, label: t('browser.devtools'), run: () => page.openDevTools() },
		{ icon: ExternalLink, label: t('browser.external'), run: () => page.openExternal() },
	];
	const toolCount = Math.max(0, Math.min(5, Math.floor((width - 390) / 36)));
	const closeFind = () => {
		setFind(false);
		page.stopFind();
		page.focus();
	};
	let origin = '';
	let permissionRequest: { origin: string; permission: string } | undefined;
	try {
		const request = JSON.parse(state.permissionDenied) as { origin: string; permission: string };
		if (
			[
				'media-camera',
				'media-microphone',
				'geolocation',
				'notifications',
				'clipboard-read',
				'fullscreen',
			].includes(request.permission)
		)
			permissionRequest = request;
	} catch {
		/* No pending request. */
	}
	try {
		origin = new URL(state.url).origin;
	} catch {
		/* Blank page. */
	}
	return (
		<div
			ref={root}
			className="shrink-0"
			onKeyDown={(e) => {
				if (e.nativeEvent.isComposing) return;
				if ((e.ctrlKey || e.metaKey) && ['+', '=', '-', '0', 'r'].includes(e.key)) {
					e.preventDefault();
					e.stopPropagation();
					if (e.key === 'r') run(page.reload(e.shiftKey));
					else page.setZoom(e.key === '0' ? 1 : state.zoom + (e.key === '-' ? -0.1 : 0.1));
				}
			}}
		>
			<div className="nand-browser-toolbar relative z-10 flex shrink-0 items-center gap-2 border-b border-border/70 bg-background/95 px-3 py-1.5">
				<Tool
					icon={ArrowLeft}
					label={t('browser.back')}
					disabled={!state.canGoBack}
					onClick={() => run(page.back())}
				/>
				<Tool
					icon={ArrowRight}
					label={t('browser.forward')}
					disabled={!state.canGoForward}
					onClick={() => run(page.forward())}
				/>
				<ContextMenu>
					<ContextMenuTrigger>
						<Tool
							icon={state.loading ? Loader2 : RefreshCw}
							label={t(state.loading ? 'browser.stop' : 'browser.reload')}
							onClick={() => (state.loading ? page.stop() : run(page.reload()))}
						/>
					</ContextMenuTrigger>
					<ContextMenuContent>
						<ContextMenuItem onSelect={() => run(page.reload())}>
							{t('browser.reload')}
							<span className="ml-auto">Ctrl R</span>
						</ContextMenuItem>
						<ContextMenuItem onSelect={() => run(page.reload(true))}>
							{t('browser.hardReload')}
							<span className="ml-auto">Ctrl Shift R</span>
						</ContextMenuItem>
					</ContextMenuContent>
				</ContextMenu>
				<Popover open={suggesting} onOpenChange={setSuggesting}>
					<PopoverAnchor asChild>
						<div className="relative flex h-7 min-w-0 flex-1 items-center rounded-md bg-muted/60 px-2 text-xs focus-within:bg-background focus-within:ring-[3px] focus-within:ring-ring/50">
							<Popover>
								<PopoverTrigger asChild>
									<Button variant="ghost" size="icon-xs" aria-label={t('browser.permissions')}>
										{state.url.startsWith('file:') ? (
											<FileText className="size-3.5" />
										) : state.url.startsWith('https:') ? (
											<Shield className="size-3.5" />
										) : (
											<ShieldAlert className="size-3.5" />
										)}
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-80 p-3" align="start">
									<p className="truncate text-sm font-medium">{origin}</p>
									<p className="mb-3 text-xs text-muted-foreground">
										{t(
											state.url.startsWith('file:')
												? 'browser.site.local'
												: state.url.startsWith('https:')
													? 'browser.site.secure'
													: 'browser.site.insecure',
										)}
									</p>
									{[
										'media-camera',
										'media-microphone',
										'geolocation',
										'notifications',
										'clipboard-read',
										'fullscreen',
									].map((permission) => (
										<div
											key={permission}
											className="flex items-center justify-between gap-2 py-1 text-xs"
										>
											<span>{t(`browser.permission.${permission}`)}</span>
											<Button
												variant="outline"
												size="sm"
												onClick={() =>
													run(
														host.grant(
															page.profileId,
															origin,
															permission,
															!host.permissions(page.profileId)[
																origin + '|' + permission
															],
														),
													)
												}
											>
												{t(
													host.permissions(page.profileId)[origin + '|' + permission]
														? 'browser.site.allow'
														: 'browser.site.deny',
												)}
											</Button>
										</div>
									))}
									<Button
										className="mt-3 w-full"
										size="sm"
										variant="outline"
										onClick={() => run(host.clearCookies(page.profileId, origin))}
									>
										{t('browser.site.clear')}
									</Button>
								</PopoverContent>
							</Popover>
							<div className="relative min-w-0 flex-1">
								<Input
									ref={address}
									aria-label={t('browser.address')}
									value={input}
									className={`h-7 min-w-0 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0 ${!editing && addressParts ? 'text-transparent' : ''}`}
									onFocus={(e) => {
										setDirty(false);
										setEditing(true);
										e.target.select();
									}}
									onChange={(e) => {
										setDirty(true);
										setInput(e.target.value);
										setSelected(0);
										setSuggesting(true);
									}}
									onBlur={() => {
										setEditing(false);
									}}
									onKeyDown={(e) => {
										e.stopPropagation();
										if (e.nativeEvent.isComposing) return;
										if (e.key === 'Enter') {
											e.preventDefault();
											navigate(selected);
										} else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
											e.preventDefault();
											setSuggesting(true);
											setSelected(
												(selected + (e.key === 'ArrowDown' ? 1 : -1) + suggestions.length) %
													suggestions.length,
											);
										} else if (e.key === 'Tab' && suggesting) {
											e.preventDefault();
											setInput(suggestions[selected]?.url ?? input);
										} else if (e.key === 'Escape') {
											setInput(state.url);
											setSuggesting(false);
											e.currentTarget.blur();
										}
									}}
								/>
								{!editing && addressParts && (
									<span
										aria-hidden="true"
										className="pointer-events-none absolute inset-0 truncate px-1 py-1 text-xs text-muted-foreground"
									>
										{addressParts[1]}
										<span className="text-foreground">{addressParts[2]}</span>
										{addressParts[3]}
									</span>
								)}
							</div>
							{state.viewport && (
								<Button
									size="sm"
									variant="ghost"
									className="h-6 px-1 text-xs"
									onClick={() => run(page.setViewport())}
								>
									▭ {state.viewport.width}×{state.viewport.height}
								</Button>
							)}
							{state.zoom !== 1 && (
								<Button
									variant="ghost"
									size="sm"
									className="h-6 px-1 text-xs"
									onClick={() => page.setZoom(1)}
								>
									{Math.round(state.zoom * 100)}%
								</Button>
							)}
							{state.loading && <div className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}
						</div>
					</PopoverAnchor>
					<PopoverContent
						align="start"
						className="w-[var(--radix-popover-trigger-width)] max-w-[90vw] p-1"
						onOpenAutoFocus={(e) => e.preventDefault()}
						onCloseAutoFocus={(e) => e.preventDefault()}
					>
						<Command
							shouldFilter={false}
							value={String(selected)}
							onValueChange={(value) => {
								if (value) setSelected(Number(value));
							}}
						>
							<CommandList
								id={`browser-history-listbox-${page.id}`}
								role="listbox"
								aria-label={t('browser.address')}
							>
								<CommandGroup>
									{suggestions.map((entry, i) => (
										<CommandItem
											key={i}
											value={String(i)}
											onSelect={() => navigate(i)}
											onMouseDown={(e) => e.preventDefault()}
											className="flex items-center gap-2 px-3 py-2"
										>
											{entry.isSearch ? (
												<Search className="size-3.5 shrink-0 text-muted-foreground" />
											) : (
												<Globe className="size-3.5 shrink-0 text-muted-foreground" />
											)}
											<div className="flex min-w-0 flex-1 flex-col">
												<span className="truncate text-sm">{entry.title}</span>
												{entry.subtitle && (
													<span className="truncate text-xs text-muted-foreground">
														{entry.subtitle}
													</span>
												)}
											</div>
										</CommandItem>
									))}
								</CommandGroup>
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>
				{count === 0 && width > 500 && (
					<CookieImport host={host} profileId={page.profileId} compact={width < 850} />
				)}
				{tools.slice(0, toolCount).map((tool) => (
					<span key={tool.label} className="flex items-center">
						<Tool
							icon={tool.icon}
							label={tool.label}
							onClick={tool.run}
							badge={tool.icon === MessageSquarePlus ? state.annotations.length : undefined}
						/>
						{tool.icon === MessageSquarePlus && state.annotations.length > 0 && (
							<Tool
								icon={ChevronDown}
								label={t('browser.annotations')}
								onClick={() => setDesign('annotations')}
							/>
						)}
					</span>
				))}
				<DropdownMenu modal={false}>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={t('browser.more')}>
							<Ellipsis className="size-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-56">
						{tools.slice(toolCount).map((tool) => (
							<DropdownMenuItem key={tool.label} onSelect={tool.run}>
								<tool.icon className="size-4" />
								{tool.label}
							</DropdownMenuItem>
						))}
						<DropdownMenuSeparator />
						{profiles.profiles.map((profile) => (
							<DropdownMenuItem
								key={profile.id}
								disabled={profile.state !== 'ready'}
								onSelect={() => {
									if (profile.id !== page.profileId) setSwitchTo(profile.id);
								}}
							>
								<Check className={profile.id === page.profileId ? 'size-4' : 'size-4 opacity-0'} />
								{profile.label || t('browser.profile.default')}
								<span className="ml-auto text-xs text-muted-foreground">{profile.importSource}</span>
							</DropdownMenuItem>
						))}
						<DropdownMenuSeparator />
						<DropdownMenuItem onSelect={() => setNewProfile(true)}>
							<Plus className="size-4" />
							{t('browser.profile.add')}
						</DropdownMenuItem>
						<div className="px-1">
							<CookieImport host={host} profileId={page.profileId} />
						</div>
						<DropdownMenuSeparator />
						{state.annotations.length > 0 && (
							<DropdownMenuItem onSelect={() => setDesign('annotations')}>
								{t('browser.annotations')} ({state.annotations.length})
							</DropdownMenuItem>
						)}
						<DropdownMenuSub>
							<DropdownMenuSubTrigger>{t('browser.viewport')}</DropdownMenuSubTrigger>
							<DropdownMenuSubContent>
								{[
									{ name: t('browser.viewport.default') },
									{ name: 'iPhone 15', width: 393, height: 852 },
									{ name: 'Pixel 8', width: 412, height: 915 },
									{ name: 'iPad', width: 820, height: 1180 },
									{ name: '1280 × 800', width: 1280, height: 800 },
									{ name: '1920 × 1080', width: 1920, height: 1080 },
								].map((preset) => (
									<DropdownMenuItem
										key={preset.name}
										onSelect={() =>
											run(
												page.setViewport(
													preset.width && preset.height
														? { width: preset.width, height: preset.height }
														: undefined,
												),
											)
										}
									>
										{preset.name}
									</DropdownMenuItem>
								))}
							</DropdownMenuSubContent>
						</DropdownMenuSub>
						<DropdownMenuItem onSelect={() => setFind(true)}>
							{t('browser.find')}
							<span className="ml-auto">Ctrl F</span>
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => page.setZoom(state.zoom + 0.1)}>
							{t('browser.zoomIn')}
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => page.setZoom(state.zoom - 0.1)}>
							{t('browser.zoomOut')}
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => page.setZoom(1)}>{t('browser.zoomReset')}</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => setDesign('screenshot')}>
							{t('browser.screenshot')}
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => setDesign('full')}>
							{t('browser.fullScreenshot')}
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onSelect={host.openSettings}>{t('browser.settings')}</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			{error && (
				<p role="alert" className="px-3 py-1 text-xs text-destructive">
					{error}
				</p>
			)}
			{permissionRequest && (
				<div className="flex items-center gap-2 border-b px-3 py-1 text-xs text-status-warning">
					<span className="min-w-0 flex-1 truncate">
						{t('browser.permission.request', {
							origin: permissionRequest.origin,
							permission: t('browser.permission.' + permissionRequest.permission),
						})}
					</span>
					{[true, false].map((allowed) => (
						<Button
							key={String(allowed)}
							size="sm"
							variant="ghost"
							onClick={() =>
								run(
									host.grant(
										page.profileId,
										permissionRequest.origin,
										permissionRequest.permission,
										allowed,
									),
								)
							}
						>
							{t(allowed ? 'browser.site.allow' : 'browser.site.deny')}
						</Button>
					))}
				</div>
			)}
			{find && (
				<div
					className="nand-browser-find flex items-center justify-end gap-1 border-b bg-muted/30 px-3 py-1.5"
					onKeyDown={(e) => {
						e.stopPropagation();
						if (e.key === 'Escape') {
							e.preventDefault();
							closeFind();
						}
					}}
				>
					<Input
						autoFocus
						aria-label={t('browser.find')}
						value={query}
						className="h-7 max-w-64 text-xs"
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
								e.preventDefault();
								page.find(query, { forward: !e.shiftKey, next: true, matchCase });
							}
						}}
					/>
					<span className="text-xs tabular-nums" aria-live="polite">
						{state.find.activeMatchOrdinal}/{state.find.matches}
					</span>
					<Button
						variant={matchCase ? 'secondary' : 'ghost'}
						size="sm"
						aria-label={t('browser.find.case')}
						aria-pressed={matchCase}
						onClick={() => setMatchCase(!matchCase)}
					>
						Aa
					</Button>
					<Tool
						icon={ChevronUp}
						label={t('browser.find.previous')}
						onClick={() => page.find(query, { forward: false, next: true, matchCase })}
					/>
					<Tool
						icon={ChevronDown}
						label={t('browser.find.next')}
						onClick={() => page.find(query, { next: true, matchCase })}
					/>
					<Tool icon={X} label={t('browser.close')} onClick={closeFind} />
				</div>
			)}
			{!!state.downloads.length && (
				<div className="border-b border-border/60 bg-muted/30 px-3 py-1.5">
					<div className="scrollbar-sleek flex max-h-36 flex-col gap-1 overflow-y-auto">
						{state.downloads
							.filter((d) => d.state === 'progressing' || now - (d.updatedAt ?? 0) < 600000)
							.map((download) => (
								<div key={download.id} className="flex min-h-8 items-center gap-2 text-xs">
									<div className="min-w-0 flex-1">
										<div className="truncate font-medium">{download.name}</div>
										{download.state === 'progressing' && (
											<div
												role="progressbar"
												aria-label={download.name}
												aria-valuenow={
													download.total
														? Math.round((download.received / download.total) * 100)
														: 0
												}
												aria-valuemin={0}
												aria-valuemax={100}
												className="h-1 overflow-hidden rounded-full bg-muted"
											>
												<div
													className="h-full bg-primary"
													style={{
														width: `${download.total ? Math.min(100, (download.received / download.total) * 100) : 0}%`,
													}}
												/>
											</div>
										)}
										<span className="text-muted-foreground">
											{download.state === 'progressing'
												? `${download.total ? Math.round((download.received / download.total) * 100) : 0}% · ${((download.speed ?? 0) / 1024 / 1024).toFixed(1)} MB/s`
												: t(
														download.state === 'completed'
															? 'browser.download.completed'
															: download.state === 'cancelled'
																? 'browser.download.cancelled'
																: 'browser.download.failed',
													)}
										</span>
									</div>
									{(download.state === 'progressing'
										? (['cancel'] as const)
										: download.state === 'completed'
											? (['open', 'show', 'dismiss'] as const)
											: (['retry', 'dismiss'] as const)
									).map((action) => (
										<Button
											size="sm"
											variant="ghost"
											key={action}
											onClick={() => page.downloadAction(download.id, action)}
										>
											{t(
												action === 'open'
													? 'browser.openFile'
													: action === 'show'
														? 'browser.showFile'
														: `browser.${action}`,
											)}
										</Button>
									))}
								</div>
							))}
					</div>
					<Button
						size="sm"
						variant="ghost"
						onClick={() => {
							for (const d of state.downloads) page.downloadAction(d.id, 'dismiss');
						}}
					>
						{t('browser.download.clear')}
					</Button>
				</div>
			)}
			{state.error && (
				<EmptyState
					icon={<CloudOff />}
					title={t('browser.loadFailed')}
					description={`${state.url}\n${state.error}`}
					action={
						<>
							<Button onClick={() => run(page.reload())}>{t('browser.retry')}</Button>
							<Button variant="outline" onClick={() => page.openExternal()}>
								{t('browser.external')}
							</Button>
						</>
					}
				/>
			)}
			<NewProfileDialog host={host} open={newProfile} onOpenChange={setNewProfile} />
			<AlertDialog
				open={!!switchTo}
				onOpenChange={(open) => {
					if (!open) setSwitchTo('');
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t('browser.defaultProfile')}</AlertDialogTitle>
						<AlertDialogDescription>
							{t('browser.profile.switch', {
								name:
									profiles.profiles.find((p) => p.id === switchTo)?.label ||
									t('browser.profile.default'),
							})}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t('browser.cancel')}</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								run(page.setProfile(switchTo));
								setSwitchTo('');
							}}
						>
							{t('browser.apply')}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
			<DesignTools host={host} page={page} intent={design} reset={resetDesign} />
		</div>
	);
}
