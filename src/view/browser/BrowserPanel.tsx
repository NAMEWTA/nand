import { Menu, Notice, Platform } from 'obsidian';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { BrowserError, type BrowserAgent, type BrowserGrab, type BrowserPageState } from '../../core/browser/model';
import { historySuggestions, normalizeBrowserUrl } from '../../core/browser/url';
import type { BrowserPage } from '../../platform/desktop/browser/page';
import { t } from '../../shared/i18n';
import { Icon } from '../primitives/Icon';
import type { BrowserHost } from './host';
import { MarkupPanel } from './MarkupPanel';

export function browserError(error: unknown): string {
	const message = error instanceof BrowserError ? error.code : error instanceof Error ? error.message : String(error);
	if (!message.startsWith('browser_')) return message;
	const translated = t(`browser.${message}`);
	return translated === `browser.${message}` ? t('browser.browser_failed') : translated;
}
export function grabText(grab: BrowserGrab): string {
	return [
		t('browser.material'),
		grab.title,
		grab.url,
		`${t('browser.selector')}: ${grab.selector}`,
		`${t('browser.source')}: ${grab.source || t('browser.sourceMissing')}`,
		grab.text,
		JSON.stringify(grab.styles, null, 2),
		grab.html,
	].join('\n\n');
}
export function BrowserPanel({
	host,
	initial,
	changed,
	modal = false,
	close,
	activate = true,
}: {
	host: BrowserHost;
	initial: BrowserPageState;
	changed: (state: BrowserPageState) => void;
	modal?: boolean;
	close?: () => void;
	activate?: boolean;
}) {
	const mount = useRef<HTMLDivElement>(null),
		address = useRef<HTMLInputElement>(null),
		instance = useRef<BrowserPage>();
	const [state, setState] = useState(initial),
		[value, setValue] = useState(initial.url === 'about:blank' ? '' : initial.url);
	const [editing, setEditing] = useState(false),
		[find, setFind] = useState<string | null>(null),
		[suggest, setSuggest] = useState(false);
	const [failure, setFailure] = useState(''),
		[design, setDesign] = useState(false),
		[grab, setGrab] = useState<BrowserGrab | null>(null);
	const [markup, setMarkup] = useState<{ data: string; width: number; selection?: BrowserGrab } | null>(null),
		[agents, setAgents] = useState<BrowserAgent[]>([]);
	const [agent, setAgent] = useState(''),
		[, redraw] = useState(0);
	const [suggestionIndex, setSuggestionIndex] = useState(-1);
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
			const allowed = host.permissions()[`${origin}|${permission}`] === true;
			menu.addItem(item => item.setTitle(t(`browser.permission.${permission}`)).setChecked(allowed)
				.onClick(() => run(async () => { await host.grantPermission(origin, permission, !allowed); redraw(n => n + 1); })));
		}
		menu.showAtMouseEvent(event);
	};
	useLayoutEffect(() => {
		const container = mount.current;
		if (!container) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				if (design) {
					run(() => page?.automation?.design());
					setDesign(false);
				} else if (grab) setGrab(null);
				else if (find !== null) {
					setFind(null);
					page?.find('');
				} else return;
				e.preventDefault();
				e.stopPropagation();
			}
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
				e.preventDefault();
				address.current?.focus();
				address.current?.select();
			}
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
				e.preventDefault();
				setFind('');
			}
		};
		container.parentElement?.addEventListener('keydown', handler);
		if (page)
			page.shortcut = (key) => {
				if (key === 'l') {
					address.current?.focus();
					address.current?.select();
				} else if (key === 'f') setFind('');
				else if (key === 'Escape') {
					run(() => page.automation?.design());
					setDesign(false);
					setGrab(null);
					setFind(null);
					page.find('');
				}
			};
		const parent = container.parentElement;
		return () => {
			parent?.removeEventListener('keydown', handler);
			if (page) page.shortcut = undefined;
		};
	}, [design, grab, find, page]);
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
	const iconButton = (key: string, icon: string, action: () => void, disabled = false) => (
		<button
			type="button"
			class="nand-ui-icon-btn"
			aria-label={t(`browser.${key}`)}
			title={t(`browser.${key}`)}
			disabled={disabled}
			onClick={action}
		>
			<Icon name={icon} />
		</button>
	);
	const ready = !!page?.guest;
	const suggestions = historySuggestions(host.history(), value);
	const loadAgents = () =>
		run(async () => {
			const list = await host.agents.list();
			setAgents(list);
			setAgent(list[0]?.id ?? '');
		});
	return (
		<div class="nand-browser-panel" data-page-id={state.id}>
			<div class="nand-ui-toolbar nand-browser-toolbar">
				<button type="button" class="nand-ui-icon-btn" aria-label={t('browser.permissions')} title={t('browser.permissions')} onClick={permissions}><Icon name="shield" /></button>
				{iconButton('back', 'arrow-left', () => run(() => page?.back()), !state.canGoBack)}
				{iconButton('forward', 'arrow-right', () => run(() => page?.forward()), !state.canGoForward)}
				{iconButton(
					state.loading ? 'stop' : 'reload',
					state.loading ? 'x' : 'rotate-cw',
					() => run(() => (state.loading ? page?.stop() : page?.reload())),
					!ready,
				)}
				<div class="nand-browser-address-wrap">
					<form
						onSubmit={(e) => {
							e.preventDefault();
							navigate();
						}}
					>
						<Icon name="globe" />
						<input
							ref={address}
							class="nand-browser-address"
							aria-label={t('browser.address')}
							placeholder={t('browser.address')}
							value={value}
							spellcheck={false}
							onFocus={(e) => {
								editingRef.current = true;
								setEditing(true);
								setSuggest(true);
								e.currentTarget.select();
							}}
							onBlur={() => {
								editingRef.current = false;
								setEditing(false);
							}}
							onInput={(e) => {
								editingRef.current = true;
								setEditing(true);
								setSuggestionIndex(-1);
								setValue(e.currentTarget.value);
								setSuggest(true);
							}}
							onKeyDown={(e) => {
								if (e.isComposing) return;
								if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && suggestions.length) {
									e.preventDefault();
									setSuggest(true);
									setSuggestionIndex(
										(index) =>
											(index + (e.key === 'ArrowDown' ? 1 : -1) + suggestions.length) %
											suggestions.length,
									);
								}
								if (
									e.key === 'Enter' &&
									suggest &&
									suggestionIndex >= 0 &&
									suggestions[suggestionIndex]
								) {
									e.preventDefault();
									const url = suggestions[suggestionIndex].url;
									setValue(url);
									navigate(url);
								}
								if (e.key === 'Escape') {
									setValue(state.url === 'about:blank' ? '' : state.url);
									setSuggest(false);
								}
							}}
						/>
					</form>
					{suggest && editing && (
						<div class="nand-browser-suggestions">
							{suggestions.map((entry, index) => (
								<button
									class={`nand-ui-list-item${index === suggestionIndex ? ' is-active' : ''}`}
									onMouseDown={(e) => e.preventDefault()}
									onClick={() => {
										setValue(entry.url);
										navigate(entry.url);
									}}
								>
									<span>{entry.title || entry.url}</span>
									<small>{entry.url}</small>
								</button>
							))}
						</div>
					)}
				</div>
				{iconButton(
					'find',
					'search',
					() => {
						if (find !== null) page?.find('');
						setFind(find === null ? '' : null);
					},
					!ready,
				)}
				<select
					class="nand-browser-zoom"
					aria-label={t('browser.zoom')}
					value={state.zoom}
					onChange={(e) => page?.zoom(Number(e.currentTarget.value))}
				>
					{[0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 2].map((z) => (
						<option value={z}>{Math.round(z * 100)}%</option>
					))}
				</select>
				{iconButton(
					'design',
					'mouse-pointer-2',
					() =>
						run(async () => {
							await page?.automation?.design(
								design
									? undefined
									: (selection) => {
											setDesign(false);
											setGrab(selection);
											loadAgents();
										},
							);
							setDesign(!design);
						}),
					!ready,
				)}
				<button class="nand-ui-icon-btn" aria-label={t('browser.more')} onClick={(e) => menu(e)}>
					<Icon name="ellipsis" />
				</button>
				{modal &&
					iconButton('tab', 'panel-top', () =>
						run(async () => {
							await host.open({
								url: state.url,
								title: state.title,
								zoom: state.zoom,
								scroll: state.scroll,
							});
							close?.();
						}),
					)}
				{modal && iconButton('close', 'x', () => close?.())}
			</div>
			{find !== null && (
				<div class="nand-ui-toolbar nand-browser-find">
					<input
						autoFocus
						aria-label={t('browser.find')}
						value={find}
						onInput={(e) => {
							setFind(e.currentTarget.value);
							page?.find(e.currentTarget.value);
						}}
						onKeyDown={(e) => {
							if (e.key === 'Enter') page?.find(find, !e.shiftKey, true);
						}}
					/>
					<span>
						{page?.findResult.activeMatchOrdinal ?? 0}/{page?.findResult.matches ?? 0}
					</span>
					{iconButton('back', 'chevron-up', () => page?.find(find, false, true))}
					{iconButton('forward', 'chevron-down', () => page?.find(find, true, true))}
					{iconButton('close', 'x', () => {
						setFind(null);
						page?.find('');
					})}
				</div>
			)}
			{design && (
				<div class="nand-browser-hint">
					{t('browser.selectHint')}{' '}
					{iconButton('close', 'x', () =>
						run(async () => {
							await page?.automation?.design();
							setDesign(false);
						}),
					)}
				</div>
			)}
			{page && page.downloads.length > 0 && (
				<div class="nand-browser-downloads" aria-label={t('browser.downloads')}>
					{page.downloads.map((d) => (
						<div class="nand-ui-toolbar">
							<span>{d.name}</span>
							<progress value={d.received} max={d.total || 1} />
							{d.state === 'progressing' ? (
								iconButton('cancel', 'x', () => page.downloadAction(d.id, 'cancel'))
							) : (
								<>
									{iconButton(
										'openFile',
										'file',
										() => page.downloadAction(d.id, 'open'),
										d.state !== 'completed',
									)}
									{iconButton(
										'showFile',
										'folder',
										() => page.downloadAction(d.id, 'show'),
										d.state !== 'completed',
									)}
									{iconButton('dismiss', 'x', () => page.downloadAction(d.id, 'dismiss'))}
								</>
							)}
						</div>
					))}
				</div>
			)}
			<div class="nand-browser-viewport">
				<div ref={mount} class="nand-browser-guest" />
				{state.loading && (
					<div class="nand-browser-loading" role="status">
						{t('browser.loading')}
					</div>
				)}
				{page?.permissionDenied && <div role="status" class="nand-browser-permission-denied">{t('browser.permissionDenied')} <button type="button" onClick={permissions}>{t('browser.permissions')}</button></div>}
				{(failure || state.error || state.url === 'about:blank') && (
					<div class="nand-browser-empty">
						<Icon name={failure || state.error ? 'triangle-alert' : 'globe'} />
						<p>{failure || (state.error ? browserError(state.error) : t('browser.empty'))}</p>
						{(failure || state.error) && (
							<div class="nand-ui-toolbar">
								<button
									class="nand-ui-btn"
									onClick={() => {
										setFailure('');
										rebuild((value) => value + 1);
									}}
								>
									{t('browser.retry')}
								</button>
								<button
									class="nand-ui-btn-ghost"
									onClick={() =>
										run(() => page?.api.shell.openExternal(normalizeBrowserUrl(state.url)))
									}
								>
									{t('browser.external')}
								</button>
							</div>
						)}
					</div>
				)}
				{grab && (
					<div class="nand-browser-overlay nand-browser-grab">
						<div class="nand-ui-toolbar">
							<strong>{t('browser.selection')}</strong>
							<div class="nand-ui-spacer" />
							{iconButton('close', 'x', () => setGrab(null))}
						</div>
						{grab.screenshot && <img src={grab.screenshot} alt={t('browser.selection')} />}
						<pre>{grabText(grab)}</pre>
						{grab.screenshot && (
							<button
								class="nand-ui-btn-ghost"
								onClick={() =>
									setMarkup({
										data: grab.screenshot!,
										width: Math.min(grab.rect.width, grab.viewport.width),
										selection: grab,
									})
								}
							>
								{t('browser.markup')}
							</button>
						)}
						<div class="nand-ui-toolbar">
							<button class="nand-ui-btn-ghost" onClick={() => host.copyText(grabText(grab))}>
								{t('browser.copy')}
							</button>
							{grab.screenshot && (
								<button class="nand-ui-btn-ghost" onClick={() => host.copyImage(grab.screenshot!)}>
									{t('browser.copyImage')}
								</button>
							)}
							{agents.length ? (
								<>
									<select
										aria-label={t('browser.chooseAgent')}
										value={agent}
										onChange={(e) => setAgent(e.currentTarget.value)}
									>
										{agents.map((a) => (
											<option value={a.id}>{a.title}</option>
										))}
									</select>
									<button
										class="nand-ui-btn mod-cta"
										onClick={() =>
											run(async () => {
												const description = grabText(grab);
												const files = grab.screenshot
													? await host.saveImage(grab.screenshot, description)
													: [];
												await host.agents.attach(agent, description, files);
												new Notice(t('browser.attached'));
												setGrab(null);
											})
										}
									>
										{t('browser.attach')}
									</button>
								</>
							) : (
								<small>{t('browser.noAgents')}</small>
							)}
						</div>
					</div>
				)}
				{markup && (
					<MarkupPanel
						data={markup.data}
						viewportWidth={markup.width || 1000}
						close={() => setMarkup(null)}
						finish={(data) => {
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
						}}
					/>
				)}
			</div>
		</div>
	);
}
