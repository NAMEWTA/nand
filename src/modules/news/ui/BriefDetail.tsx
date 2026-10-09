import { t } from '../../../shared/i18n';

/** Explicit brief request. The notice is the save result, not a model success report. */
export function BriefDetail({ notice, onBrief }: { notice: string; onBrief: () => void }) {
	return (
		<section class="nand-news-brief">
			<button type="button" onClick={onBrief}>
				{t('news.brief')}
			</button>
			{notice ? <p>{notice}</p> : null}
		</section>
	);
}
