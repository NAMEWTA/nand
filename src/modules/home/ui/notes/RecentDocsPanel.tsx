import { t } from '../../../../shared/i18n';
import type { RecentDoc } from '../ui/recent';
import { formatRelativeTime } from '../ui/recent-time';
export function RecentDocsPanel({ docs, open }: { docs: RecentDoc[]; open: (path: string) => void }) {
	return (
		<>
			<h3 class="dashboard-section-title">{t('recent.title')}</h3>
			{!docs.length ? (
				<span class="dashboard-empty">{t('recent.empty')}</span>
			) : (
				<div class="dashboard-recent-list">
					{docs.map((doc) => (
						<div
							key={doc.path}
							class="dashboard-recent-item"
							role="button"
							aria-label={t('common.open', { name: doc.name })}
							onClick={() => open(doc.path)}
						>
							<span class="dashboard-recent-name">{doc.name}</span>
							<span class="dashboard-recent-time">{doc.timestamp === undefined ? doc.relativeTime : formatRelativeTime(doc.timestamp)}</span>
						</div>
					))}
				</div>
			)}
		</>
	);
}
