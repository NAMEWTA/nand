import { useEffect, useState } from 'preact/hooks';
import { t } from '../../../shared/i18n';
import type { NewsReadService } from '../api';
import type { NewsActions } from '../services/news-actions';
import { AnalysisDetail } from './AnalysisDetail';
import { BriefDetail } from './BriefDetail';
import { EventDetail } from './EventDetail';
import { HeatChart } from './HeatChart';

export function NewsPage({ service, actions }: { service: NewsReadService; actions: NewsActions }) {
	const [, redraw] = useState(0);
	const [url, setUrl] = useState('');
	const [opml, setOpml] = useState('');
	const [notice, setNotice] = useState('');
	const [notes, setNotes] = useState<Record<string, string>>({});
	const [selected, setSelected] = useState('');
	const [order, setOrder] = useState<'asc' | 'desc'>('desc');
	const [briefNotice, setBriefNotice] = useState('');
	const [sessions, setSessions] = useState<{ id: string; title: string }[]>([]);
	const [now] = useState(() => Date.now());
	useEffect(() => service.subscribe(() => redraw((value) => value + 1)), [service]);
	useEffect(() => {
		void actions.sessions().then(setSessions);
	}, [actions]);
	const edition = actions.edition();
	const current = selected || service.focusedId();
	return (
		<main class="nand-news-page">
			<header>
				<h1>{t('news.title')}</h1>
				<button type="button" onClick={() => void actions.enable().then(() => service.refresh())}>{t('news.refresh')}</button>
				<button type="button" onClick={() => void actions.enable().then(() => actions.analyze()).then((status) => setNotice(t('news.analysisStatus', { status })))}>{t('news.analyze')}</button>
			</header>
			<form onSubmit={(event) => { event.preventDefault(); void actions.addSource(url).then((added) => { if (added) setUrl(''); }); }}>
				<input value={url} placeholder={t('news.source')} onInput={(event) => setUrl(event.currentTarget.value)} />
				<button type="submit">{t('news.addSource')}</button>
			</form>
			<textarea value={opml} placeholder={t('news.opml')} onInput={(event) => setOpml(event.currentTarget.value)} />
			<button type="button" onClick={() => void actions.importOpml(opml).then(() => setOpml(''))}>{t('news.importOpml')}</button>
			{notice && <p>{notice}</p>}
			{edition && <section><h2>{t('news.edition')}</h2><p>{edition.date}</p></section>}
			<HeatChart points={service.heat()} now={now} eventId={service.stories().find((story) => story.materialIds.includes(current))?.id} />
			<ul>
				{service.materials().filter((material) => !actions.isHidden(material.id)).map((material) => {
					const story = service.stories().find((item) => item.materialIds.includes(material.id));
					const reports = (story?.materialIds ?? [material.id]).flatMap((id) => {
						const found = service.materials().find((item) => item.id === id);
						return found ? [found] : [];
					});
					return (
						<li key={material.id}>
							<button type="button" onClick={() => setSelected(material.id)}>{material.title}</button>
							<p>{(material.summary || material.body || '').slice(0, 180)}</p>
							{current === material.id && (
								<>
									<AnalysisDetail analysis={service.analyses().find((item) => item.materialId === material.id)} />
									<EventDetail
										reports={reports}
										order={order}
										sessions={sessions}
										onOrder={() => setOrder(order === 'asc' ? 'desc' : 'asc')}
										onOpen={(target, view) => {
											void actions.openOriginal(target).then((opened) => {
												if (!opened) view?.open(target, '_blank', 'noopener');
											});
										}}
										onAttach={(sessionId, report) => void actions.attach(sessionId, report)}
										onHide={(id) => void actions.hide(id)}
										onRead={(id) => void actions.markRead(id)}
									/>
									<BriefDetail
										notice={briefNotice}
										onBrief={() => {
											if (!story) return;
											void actions.brief(story.id).then((result) => setBriefNotice(t(result.status === 'complete' ? 'news.briefSaved' : 'news.briefFailed')));
										}}
									/>
								</>
							)}
							<input value={notes[material.id] ?? ''} onInput={(event) => setNotes({ ...notes, [material.id]: event.currentTarget.value })} />
							<button type="button" onClick={() => void actions.favorite(material, notes[material.id] ?? '').then(() => setNotice(t('news.favoriteSaved')))}>{t('news.favorite')}</button>
						</li>
					);
				})}
			</ul>
		</main>
	);
}
