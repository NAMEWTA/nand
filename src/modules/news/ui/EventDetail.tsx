import { t } from '../../../shared/i18n';
import type { NewsMaterial, NewsOccurrence, NewsSource, NewsStory } from '../core/model';

/** Reports for one event. The original opens only from its button, and attach only pastes. */
export function EventDetail({
	reports,
	story,
	occurrences,
	sources,
	order,
	sessions,
	onOrder,
	onOpen,
	onAttach,
	onHide,
	onRead,
	onSessions,
}: {
	reports: readonly NewsMaterial[];
	story?: NewsStory;
	occurrences: readonly NewsOccurrence[];
	sources: readonly NewsSource[];
	order: 'asc' | 'desc';
	sessions: readonly { id: string; title: string }[];
	onOrder: () => void;
	onOpen: (url: string, view: Window | null) => void;
	onAttach: (sessionId: string, material: NewsMaterial) => void;
	onHide: (id: string) => void;
	onRead: (id: string) => void;
	onSessions?: () => void;
}) {
	const sorted = [...reports].sort((left, right) => {
		const delta = (left.publishedAt ?? left.discoveredAt) - (right.publishedAt ?? right.discoveredAt);
		return order === 'asc' ? delta : -delta;
	});
	const visibleIds = new Set(reports.map(report => report.id));
	const progress = occurrences.map(item => ({ ...item, materialIds: item.materialIds.filter(id => visibleIds.has(id)) })).filter(item => item.materialIds.length > 0)
		.sort((left, right) => (left.firstSeenAt - right.firstSeenAt || left.id.localeCompare(right.id)) * (order === 'asc' ? 1 : -1));
	return (
		<section class="nand-news-event">
			{story && <><h3>{t('news.eventOverview')}</h3><p>{story.title}</p></>}
			<button type="button" onClick={onOrder}>
				{order === 'asc' ? t('news.orderAsc') : t('news.order')}
			</button>
			{progress.length > 0 && <>
				<h3>{t('news.eventProgress')}</h3>
				<ol>{progress.map(item => <li key={item.id}>
					<strong>{item.title}</strong> · <time dateTime={new Date(item.firstSeenAt).toISOString()}>{new Date(item.firstSeenAt).toLocaleString()}</time>
					<span> · {t('news.reportCount', { count: item.materialIds.length })}</span>
				</li>)}</ol>
			</>}
			<h3>{t('news.reportTimeline')}</h3>
			<ul>
				{sorted.map((report) => (
					<li key={report.id}>
						<strong>{report.title}</strong>
						<p>{report.summary || report.body || report.bodyExcerpt}</p>
						<p>
							{t('news.sources')}: {sources.find(source => source.id === report.sourceId)?.name ?? report.sourceId} · {report.publishedAt === undefined ? t('news.dateUnknown') : <time dateTime={new Date(report.publishedAt).toISOString()}>{new Date(report.publishedAt).toLocaleString()}</time>}
						</p>
						<p>{report.originalUrl}</p>
						<button
							type="button"
							onClick={(event) => onOpen(report.originalUrl, event.currentTarget.ownerDocument.defaultView)}
						>
							{t('news.openOriginal')}
						</button>
						<button type="button" onClick={() => onRead(report.id)}>
							{t('news.read')}
						</button>
						<button type="button" onClick={() => onHide(report.id)}>
							{t('news.hide')}
						</button>
						<details onToggle={event => { if (event.currentTarget.open) onSessions?.(); }}><summary>{t('news.attach')}</summary>
						{!sessions.length && <p>{t('news.sessionsEmpty')}</p>}
						{sessions.map((session) => (
							<button type="button" key={session.id} onClick={() => onAttach(session.id, report)}>
								{t('news.attach')} {session.title}
							</button>
						))}
						</details>
					</li>
				))}
			</ul>
		</section>
	);
}
