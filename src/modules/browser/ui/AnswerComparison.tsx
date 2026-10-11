import { useState } from 'preact/hooks';
import { t } from '../../../shared/i18n';
import { Button } from '../../../ui/primitives/Button';
import { compareAnswers, type CaptureReference } from '../core/workspace/comparison';
import type { WorkspaceExchange, WorkspaceTurn } from '../core/workspace/model';
import { Answer, CaptureDetails, IncompleteAnswer, type CopyAnswer, type MountMarkdown } from './WorkspaceAnswers';

/** Local selection names immutable capture IDs; changing a current pointer cannot replace an open comparison. */
export function AnswerComparison({ turn, exchanges, mount, copy }: { turn: WorkspaceTurn; exchanges: WorkspaceExchange[]; mount: MountMarkdown; copy: CopyAnswer }) {
	const [selected, setSelected] = useState<CaptureReference[]>([]), [opened, setOpened] = useState(false), [focused, setFocused] = useState('');
	const [versions, setVersions] = useState<Record<string, string>>({});
	const candidates = exchanges.filter(row => row.turnId === turn.id && (row.currentCaptureId || row.selections?.length));
	if (candidates.length < 2) return null;
	const available = selected.filter(ref => candidates.some(row => row.id === ref.exchangeId && [...row.captures, ...(row.selections ?? [])].some(capture => capture.id === ref.captureId)));
	const answers = opened && available.length >= 2 ? compareAnswers(turn, exchanges, available) : [];
	const focus = answers.some(row => row.exchangeId === focused) ? focused : answers[0]?.exchangeId;
	return <section class="nand-browser-answer-comparison" aria-label={t('browser.workspace.compareAnswers')}>
		<div class="nand-browser-workspace-actions">
			{candidates.map(exchange => {
				const target = turn.targets.find(row => row.id === exchange.targetId)!;
				const checked = available.some(ref => ref.exchangeId === exchange.id);
				const options = [...exchange.captures, ...(exchange.selections ?? [])], selectedId = options.find(row => row.id === versions[exchange.id])?.id
					?? available.find(ref => ref.exchangeId === exchange.id)?.captureId ?? exchange.currentCaptureId ?? options.at(-1)!.id;
				return <div key={exchange.id}><label><input type="checkbox" checked={checked} disabled={!checked && available.length === 3}
					onChange={event => setSelected(event.currentTarget.checked ? [...available, { exchangeId: exchange.id, captureId: selectedId }]
						: available.filter(ref => ref.exchangeId !== exchange.id))} />{t('browser.workspace.target', { provider: t('browser.workspace.provider.' + target.provider), account: target.accountLabel })}</label>
					<label class="nand-field"><span class="nand-field-label">{t('browser.guidance.compareVersion')}</span><select value={selectedId} onChange={event => {
						const id = event.currentTarget.value; setVersions({ ...versions, [exchange.id]: id });
						if (checked) setSelected(available.map(ref => ref.exchangeId === exchange.id ? { ...ref, captureId: id } : ref));
					}}>{options.map((row, index) => <option key={row.id} value={row.id}>{row.source === 'user-selection' ? t('browser.guidance.excerpt') + ' ' + (index - exchange.captures.length + 1)
						: t('browser.workspace.captureRevision', { revision: row.revision })}</option>)}</select></label>
				</div>;
			})}
			<Button disabled={available.length < 2} onClick={() => setOpened(!opened)}>{t(opened ? 'browser.workspace.closeComparison' : 'browser.workspace.compareAnswers')}</Button>
		</div>
		<p>{t('browser.workspace.comparisonHint')}</p>
		{answers.length > 0 && <>
			<div class="nand-browser-workspace-actions nand-browser-comparison-focus">{answers.map(row => <button type="button" class="nand-btn" key={row.exchangeId} aria-pressed={row.exchangeId === focus}
				onClick={() => setFocused(row.exchangeId)}>{t('browser.workspace.target', { provider: t('browser.workspace.provider.' + row.target.provider), account: row.target.accountLabel })}</button>)}</div>
			<div class="nand-browser-answer-grid">{answers.map(row => <section key={row.exchangeId} data-focused={row.exchangeId === focus}>
				<h4>{t('browser.workspace.target', { provider: t('browser.workspace.provider.' + row.target.provider), account: row.target.accountLabel })}</h4>
				<p>{t('browser.workspace.acquire.' + (row.capture.complete ? 'complete' : 'incomplete'))}</p>
				{!row.capture.complete && <IncompleteAnswer reasons={row.capture.reasons} />}
				<CaptureDetails capture={row.capture} current={row.current} copy={copy} />
				<Answer text={row.capture.markdown} mount={mount} />
			</section>)}</div>
		</>}
	</section>;
}
