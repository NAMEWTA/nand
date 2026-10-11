import { useEffect, useRef, useState } from 'preact/hooks';
import { getLanguage, t } from '../../../shared/i18n';
import { Button } from '../../../ui/primitives/Button';
import { EmptyState } from '../../../ui/primitives/EmptyState';
import { TextField } from '../../../ui/primitives/TextField';
import type { NewsReadService } from '../api';
import { filterView } from '../core/views';
import type { NewsActions } from '../services/news-actions';
import { AnalysisDetail } from './AnalysisDetail';
import { BriefDetail, type NewsMarkdownMount } from './BriefDetail';
import { DailyEdition } from './DailyEdition';
import { EventDetail } from './EventDetail';
import { HeatChart } from './HeatChart';
import { HotList } from './HotList';
import { sourceError } from './source-settings';
import { RunHistory } from './RunHistory';
import { SourcesPage } from './SourcesPage';
import { ViewEditor } from './ViewEditor';
import type { NewsPageState } from './page-state';

export function NewsPage({ service, actions, state, onState, mountMarkdown }: { service: NewsReadService; actions: NewsActions; state: NewsPageState; onState: (patch: Partial<NewsPageState>) => void; mountMarkdown?: NewsMarkdownMount }) {
	const [, redraw] = useState(0), [notice, setNotice] = useState('');
	const [notes, setNotes] = useState<Record<string, string>>({});
	const [sessions, setSessions] = useState<{ id: string; title: string }[]>([]);
	const sessionRequest = useRef(0);
	const loadSessions = (): void => {
		const request = ++sessionRequest.current;
		void actions.sessions().then(value => { if (request === sessionRequest.current) setSessions(value); })
			.catch(() => { if (request === sessionRequest.current) setSessions([]); });
	};
	useEffect(() => actions.subscribe(() => redraw(value => value + 1)), [actions]);
	useEffect(() => { loadSessions(); return () => { sessionRequest.current++; }; }, [actions]);
	const now = Date.now(), stories = service.stories(), analyses = service.analyses(), sources = service.sources();
	const sourceById = new Map(sources.map(item => [item.id, item])), byAnalysis = new Map(analyses.map(item => [item.materialId, item]));
	const favorites = service.favorites(), byId = new Map([...favorites, ...service.materials()].map(item => [item.id, item]));
	const visible = [...byId.values()].filter(item => !item.withdrawn && !actions.isHidden(item.id));
	const storyByMaterial = new Map(stories.flatMap(story => story.materialIds.map(id => [id, story] as const)));
	const view = service.views().find(item => item.id === state.view);
	const selectedStory = service.story(state.selected) ?? storyByMaterial.get(state.selected);
	const selectedId = byId.has(state.selected) ? state.selected : selectedStory?.representativeId;
	const selected = visible.find(item => item.id === selectedId);
	const reports = selected ? (selectedStory?.materialIds ?? [selected.id]).flatMap(id => visible.find(item => item.id === id) ?? []) : [];
	const listSection = ['featured', 'all', 'favorites', 'views'].includes(state.section);
	const base = state.section === 'favorites' ? visible.filter(item => favorites.some(favorite => favorite.id === item.id))
		: visible.filter(item => service.materials().includes(item) && (state.section !== 'featured' || byAnalysis.get(item.id)?.target === 'featured'));
	const filtered = filterView(state.filter, base, analyses), filteredIds = new Set(filtered.map(item => item.id));
	const emitted = new Set<string>();
	const rows = filtered.flatMap(material => {
		const story = storyByMaterial.get(material.id), key = story?.id ?? material.id;
		if (emitted.has(key)) return [];
		emitted.add(key);
		return story?.representativeId && filteredIds.has(story.representativeId) ? byId.get(story.representativeId)! : material;
	}).sort((a, b) => (b.publishedAt ?? b.discoveredAt) - (a.publishedAt ?? a.discoveredAt) || a.id.localeCompare(b.id));
	const date = (at: number | undefined): string => at === undefined ? t('news.dateUnknown') : new Date(at).toLocaleString(getLanguage() === 'zh' ? 'zh-CN' : 'en-US');
	const day = (at: number | undefined): string => at === undefined ? t('news.dateUnknown') : new Date(at).toLocaleDateString(getLanguage() === 'zh' ? 'zh-CN' : 'en-US');
	const select = (id: string): void => onState({ selected: id });
	return <main class="nand-news-page">
		<header class="nand-news-page-header"><h1>{state.section === 'views' && view ? view.name : t(`news.section.${state.section}`)}</h1>
			<div class="nand-ui-toolbar">
				<Button variant="primary" onClick={() => void actions.enable().then(() => service.refresh()).catch(error => setNotice(sourceError(error)))}>{t('news.refresh')}</Button>
				<Button onClick={() => void actions.enable().then(() => actions.analyze()).then(status => setNotice(t('news.analysisStatus', { status: t(`news.run.${status}`) }))).catch(() => setNotice(t('news.analysisFailed')))}>{t('news.analyze')}</Button>
			</div>
		</header>
		{notice && <p role="status">{notice}</p>}
		{(state.section === 'runs' || service.analysisActivity().length > 0) && <RunHistory service={service} actions={actions} />}
		{state.section === 'sources' && <SourcesPage sources={sources} actions={actions} />}
		{state.section === 'today' && <DailyEdition edition={actions.edition()} materials={visible} analyses={analyses} onSelect={select} onCompile={() => void actions.compileEdition().then(() => setNotice(t('news.edition.compiled'))).catch(() => setNotice(t('news.note.failed')))} />}
		{state.section === 'hot' && <>
			<HotList rows={service.hot(now)} stories={stories} onSelect={select} />
			{!service.hot(now).length && <p>{t('news.hot.empty')}</p>}
			<HeatChart points={service.heat()} facts={service.heatEvidence(now)} now={now} eventId={selectedStory?.id} rules={service.heatRules()} />
		</>}
		{listSection && <>
			<ViewEditor filter={state.filter} view={state.section === 'views' ? view : undefined} sources={sources} categories={[...new Set(analyses.map(item => item.category))]} actions={actions}
				onFilter={filter => onState({ filter })} onSaved={id => onState({ section: 'views', view: id })} onRemoved={() => onState({ section: 'all', view: '' })} />
			{state.section === 'views' && !view && <p>{t('news.view.missing')}</p>}
			{!rows.length && <EmptyState icon="newspaper" title={t('news.empty')} description={t(state.section === 'featured' ? 'news.empty.featured' : 'news.empty.filtered')} />}
			<ul class="nand-news-reading-list">{rows.map((material, index) => {
				const story = storyByMaterial.get(material.id), analysis = byAnalysis.get(material.id);
				const extra = Math.max(0, new Set((story?.materialIds ?? [material.id]).flatMap(id => byId.get(id)?.sourceId ?? [])).size - 1);
				const heading = day(material.publishedAt), previous = rows[index - 1];
				return <li key={material.id} data-news-material-id={material.id}>
					{(!previous || day(previous.publishedAt) !== heading) && <h2 class="nand-news-day">{heading}</h2>}
					<article class={`nand-ui-card${selectedId === material.id ? ' is-selected' : ''}`}>
						<Button variant="ghost" onClick={() => select(material.id)}>{analysis?.titleZh || material.title}</Button>
						<p class="nand-news-meta">{sourceById.get(material.sourceId)?.name ?? material.sourceId} · {date(material.publishedAt)}{extra > 0 && ` · ${t('news.otherSources', { count: extra })}`}{actions.isRead(material.id) && ` · ${t('news.readState')}`}</p>
						<p>{(analysis?.summaryZh || material.summary || material.bodyExcerpt || '').slice(0, 300)}</p>
					</article>
				</li>;
			})}</ul>
		</>}
		{selected && !['sources', 'runs'].includes(state.section) && <section class="nand-news-detail" data-news-selected-id={selected.id}>
			<h2>{byAnalysis.get(selected.id)?.titleZh || selected.title}</h2>
			<AnalysisDetail analysis={byAnalysis.get(selected.id)} busy={service.analysisActivity().length > 0} onReanalyze={() => void actions.reanalyze(selected.id).then(status => setNotice(t(`news.run.${status}`))).catch(() => setNotice(t('news.analysisFailed')))} />
			<EventDetail reports={reports} story={selectedStory} occurrences={service.occurrences().filter(item => item.storyId === selectedStory?.id)} sources={sources} order={state.order} sessions={sessions}
				onSessions={loadSessions}
				onOrder={() => onState({ order: state.order === 'asc' ? 'desc' : 'asc' })}
				onOpen={(url, win) => { void actions.openOriginal(url).then(opened => { if (!opened) win?.open(url, '_blank', 'noopener'); }).catch(() => setNotice(t('news.source.failed'))); }}
				onAttach={(id, report) => void actions.attach(id, report).catch(() => setNotice(t('news.source.failed')))}
				onHide={id => void actions.hide(id).catch(() => setNotice(t('news.readerFailed')))} onRead={id => void actions.markRead(id).catch(() => setNotice(t('news.readerFailed')))} />
			{selectedStory && <BriefDetail key={selectedStory.id} storyId={selectedStory.id} brief={service.brief(selectedStory.id)}
				run={service.runHistory().find(run => run.receipt?.kind === 'brief' && service.story(run.storyId ?? '')?.id === selectedStory.id)}
				actions={actions} busy={service.analysisActivity().length > 0} mountMarkdown={mountMarkdown} />}
			<TextField label={t('news.note.annotations')} multiline value={notes[selected.id] ?? ''} onInput={value => setNotes({ ...notes, [selected.id]: value })} />
			<Button onClick={() => void actions.favorite(selected, notes[selected.id] ?? '').then(() => setNotice(t('news.favoriteSaved')), () => setNotice(t('news.note.failed')))}>{t('news.favorite')}</Button>
			{service.favoriteLocation(selected.id) && <Button onClick={() => void actions.openNote(service.favoriteLocation(selected.id)!).catch(() => setNotice(t('news.note.missing')))}>{t('news.openNote')}</Button>}
		</section>}
		{state.selected && !selected && !['sources', 'runs'].includes(state.section) && <p>{t('news.selectionMissing')}</p>}
	</main>;
}
