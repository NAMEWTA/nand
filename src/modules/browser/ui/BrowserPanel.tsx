import { Menu, Notice, Platform, type Scope } from 'obsidian';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { BrowserAgent, BrowserGrab, BrowserPageState } from '../core/model';
import { historySuggestions, normalizeBrowserUrl } from '../core/url';
import { mountBrowserKeyScope } from './browser-key-scope';
import type { BrowserPage } from '../platform/desktop/page';
import { t } from '../../../shared/i18n';
import { AddressBar, DownloadsBar, FindBar, PageMessage, SelectionPanel, ToolbarButton } from './browser-controls';
import type { BrowserHost } from '../services/page-host';
import { MarkupPanel } from './MarkupPanel';
import { browserError, grabText } from '../core/text';
import { AssistantBanner } from './AssistantBanner';
import { WorkflowBanner } from './WorkflowBanner';
import { AccessBanner } from './AccessBanner';
import { SelectionGuidance } from './SelectionGuidance';
import { UserAdapterEditor } from './UserAdapterEditor';
import type { BrowserPageTarget } from '../core/control';

export { browserError, grabText };
export function BrowserPanel({
	host,
	initial,
	changed,
	modal = false,
	close,
	activate = true,
	keyScope,
	fixedProfile = false,
}: {
	host: BrowserHost;
	initial: BrowserPageState;
	changed: (state: BrowserPageState) => void;
	modal?: boolean;
	close?: () => void;
	activate?: boolean;
	keyScope?: Scope;
	fixedProfile?: boolean;
}) {
	const root = useRef<HTMLDivElement>(null),
		mount = useRef<HTMLDivElement>(null),
		address = useRef<HTMLInputElement>(null),
		findInput = useRef<HTMLInputElement>(null),
		instance = useRef<BrowserPage>();
	const [state, setState] = useState(initial),
		[value, setValue] = useState(initial.url === 'about:blank' ? '' : initial.url);
	const [editing, setEditing] = useState(false),
		[find, setFind] = useState<string | null>(null),
		[suggest, setSuggest] = useState(false);
	const [failure, setFailure] = useState(''),
		[design, setDesign] = useState(false),
		[grab, setGrab] = useState<BrowserGrab | null>(null);
	const [grabTarget, setGrabTarget] = useState<BrowserPageTarget>();
	const [adapterOpen, setAdapterOpen] = useState(false);
	const [markup, setMarkup] = useState<{ data: string; width: number; selection?: BrowserGrab } | null>(null),
		[agents, setAgents] = useState<BrowserAgent[]>([]);
	const [agent, setAgent] = useState(''),
		[, redraw] = useState(0);
	const [suggestionIndex, setSuggestionIndex] = useState(-1);
	const [findRequest, requestFindFocus] = useState(0);
	const findOpen = find !== null;
	const openFind = () => {
		setFind((current) => current ?? '');
		requestFindFocus((request) => request + 1);
	};
	// Focus once per open request, not on every keystroke. The ref belongs to this pane/window.
	useLayoutEffect(() => {
		if (!findOpen) return;
		findInput.current?.focus();
		findInput.current?.select();
	}, [findOpen, findRequest]);
	const [epoch, rebuild] = useState(0);
	const changedRef = useRef(changed);
	changedRef.current = changed;
	const editingRef = useRef(editing);
	editingRef.current = editing;
	const run = (work: () => unknown) => {
		try {
			void Promise.resolve(work()).catch((error: unknown) => setFailure(browserError(error)));
		} catch (error) {
			setFailure(browserError(error));
		}
	};
	useLayoutEffect(() => {
		const container = mount.current;
		if (!container || !activate || !host.enabled() || !Platform.isDesktopApp) return;
		try {
			const page = host.createPage(epoch ? state : initial, container, (next) => {
				setState(next);
				changedRef.current(next);
				if (!editingRef.current) setValue(next.url === 'about:blank' ? '' : next.url);
			});
			instance.current = page;
			const unsubscribe = page.subscribe(() => redraw((n) => n + 1));
			return () => {
				unsubscribe();
				instance.current = undefined;
				host.releasePage(initial.id);
			};
		} catch (error) {
			setFailure(browserError(error));
			return;
		}
	}, [host, initial.id, activate, epoch]);
	const page = instance.current;
	const permissions = (event: MouseEvent) => {
		let origin: string;
		try { origin = new URL(state.url).origin; } catch { return; }
		const menu = new Menu();
		menu.addItem(item => item.setTitle(origin).setDisabled(true));
		for (const permission of ['media', 'geolocation', 'notifications', 'clipboard-read', 'fullscreen']) {
			const allowed = host.permissions(state.profileId)[`${origin}|${permission}`] === true;
			menu.addItem(item => item.setTitle(t(`browser.permission.${permission}`)).setChecked(allowed)
				.onClick(() => run(async () => { await host.grantPermission(origin, permission, !allowed, state.profileId); redraw(n => n + 1); })));
		}
		menu.showAtMouseEvent(event);
	};
	const keyActions = useRef<{ find(): void; address(): void; escape(): boolean }>({ find: openFind, address: () => {}, escape: () => false });
	keyActions.current = {
		find: openFind,
		address: () => { address.current?.focus(); address.current?.select(); },
		escape: () => {
			if (design) { run(() => page?.automation?.design()); setDesign(false); }
			else if (grab) setGrab(null);
			else if (find !== null) { setFind(null); page?.find(''); page?.webview.focus(); }
			else return false;
			return true;
		},
	};
	useLayoutEffect(() => {
		const container = root.current;
		if (!container) return;
		return mountBrowserKeyScope(host.app, container, keyScope ?? host.app.scope, {
			find: () => keyActions.current.find(),
			address: () => keyActions.current.address(),
			escape: () => keyActions.current.escape(),
		});
	}, [host, keyScope]);
	useLayoutEffect(() => {
		if (!page) return;
		page.shortcut = key => {
			if (key !== 'Escape') return;
			run(() => page.automation?.design());
			setDesign(false);
			setGrab(null);
			setFind(null);
			page.find('');
		};
		return () => { page.shortcut = undefined; };
	}, [page]);
	const navigate = (url = value) =>
		run(async () => {
			const next = normalizeBrowserUrl(url, host.settings().searchEngine);
			setFailure('');
			setSuggest(false);
			setEditing(false);
			if (!page || page.disposed) {
				setState({ ...state, url: next, error: null, loading: false });
				setValue(next);
				rebuild(value => value + 1);
				return;
			}
			await page?.navigate(next);
		});
	const capture = (full = false) =>
		run(async () => {
			if (page) {
				const data = await page.screenshot(full);
				host.copyImage(data);
				new Notice(t('browser.copied'));
			}
		});
	const menu = (event: MouseEvent) => {
		const m = new Menu();
		const add = (key: string, icon: string, action: () => void) =>
			m.addItem((item) =>
				item
					.setTitle(t(`browser.${key}`))
					.setIcon(icon)
					.onClick(action),
			);
		add('hardReload', 'refresh-cw', () => run(() => page?.reload(true)));
		add('copyUrl', 'copy', () => host.copyText(state.url));
		add('external', 'external-link', () => run(() => page?.api.shell.openExternal(normalizeBrowserUrl(state.url))));
		add('devtools', 'code', () => run(() => page?.webview.openDevTools()));
		add('screenshot', 'camera', () => capture());
		add('fullScreenshot', 'scan', () => capture(true));
		add('markup', 'pencil', () =>
			run(async () => {
				if (page) setMarkup({ data: await page.screenshot(), width: page.webview.clientWidth / state.zoom });
			}),
		);
		m.showAtMouseEvent(event);
	};
	const ready = !!page?.guest;
	const suggestions = historySuggestions(host.history(), value);
	const loadAgents = () =>
		run(async () => {
			const list = await host.agents.list();
			setAgents(list);
			setAgent(list[0]?.id ?? '');
		});
	const closeFind = () => {
		setFind(null);
		page?.find('');
		page?.webview.focus();
	};
	const stopDesign = () =>
		run(async () => {
			await page?.automation?.design();
			setDesign(false);
		});
	const toggleDesign = () =>
		run(async () => {
			await page?.automation?.design(
				design
					? undefined
					: (selection) => {
							setDesign(false);
							setGrab(selection);
							setGrabTarget({ pageId: page.state.id, profileId: page.profileId, generation: page.generation });
							loadAgents();
						},
			);
			setDesign(!design);
		});
	const external = () => run(() => page?.api.shell.openExternal(normalizeBrowserUrl(state.url)));
	const addressKeys = (e: KeyboardEvent) => {
		if (e.isComposing) return;
		if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && suggestions.length) {
			e.preventDefault();
			setSuggest(true);
			setSuggestionIndex((index) => (index + (e.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length);
		}
		if (e.key === 'Enter' && suggest && suggestionIndex >= 0 && suggestions[suggestionIndex]) {
			e.preventDefault();
			const url = suggestions[suggestionIndex].url;
			setValue(url);
			navigate(url);
		}
		if (e.key === 'Escape') {
			setValue(state.url === 'about:blank' ? '' : state.url);
			setSuggest(false);
		}
	};
	const finishMarkup = (data: string) => {
		if (!markup) return;
		host.copyImage(data);
		setGrab({
			...(markup.selection ?? {
				url: state.url,
				title: state.title,
				selector: 'viewport',
				source: null,
				text: '',
				html: '',
				styles: {},
				rect: { x: 0, y: 0, width: markup.width, height: page?.webview.clientHeight ?? 0 },
				viewport: { width: markup.width, height: page?.webview.clientHeight ?? 0 },
			}),
			screenshot: data,
		});
		setMarkup(null);
		loadAgents();
		new Notice(t('browser.copied'));
	};
	const failed = !!(failure || state.error);
	return (
		<div ref={root} class="nand-browser-panel" data-page-id={state.id}>
			<div class="nand-ui-toolbar nand-browser-toolbar">
				<ToolbarButton label="permissions" icon="shield" onClick={permissions} />
				{!fixedProfile && <select class="nand-browser-profile" aria-label={t('browser.profile.openWith')} value={state.profileId ?? 'default'} onChange={event => {
					const profileId = event.currentTarget.value;
					event.currentTarget.value = state.profileId ?? 'default';
					run(() => host.open({ url: state.url, profileId }));
				}}>
					{host.profiles().filter(profile => profile.state === 'ready').map(profile => <option key={profile.id} value={profile.id}>{profile.kind === 'default' ? t('browser.profile.default') : profile.label}</option>)}
				</select>}
				<ToolbarButton label="back" icon="arrow-left" onClick={() => run(() => page?.back())} disabled={!state.canGoBack} />
				<ToolbarButton label="forward" icon="arrow-right" onClick={() => run(() => page?.forward())} disabled={!state.canGoForward} />
				<ToolbarButton label={state.loading ? 'stop' : 'reload'} icon={state.loading ? 'x' : 'rotate-cw'} onClick={() => run(() => (state.loading ? page?.stop() : page?.reload()))} disabled={!ready} />
				<AddressBar
					inputRef={address}
					value={value}
					open={suggest && editing}
					suggestions={suggestions}
					activeIndex={suggestionIndex}
					onFocus={(input) => {
						editingRef.current = true;
						setEditing(true);
						setSuggest(true);
						input.select();
					}}
					onBlur={() => {
						editingRef.current = false;
						setEditing(false);
					}}
					onInput={(next) => {
						editingRef.current = true;
						setEditing(true);
						setSuggestionIndex(-1);
						setValue(next);
						setSuggest(true);
					}}
					onKeyDown={addressKeys}
					onSubmit={() => navigate()}
					onPick={(url) => {
						setValue(url);
						navigate(url);
					}}
				/>
				<ToolbarButton
					label="find"
					icon="search"
					onClick={() => {
						if (find === null) openFind();
						else closeFind();
					}}
					disabled={!ready}
				/>
				<select class="nand-browser-zoom" aria-label={t('browser.zoom')} value={state.zoom} onChange={(e) => page?.zoom(Number(e.currentTarget.value))}>
					{[0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 2].map((z) => (
						<option value={z}>{Math.round(z * 100)}%</option>
					))}
				</select>
				<ToolbarButton label="design" icon="mouse-pointer-2" onClick={toggleDesign} disabled={!ready} />
				{host.getUserAdapters && <ToolbarButton label="userAdapter" icon="settings-2" onClick={() => setAdapterOpen(!adapterOpen)} disabled={!ready} />}
				<ToolbarButton label="more" icon="ellipsis" onClick={(e) => menu(e)} />
				{modal && (
					<ToolbarButton
						label="tab"
						icon="panel-top"
						onClick={() =>
							run(async () => {
								await host.open({ url: state.url, title: state.title, zoom: state.zoom, scroll: state.scroll, profileId: state.profileId });
								close?.();
							})
						}
					/>
				)}
				{modal && <ToolbarButton label="close" icon="x" onClick={() => close?.()} />}
			</div>
			{page && <AssistantBanner host={host} target={{ pageId: state.id, profileId: page.profileId, generation: page.generation }} />}
			{page && <WorkflowBanner host={host} target={{ pageId: state.id, profileId: page.profileId, generation: page.generation }} />}
			{page && <AccessBanner host={host} target={{ pageId: state.id, profileId: page.profileId, generation: page.generation }} />}
			{find !== null && (
				<FindBar
					inputRef={findInput}
					value={find}
					active={page?.findResult.activeMatchOrdinal ?? 0}
					matches={page?.findResult.matches ?? 0}
					onInput={(next) => {
						setFind(next);
						page?.find(next);
					}}
					onNext={(forward) => page?.find(find, forward, true)}
					onPrevious={() => page?.find(find, false, true)}
					onClose={closeFind}
				/>
			)}
			{design && (
				<div class="nand-browser-hint">
					{t('browser.selectHint')} <ToolbarButton label="close" icon="x" onClick={stopDesign} />
				</div>
			)}
			{page && page.downloads.length > 0 && <DownloadsBar downloads={page.downloads} action={(id, action) => page.downloadAction(id, action)} />}
			<div class="nand-browser-viewport">
				<div ref={mount} class="nand-browser-guest" />
				{state.loading && (
					<div class="nand-browser-loading" role="status">
						{t('browser.loading')}
					</div>
				)}
				{page?.permissionDenied && (
					<div role="status" class="nand-browser-permission-denied">
						{t('browser.permissionDenied')} <button type="button" onClick={permissions}>{t('browser.permissions')}</button>
					</div>
				)}
				{(failed || state.url === 'about:blank') && (
					<PageMessage
						message={failure || (state.error ? browserError(state.error) : t('browser.empty'))}
						failed={failed}
						onRetry={() => {
							setFailure('');
							rebuild((n) => n + 1);
						}}
						onExternal={external}
					/>
				)}
				{grab && !adapterOpen && (
					<SelectionPanel
						grab={grab}
						agents={agents}
						agent={agent}
						onAgent={setAgent}
						onClose={() => setGrab(null)}
						onMarkup={() => setMarkup({ data: grab.screenshot!, width: Math.min(grab.rect.width, grab.viewport.width), selection: grab })}
						onCopyText={() => host.copyText(grabText(grab))}
						onCopyImage={() => host.copyImage(grab.screenshot!)}
						onAttach={() =>
							run(async () => {
								const description = grabText(grab);
								const files = grab.screenshot ? await host.saveImage(grab.screenshot, description) : [];
								await host.agents.attach(agent, description, files);
								new Notice(t('browser.attached'));
								setGrab(null);
							})
						}
					>
						{grabTarget && host.guidanceChoices && host.saveGuidance && <SelectionGuidance host={host} target={grabTarget} grab={grab} saved={() => setGrab(null)} />}
					</SelectionPanel>
				)}
				{markup && <MarkupPanel data={markup.data} viewportWidth={markup.width || 1000} close={() => setMarkup(null)} finish={finishMarkup} />}
			</div>
			{adapterOpen && page && <div class="nand-browser-adapter-container" hidden={design}>
				<UserAdapterEditor key={page.generation} host={host} target={{ pageId: page.state.id, profileId: page.profileId, generation: page.generation }} url={state.url}
					grab={grab && grabTarget?.pageId === page.state.id && grabTarget.generation === page.generation && grabTarget.profileId === page.profileId ? grab : undefined}
					pick={toggleDesign} close={() => setAdapterOpen(false)} />
			</div>}
		</div>
	);
}
