import { t } from '../../../shared/i18n';
import type { NewsMaterial } from '../core/model';

/** Reports for one event. The original opens only from its button, and attach only pastes. */
export function EventDetail({
	reports,
	order,
	sessions,
	onOrder,
	onOpen,
	onAttach,
	onHide,
	onRead,
}: {
	reports: readonly NewsMaterial[];
	order: 'asc' | 'desc';
	sessions: readonly { id: string; title: string }[];
	onOrder: () => void;
	onOpen: (url: string, view: Window | null) => void;
	onAttach: (sessionId: string, material: NewsMaterial) => void;
	onHide: (id: string) => void;
	onRead: (id: string) => void;
}) {
	const sorted = [...reports].sort((left, right) => {
		const delta = (left.publishedAt ?? left.discoveredAt) - (right.publishedAt ?? right.discoveredAt);
		return order === 'asc' ? delta : -delta;
	});
	return (
		<section class="nand-news-event">
			<button type="button" onClick={onOrder}>
				{order === 'asc' ? t('news.orderAsc') : t('news.order')}
			</button>
			<ul>
				{sorted.map((report) => (
					<li key={report.id}>
						<strong>{report.title}</strong>
						<p>{report.summary || report.body || report.bodyExcerpt}</p>
						<p>
							{t('news.sources')}: {report.sourceId} {report.originalUrl}
						</p>
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
						{sessions.map((session) => (
							<button type="button" key={session.id} onClick={() => onAttach(session.id, report)}>
								{t('news.attach')} {session.title}
							</button>
						))}
					</li>
				))}
			</ul>
		</section>
	);
}
