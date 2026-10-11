import { t } from '../../../shared/i18n';
import { Button } from '../../../ui/primitives/Button';
import type { NewsAnalysis, NewsEdition, NewsMaterial } from '../core/model';

export function DailyEdition({ edition, materials, analyses, onSelect, onCompile }: {
	edition: NewsEdition; materials: readonly NewsMaterial[]; analyses: readonly NewsAnalysis[];
	onSelect: (id: string) => void; onCompile: () => void;
}) {
	const byId = new Map(materials.map(item => [item.id, item])), byAnalysis = new Map(analyses.map(item => [item.materialId, item]));
	return <section class="nand-news-edition">
		<p>{edition.date} · {edition.timeZone}</p>
		<p>{t('news.edition.localDay')}</p>
		<Button onClick={onCompile}>{t('news.edition.compile')}</Button>
		{!edition.materialIds.length && <p>{t('news.edition.empty')}</p>}
		{([['main', edition.main], ['flashes', edition.flashes]] as const).map(([section, entries]) => !!entries.length && <section key={section}>
			<h2>{t(`news.edition.${section}`)}</h2><ol>{entries.map(entry => <li key={entry.materialId}>
				<Button variant="ghost" onClick={() => onSelect(entry.materialId)}>{byAnalysis.get(entry.materialId)?.titleZh || byId.get(entry.materialId)?.title}</Button>
				{section === 'main' && <p>{byAnalysis.get(entry.materialId)?.summaryZh || byId.get(entry.materialId)?.summary}</p>}
				{entry.followUp && <p>{t('news.edition.followUp', { date: entry.followUp })}</p>}
				{entry.fillIn && <p>{t('news.edition.fillIn')}</p>}
				{!!entry.relatedIds.length && <ul>{entry.relatedIds.map(id => <li key={id}><Button variant="ghost" onClick={() => onSelect(id)}>{byAnalysis.get(id)?.titleZh || byId.get(id)?.title}</Button></li>)}</ul>}
			</li>)}</ol>
		</section>)}
	</section>;
}
