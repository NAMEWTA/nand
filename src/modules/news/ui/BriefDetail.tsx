import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../../shared/i18n';
import type { NewsBrief, NewsBriefResult, NewsRun } from '../core/model';
import type { NewsActions } from '../services/news-actions';

export type NewsMarkdownMount = (host: HTMLElement, text: string, path: string) => () => void;

/** Save state comes from the durable receipt; preview comes from the visible note. */
export function BriefDetail({ storyId, brief, run, actions, busy, mountMarkdown }: {
	storyId: string; brief?: NewsBrief; run?: NewsRun; actions: NewsActions; busy: boolean; mountMarkdown?: NewsMarkdownMount;
}) {
	const [notice, setNotice] = useState(''), [pending, setPending] = useState(false);
	const host = useRef<HTMLDivElement>(null), alive = useRef(true);
	useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
	useEffect(() => {
		if (host.current && brief && mountMarkdown) return mountMarkdown(host.current, brief.body, brief.path);
		return undefined;
	}, [brief?.body, brief?.path, mountMarkdown]);
	const received = run?.receipt?.state === 'received', interrupted = run?.receipt?.state === 'interrupted';
	const perform = (): void => {
		setPending(true);
		const task: Promise<NewsBriefResult> = received ? actions.resumeBrief(run.id) : actions.brief(storyId, interrupted ? run.id : undefined);
		void task.then(result => { if (alive.current) setNotice(t(result.status === 'complete' ? 'news.briefSaved' : result.status === 'budget' ? 'news.run.budget' : 'news.briefFailed')); })
			.catch(() => { if (alive.current) setNotice(t('news.briefFailed')); })
			.finally(() => { if (alive.current) setPending(false); });
	};
	return <section class="nand-news-brief">
		<button type="button" disabled={pending || busy} onClick={perform}>{t(received ? 'news.briefRetrySave' : interrupted ? 'news.briefRetry' : brief ? 'news.briefRegenerate' : 'news.brief')}</button>
		{received && <p>{t('news.briefSaveHelp')}</p>}
		{interrupted && <p>{t('news.interruptedHelp')}</p>}
		{notice && <p role="status">{notice}</p>}
		{brief && <>
			<button type="button" onClick={() => void actions.openNote(brief.path).catch(() => setNotice(t('news.note.missing')))}>{t('news.openNote')}</button>
			<p class="nand-news-meta">{brief.path}</p>
			<div ref={host} class="nand-news-brief-preview markdown-rendered">{!mountMarkdown && <p>{brief.body}</p>}</div>
		</>}
	</section>;
}
