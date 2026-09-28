import { Notice, Platform } from 'obsidian';
import { h } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { DashboardColumn } from '../../../core/dashboard/types/index';
import { t } from '../../../shared/i18n/index';
import { Icon } from '../../primitives/Icon';
import { getCSSVar, relativeLuminance } from '../renderer/render-context';
import {
	clearPrecheckCache,
	getCachedVerdict,
	isValidWebUrl,
	normalizeWebUrl,
	precheckEmbed,
	type HeaderFetcher,
} from './web-precheck';
export interface WebRenderOptions {
	fetcher?: HeaderFetcher;
	timeoutMs?: number;
}
type Engine = 'iframe' | 'webview' | 'fallback' | 'error';
function initialEngine(target: string): Engine {
	return getCachedVerdict(target) === 'blocked' ? (Platform.isMobile ? 'fallback' : 'webview') : 'iframe';
}
function colorScheme(root: HTMLElement): 'dark' | 'light' {
	const bg = root.ownerDocument.defaultView?.getComputedStyle ? getCSSVar(root, '--db-bg') : '';
	let rgb: number[] | undefined;
	if (/^#[\da-f]{6}$/i.test(bg)) rgb = [1, 3, 5].map((index) => parseInt(bg.slice(index, index + 2), 16));
	else if (/^#[\da-f]{3}$/i.test(bg)) rgb = [1, 2, 3].map((index) => parseInt(bg[index]! + bg[index]!, 16));
	else if (/^rgba?\(/.test(bg))
		rgb = bg
			.match(/[\d.]+/g)
			?.slice(0, 3)
			.map(Number);
	return rgb?.length === 3
		? relativeLuminance(rgb[0]!, rgb[1]!, rgb[2]!) < 0.5
			? 'dark'
			: 'light'
		: root.ownerDocument.body.classList.contains('theme-dark')
			? 'dark'
			: 'light';
}
function Webview({
	target,
	zoom,
	scheme,
	timeoutMs,
	failed,
	timedOut,
}: {
	target: string;
	zoom?: number;
	scheme: string;
	timeoutMs: number;
	failed: () => void;
	timedOut: () => void;
}) {
	const frame = useRef<HTMLElement>(null);
	const actions = useRef({ failed, timedOut });
	actions.current = { failed, timedOut };
	useLayoutEffect(() => {
		const element = frame.current,
			win = element?.ownerDocument.defaultView;
		if (!element || !win) return;
		let settled = false;
		const timer = win.setTimeout(() => {
			if (settled) return;
			settled = true;
			new Notice(t('web.webviewUnavailable'));
			actions.current.timedOut();
		}, timeoutMs);
		const ready = () => {
			if (settled) return;
			settled = true;
			win.clearTimeout(timer);
			if (zoom != null) {
				try {
					(element as HTMLElement & { setZoomFactor?: (value: number) => void }).setZoomFactor?.(zoom);
				} catch (error) {
					console.error('[Dashboard] webview setZoomFactor failed:', error);
				}
			}
		};
		const error = (event: Event) => {
			const detail = event as Event & { isMainFrame?: boolean; errorCode?: number };
			if (settled || detail.isMainFrame === false || detail.errorCode === -3) return;
			settled = true;
			win.clearTimeout(timer);
			actions.current.failed();
		};
		element.addEventListener('dom-ready', ready);
		element.addEventListener('did-fail-load', error);
		return () => {
			settled = true;
			win.clearTimeout(timer);
			element.removeEventListener('dom-ready', ready);
			element.removeEventListener('did-fail-load', error);
		};
	}, [target, zoom, timeoutMs]);
	return h('webview', {
		ref: frame,
		class: 'dashboard-web-frame',
		src: target,
		partition: 'persist:nand-dashboard-web',
		style: { colorScheme: scheme },
	});
}
export function WebPanel({
	root,
	column,
	options,
	reloadRegister,
}: {
	root: HTMLElement;
	column: DashboardColumn;
	options?: WebRenderOptions;
	reloadRegister: (fn: () => void) => void;
}) {
	const target = normalizeWebUrl(column.webConfig?.url ?? '');
	const [revision, setRevision] = useState(0);
	const [engine, setEngine] = useState<Engine>(() => initialEngine(target));
	const reload = () => {
		if (isValidWebUrl(target)) clearPrecheckCache(target);
		setEngine(initialEngine(target));
		setRevision((value) => value + 1);
	};
	useLayoutEffect(() => {
		reloadRegister(reload);
		return () => reloadRegister(() => {});
	}, [target, reloadRegister]);
	useLayoutEffect(() => {
		let disposed = false;
		setEngine(initialEngine(target));
		if (isValidWebUrl(target) && getCachedVerdict(target) === undefined)
			void precheckEmbed(target, options?.fetcher).then((result) => {
				if (!disposed && result.verdict === 'blocked') setEngine(Platform.isMobile ? 'fallback' : 'webview');
			});
		return () => {
			disposed = true;
		};
	}, [target, revision, options?.fetcher]);
	if (!isValidWebUrl(target))
		return (
			<div class="dashboard-web-empty">
				<div class="dashboard-web-empty-icon">
					<Icon name="globe" />
				</div>
				<div class="dashboard-web-empty-text">{t('web.emptyUrl')}</div>
				<div class="dashboard-web-empty-hint">{t('web.configureHint')}</div>
				<button
					class="dashboard-web-fallback-btn"
					type="button"
					onClick={() =>
						root.dispatchEvent(
							new CustomEvent('dashboard-library-config', {
								detail: { columnName: column.name },
								bubbles: true,
							}),
						)
					}
				>
					{t('web.configure')}
				</button>
			</div>
		);
	if (engine === 'error' || engine === 'fallback')
		return (
			<div class="dashboard-web-fallback">
				<div class="dashboard-web-fallback-icon">
					<Icon name={engine === 'error' ? 'alert-triangle' : 'globe'} />
				</div>
				<div class="dashboard-web-fallback-text">
					{t(engine === 'error' ? 'web.loadFailed' : 'web.mobileBlocked')}
				</div>
				{engine === 'fallback' && <div class="dashboard-web-fallback-host">{new URL(target).hostname}</div>}
				<div class="dashboard-web-fallback-url">{target}</div>
				<button
					class="dashboard-web-fallback-btn"
					type="button"
					onClick={() =>
						engine === 'error' ? reload() : root.ownerDocument.defaultView?.open(target, '_blank')
					}
				>
					{t(engine === 'error' ? 'web.retry' : 'web.openExternal')}
				</button>
			</div>
		);
	const scheme = colorScheme(root);
	return engine === 'webview' ? (
		<Webview
			key={revision}
			target={target}
			zoom={column.webConfig?.zoom}
			scheme={scheme}
			timeoutMs={options?.timeoutMs ?? 3500}
			failed={() => setEngine('error')}
			timedOut={() => setEngine('iframe')}
		/>
	) : (
		<iframe
			key={revision}
			class="dashboard-web-frame"
			src={target}
			referrerpolicy="no-referrer"
			allow="fullscreen"
			title={column.name}
			style={{ zoom: column.webConfig?.zoom, colorScheme: scheme }}
		/>
	);
}
