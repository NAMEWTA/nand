import { t } from '../../../shared/i18n';
import type { HeatRank } from '../core/heat';
import type { NewsStory } from '../core/model';

export function HotList({ rows, stories, onSelect }: { rows: readonly HeatRank[]; stories: readonly NewsStory[]; onSelect: (id: string) => void }) {
	if (!rows.length) return null;
	return <section class="nand-news-hot">
		<h2>{t('news.hot')}</h2>
		<ol>{rows.map(row => <li key={row.eventId}>
			<button type="button" onClick={() => onSelect(row.eventId)}>{stories.find(story => story.id === row.eventId)?.title ?? row.eventId}</button>
			<p>{t('news.hotStats', { heat: row.index.toFixed(1), participants: row.participants, editorial: row.editorial })}</p>
			<p>{t(`news.trend.${row.trend}`)}{row.trendPct !== null && ` · ${row.trendPct > 0 ? '+' : ''}${row.trendPct}%`}{row.badges.map(badge => <span key={badge}> · {t(`news.badge.${badge}`)}</span>)}</p>
			{row.trend === 'unknown' && <p>{t('news.trendUnavailable')}</p>}
		</li>)}</ol>
	</section>;
}
