import { h, render } from 'preact';
import { useEffect, useReducer, useState } from 'preact/hooks';
import { getLanguage, onLanguageChanged, t } from '../../../shared/i18n';
import type { NewsReadService } from '../api';
import type { HomeWidgetContext } from '../../home/api';
import type { WorkbenchTarget } from '../../../app/contracts/workbench';
import { newsWidgetRows } from '../core/widget-rows';
import { RenderBoundary } from '../../../ui/primitives/RenderBoundary';
import { Button } from '../../../ui/primitives/Button';
import { sourceError } from './source-settings';

function HomeNewsWidget({ service, context, host, open }: { service: NewsReadService; context: HomeWidgetContext; host: HTMLElement; open: (target: WorkbenchTarget) => Promise<void> }) {
	const [, refresh] = useReducer((revision: number) => revision + 1, 0);
	const [error, setError] = useState('');
	useEffect(() => {
		const off = service.subscribe(() => refresh(undefined)), language = onLanguageChanged(() => refresh(undefined));
		const update = () => {
			refresh(undefined);
			if (!host.getClientRects().length || host.closest('[inert]')) return;
			void service.refreshWidget(context.instanceId).catch(error => { if (!context.signal.aborted) setError(sourceError(error)); });
		};
		update();
		const timer = context.window.setInterval(update, 60_000);
		return () => { off(); language(); context.window.clearInterval(timer); };
	}, [service, context, host]);
	const config = service.widgets().find(item => item.id === context.instanceId);
	if (!config) return <p role="status">{t('news.widget.missing')}</p>;
	const view = config.mode === 'view' ? service.views().find(item => item.id === config.viewId) : undefined;
	const rows = newsWidgetRows(service, config), collection = service.collectionActivity(), analysis = service.analysisActivity();
	const stale = collection.lastSuccess === undefined || Date.now() - collection.lastSuccess >= config.staleMinutes * 60_000;
	const navigate = (target: WorkbenchTarget) => { void open(target).catch(error => { if (!context.signal.aborted) setError(sourceError(error)); }); };
	const collect = () => {
		setError('');
		void service.refresh().catch(error => { if (!context.signal.aborted) setError(sourceError(error)); });
	};
	return <div class="dashboard-sidebar-widget dashboard-sidebar-news" data-news-widget={config.id}>
		<div class="nand-ui-toolbar"><Button variant="ghost" onClick={() => navigate({ feature: 'news', section: config.mode === 'view' ? 'views' : config.mode, ...(config.mode === 'view' ? { resourceId: config.viewId } : {}) })}>{config.name || view?.name || t(`news.widget.${config.mode}`)}</Button>
			<Button disabled={!collection.enabled || collection.pending > 0} onClick={collect}>{t('news.refresh')}</Button></div>
		<p class="nand-news-widget-update">{collection.lastSuccess === undefined ? t('news.widget.neverUpdated') : t('news.widget.updated', { time: new Date(collection.lastSuccess).toLocaleString(getLanguage() === 'zh' ? 'zh-CN' : 'en-US') })}{stale && ` · ${t('news.widget.stale')}`}</p>
		{collection.pending > 0 && <p role="status">{t('news.widget.refreshing', { count: collection.pending })}</p>}
		{analysis.length > 0 && <Button onClick={() => navigate({ feature: 'news', section: 'runs' })}>{t(analysis.some(run => run.status === 'needs-attention') ? 'news.widget.attention' : 'news.widget.analyzing', { count: analysis.length })}</Button>}
		{!collection.enabled && <Button onClick={() => navigate({ feature: 'settings', section: 'news' })}>{t('news.widget.collectionDisabled')}</Button>}
		{error && <p role="alert">{error}</p>}
		{config.mode === 'view' && !view ? <p role="status">{t('news.widget.viewMissing')}</p> : !rows.length && <p>{t('news.empty')}</p>}
		<ul>{rows.map(row => <li key={row.id}><Button variant="ghost" onClick={() => navigate({ feature: 'news', resourceId: row.id })}>{row.title}</Button>{row.heat !== undefined && <span> · {row.heat.toFixed(1)}</span>}{config.showSummary && row.summary && <p>{row.summary}</p>}</li>)}</ul>
	</div>;
}

export function mountHomeNewsWidget(host: HTMLElement, service: NewsReadService, context: HomeWidgetContext, open: (target: WorkbenchTarget) => Promise<void>): () => void {
	render(h(RenderBoundary, { onError: context.reportError, children: h(HomeNewsWidget, { service, context, host, open }) }), host);
	return () => render(null, host);
}
