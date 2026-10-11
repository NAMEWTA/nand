import { Platform, type App } from 'obsidian';
import { h } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { DashboardColumn } from '../../core/board/types/index';
import { t } from '../../../../shared/i18n/index';
import { Icon } from '../../../../ui/primitives/Icon';
import { getCSSVar, relativeLuminance } from '../renderer/render-context';
import { isValidWebUrl, normalizeWebUrl } from './web-precheck';
import type { VaultSessionLease } from '../../../../host/desktop/browser-session';
export interface WebRenderOptions { timeoutMs?: number }
function colorScheme(root: HTMLElement): 'dark' | 'light' {
	const bg = root.ownerDocument.defaultView?.getComputedStyle ? getCSSVar(root, '--db-bg') : '';
	let rgb: number[] | undefined;
	if (/^#[\da-f]{6}$/i.test(bg)) rgb = [1, 3, 5].map(index => parseInt(bg.slice(index, index + 2), 16));
	else if (/^#[\da-f]{3}$/i.test(bg)) rgb = [1, 2, 3].map(index => parseInt(bg[index]! + bg[index]!, 16));
	else if (/^rgba?\(/.test(bg)) rgb = bg.match(/[\d.]+/g)?.slice(0, 3).map(Number);
	return rgb?.length === 3 ? relativeLuminance(rgb[0]!, rgb[1]!, rgb[2]!) < 0.5 ? 'dark' : 'light' : root.ownerDocument.body.classList.contains('theme-dark') ? 'dark' : 'light';
}
function Webview({ app, target, zoom, scheme, timeoutMs, failed }: {
	app: App; target: string; zoom?: number; scheme: string; timeoutMs: number; failed: (error: string) => void;
}) {
	const frame = useRef<HTMLElement>(null), actions = useRef(failed); actions.current = failed;
	useLayoutEffect(() => {
		const element = frame.current, win = element?.ownerDocument.defaultView;
		if (!element || !win) return;
		const abort = new AbortController(); let lease: VaultSessionLease | undefined, timer: number | undefined;
		let loaded = false;
		const fail = (code: string) => { if (!abort.signal.aborted) actions.current(code); };
		const ready = () => {
			if (abort.signal.aborted || loaded || !lease) return;
			loaded = true; win.clearTimeout(timer);
			const guest = element as HTMLElement & { getWebContentsId(): number; loadURL(url: string): Promise<void>; setZoomFactor(value: number): void };
			try { lease.protect(guest.getWebContentsId()); guest.setZoomFactor(zoom ?? 1); void guest.loadURL(target).catch(() => fail('web.loadFailed')); }
			catch { fail('web.loadFailed'); }
		};
		const error = (event: Event) => {
			const detail = event as Event & { isMainFrame?: boolean; errorCode?: number };
			if (detail.isMainFrame !== false && detail.errorCode !== -3) fail('web.loadFailed');
		};
		element.addEventListener('dom-ready', ready); element.addEventListener('did-fail-load', error);
		void import('../../platform/desktop/session').then(({ homeSession }) => homeSession(app, win, 'web', abort.signal)).then(value => {
			if (abort.signal.aborted) { value.dispose(); return; }
			lease = value; lease.bind(element);
			lease.onDownloadError(() => fail('web.browser_session_download'));
			timer = win.setTimeout(() => fail('web.webviewUnavailable'), timeoutMs);
			element.setAttribute('src', 'about:blank');
		}).catch((error: unknown) => fail(error instanceof Error && error.message.startsWith('browser_session_') ? `web.${error.message}` : 'web.loadFailed'));
		return () => {
			abort.abort(); win.clearTimeout(timer);
			element.removeEventListener('dom-ready', ready); element.removeEventListener('did-fail-load', error);
			element.remove(); lease?.dispose();
		};
	}, [app, target, zoom, timeoutMs]);
	return h('webview', { ref: frame, class: 'dashboard-web-frame', webpreferences: 'nodeIntegration=false,contextIsolation=true,sandbox=true,webSecurity=true', style: { colorScheme: scheme } });
}
export function WebPanel({ app, root, column, options, reloadRegister }: {
	app: App; root: HTMLElement; column: DashboardColumn; options?: WebRenderOptions; reloadRegister: (fn: () => void) => void;
}) {
	const target = normalizeWebUrl(column.webConfig?.url ?? '');
	const [revision, setRevision] = useState(0), [error, setError] = useState('');
	const reload = () => { setError(''); setRevision(value => value + 1); };
	useLayoutEffect(() => { reloadRegister(reload); return () => reloadRegister(() => {}); }, [target, reloadRegister]);
	useLayoutEffect(() => { setError(''); }, [target]);
	if (!isValidWebUrl(target)) return <div class="dashboard-web-empty">
		<div class="dashboard-web-empty-icon"><Icon name="globe" /></div>
		<div class="dashboard-web-empty-text">{t('web.emptyUrl')}</div>
		<div class="dashboard-web-empty-hint">{t('web.configureHint')}</div>
		<button class="dashboard-web-fallback-btn" type="button" onClick={() => root.dispatchEvent(new CustomEvent('dashboard-library-config', { detail: { columnName: column.name }, bubbles: true }))}>{t('web.configure')}</button>
	</div>;
	if (error || Platform.isMobile) return <div class="dashboard-web-fallback">
		<div class="dashboard-web-fallback-icon"><Icon name={error ? 'alert-triangle' : 'globe'} /></div>
		<div class="dashboard-web-fallback-text">{t(error || 'web.mobileBlocked')}</div>
		{!error && <div class="dashboard-web-fallback-host">{new URL(target).hostname}</div>}
		<div class="dashboard-web-fallback-url">{target}</div>
		<button class="dashboard-web-fallback-btn" type="button" onClick={() => error ? reload() : root.ownerDocument.defaultView?.open(target, '_blank')}>{t(error ? 'web.retry' : 'web.openExternal')}</button>
	</div>;
	return <Webview key={revision} app={app} target={target} zoom={column.webConfig?.zoom} scheme={colorScheme(root)} timeoutMs={options?.timeoutMs ?? 20000} failed={setError} />;
}
