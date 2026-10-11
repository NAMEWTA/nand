import { useState } from 'preact/hooks';
import { t } from '../../../shared/i18n';
import type { NewsReadService } from '../api';
import type { NewsActions } from '../services/news-actions';

export function RunHistory({ service, actions }: { service: NewsReadService; actions: NewsActions }) {
	const [notice, setNotice] = useState('');
	const budget = service.callBudget(), activity = service.analysisActivity(), runs = service.runHistory().slice(0, 20);
	return <section class="nand-news-runs" aria-label={t('news.runs')}>
		<p>{t('news.quota', { used: budget.used, limit: budget.limit })}</p>
		{activity.map(state => <p key={state.id} role="status">
			{t(`news.run.${state.status}`)}{' '}
			<button type="button" onClick={() => void actions.openAnalysisTerminal(state.terminalId).catch(() => setNotice(t('news.analysisFailed')))}>{t('news.openTerminal')}</button>
		</p>)}
		{activity.length > 0 && <button type="button" onClick={() => actions.cancelAnalysis()}>{t('news.cancelAnalysis')}</button>}
		{notice && <p role="status">{notice}</p>}
		{runs.length > 0 && <details><summary>{t('news.runs')}</summary><ul>
			{runs.map(run => <li key={run.id}>
				<time dateTime={new Date(run.at).toISOString()}>{new Date(run.at).toLocaleString()}</time>{' '}
				{t(`news.run.${run.status}`)}{' · '}{t('news.runCalls', { calls: run.calls })}{' · '}
				{run.receipt?.result?.usage?.known && run.receipt.result.usage.cost !== null ? t('news.runCost', { cost: run.receipt.result.usage.cost.toFixed(4) }) : t('news.costUnknown')}
				{run.receipt?.result?.terminalId && actions.isTerminalRetained(run.receipt.result.terminalId) && <button type="button" onClick={() => void actions.openAnalysisTerminal(run.receipt!.result!.terminalId!).catch(() => setNotice(t('news.terminalUnavailable')))}>{t('news.openTerminal')}</button>}
				{run.receipt?.state === 'interrupted' && <>
					<p>{t('news.interruptedHelp')}</p>
					{(run.receipt.kind === 'analysis' || run.receipt.kind === 'grouping') && <button type="button" onClick={() => void actions.retryAnalysis(run.id).then(status => setNotice(t(`news.run.${status}`))).catch(() => setNotice(t('news.analysisFailed')))}>{t('news.retryAnalysis')}</button>}
					{run.receipt.kind === 'brief' && run.storyId && <button type="button" onClick={() => void actions.brief(run.storyId!, run.id).then(result => setNotice(t(`news.run.${result.status}`))).catch(() => setNotice(t('news.briefFailed')))}>{t('news.briefRetry')}</button>}
				</>}
				{run.receipt?.kind === 'brief' && run.receipt.state === 'received' && <>
					<p>{t('news.briefSaveHelp')}</p>
					<button type="button" onClick={() => void actions.resumeBrief(run.id).then(result => setNotice(t(result.status === 'complete' ? 'news.briefSaved' : 'news.briefFailed'))).catch(() => setNotice(t('news.briefFailed')))}>{t('news.briefRetrySave')}</button>
				</>}
				{run.storyId && service.brief(run.storyId) && <button type="button" onClick={() => void actions.openNote(service.brief(run.storyId!)!.path).catch(() => setNotice(t('news.note.missing')))}>{t('news.openNote')}</button>}
			</li>)}
		</ul></details>}
	</section>;
}
