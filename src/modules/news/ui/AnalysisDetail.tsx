import { t } from '../../../shared/i18n';
import type { NewsAnalysis } from '../core/model';

/** Score, axes and the stored reason. Nothing here is a generated answer. */
export function AnalysisDetail({ analysis, onReanalyze, busy }: { analysis?: NewsAnalysis; onReanalyze?: () => void; busy?: boolean }) {
	if (!analysis) return null;
	return (
		<section class="nand-news-analysis">
			{analysis.titleZh && <h3>{analysis.titleZh}</h3>}
			{analysis.summaryZh && <p>{analysis.summaryZh}</p>}
			<p>{t('news.attentionScore', { score: analysis.score })} · {t(`news.relevance.${analysis.relevance}`)}</p>
			<p>{t('news.filter.category')}: {analysis.category}{analysis.tags.length > 0 && ` · ${analysis.tags.join(' · ')}`}</p>
			{!analysis.groupConfirmed && <p>{t('news.groupPending')}</p>}
			{analysis.reason && <p>{t('news.reason')}: {analysis.reason}</p>}
			{analysis.samples.map((sample, index) => <div key={index}>
				<p>{t('news.sampleScore', { number: index + 1, score: analysis.sampleScores[index] ?? analysis.score })}</p>
				<ul>{Object.entries(sample.axes).map(([key, value]) => <li key={key}>{t(`news.axis.${key}`)} {value}</li>)}</ul>
				{sample.qualityFlags.length > 0 && <p>{sample.qualityFlags.map(flag => t(`news.cap.${flag}`)).join(' · ')}</p>}
			</div>)}
			{onReanalyze && <button type="button" disabled={busy} onClick={onReanalyze}>{t('news.reanalyze')}</button>}
		</section>
	);
}
