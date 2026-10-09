import { t } from '../../../shared/i18n';
import type { NewsAnalysis } from '../core/model';

/** Score, axes and the stored reason. Nothing here is a generated answer. */
export function AnalysisDetail({ analysis }: { analysis?: NewsAnalysis }) {
	if (!analysis) return null;
	return (
		<section class="nand-news-analysis">
			<p>
				{t('news.reason')}: {analysis.reason || analysis.target} {analysis.score}
			</p>
			<ul>
				{Object.entries(analysis.axes).map(([key, value]) => (
					<li key={key}>
						{key} {value}
					</li>
				))}
			</ul>
		</section>
	);
}
