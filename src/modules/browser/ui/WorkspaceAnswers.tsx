import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../../shared/i18n';
import { Button } from '../../../ui/primitives/Button';
import { browserError } from '../core/text';
import type { AnswerCapture, ImportedAnswer, SelectedExcerpt } from '../core/workspace/model';

export type MountMarkdown = (host: HTMLElement, text: string) => () => void;
export type CopyAnswer = (text: string, win: Window) => Promise<void>;
const captureReasonGroups = [
	['history', ['missing-page', 'initial-page-missing', 'history-beginning-unverified', 'pagination-unverified', 'duplicate-cursor', 'history-bound-reached', 'message-count-changed', 'message-count-mismatch', 'message-count-invalid']],
	['identity', ['active-branch-unverified', 'conflicting-message', 'missing-parent-message', 'parent-identity-unverified', 'cyclic-parent-chain', 'invalid-role-order', 'unrecognized-public-message', 'unsupported-public-content', 'missing-public-content', 'ambiguous-public-content']],
	['generating', ['unfinished-assistant', 'terminal-message-unverified', 'terminal-unobserved']],
	['interrupted', ['interrupted']], ['timeout', ['acquisition-timeout']], ['dom', ['scoped-dom-coverage-unverified', 'truncated-dom']], ['empty', ['empty-answer']],
	['content', ['title-only', 'status-only']],
	['copy', ['native-copy-coverage-unverified']],
	['selection', ['user-selection']],
] as const;
export function IncompleteAnswer({ reasons }: { reasons: string[] }) {
	const groups = captureReasonGroups.filter(([, codes]) => codes.some(code => reasons.includes(code))).map(([group]) => group);
	return <ul>{(groups.length ? groups : ['unknown']).map(group => <li key={group}>{t('browser.workspace.incomplete.' + group)}</li>)}</ul>;
}
export function Answer({ text, mount }: { text: string; mount: MountMarkdown }) {
	const root = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => root.current ? mount(root.current, text) : undefined, [text, mount]);
	return <div class="nand-browser-answer markdown-rendered" ref={root} />;
}
export function ImportedTranscript({ source, mount, copy }: { source: ImportedAnswer; mount: MountMarkdown; copy: CopyAnswer }) {
	const [copied, setCopied] = useState(false), [failure, setFailure] = useState<unknown>();
	const body = source.markdown || source.text;
	return <div class="nand-browser-imported-answer">
		<p>{t('browser.workspace.importedSource')}</p>
		<p>{t('browser.workspace.importedStatus', { status: t('browser.workspace.importStatus.' + source.record.responseStatus) })}</p>
		{body ? <>
			{source.markdown ? <Answer text={source.markdown} mount={mount} /> : <pre>{source.text}</pre>}
			{source.markdown && source.text && source.markdown !== source.text && <details><summary>{t('browser.workspace.importedPlain')}</summary><pre>{source.text}</pre></details>}
			<Button onClick={event => { setCopied(false); setFailure(undefined); void copy(body, event.currentTarget.win).then(() => setCopied(true), setFailure); }}>{t('browser.workspace.copyImportedAnswer')}</Button>
		</> : <p>{t('browser.workspace.recoveryNoAnswer')}</p>}
		{copied && <p role="status">{t('browser.workspace.answerCopied')}</p>}
		{failure && <p role="alert">{browserError(failure)}</p>}
	</div>;
}
export function CaptureDetails({ capture, copy, current = true }: { capture: AnswerCapture | SelectedExcerpt; copy: CopyAnswer; current?: boolean }) {
	const [copied, setCopied] = useState(false), [failure, setFailure] = useState<unknown>();
	return <div class="nand-browser-capture-details">
		<p>{t('browser.workspace.captureRevision', { revision: capture.revision })} · {t('browser.workspace.source.' + capture.source)}
			{!current && capture.source !== 'user-selection' && <> · {t('browser.workspace.earlierCapture')}</>}</p>
		<details><summary>{t('browser.workspace.captureDetails')}</summary>
			<dl class="nand-browser-workspace-status">
				{capture.source === 'user-selection' ? <>
					<div><dt>{t('browser.assistant.page')}</dt><dd>{capture.selection.url}</dd></div>
					<div><dt>{t('browser.guidance.boundary')}</dt><dd><code>{capture.selection.selector}</code><pre>{JSON.stringify({ page: capture.selection.page, rect: capture.selection.rect, viewport: capture.selection.viewport }, null, 2)}</pre></dd></div>
					<div><dt>{t('browser.workspace.conversationId')}</dt><dd>{capture.selection.conversationId ?? t('browser.guidance.unknownIdentity')}</dd></div>
					<div><dt>{t('browser.workspace.messageId')}</dt><dd>{capture.selection.messageId ?? t('browser.guidance.unknownIdentity')}</dd></div>
				</> : <>
					<div><dt>{t('browser.workspace.adapterVersion')}</dt><dd>{capture.adapterVersion}</dd></div>
					<div><dt>{t('browser.workspace.conversationId')}</dt><dd>{capture.conversationId}</dd></div>
					<div><dt>{t('browser.workspace.messageId')}</dt><dd>{capture.messageId}</dd></div>
				</>}
				<div><dt>{t('browser.workspace.model')}</dt><dd>{t('browser.workspace.modelUnknown')}</dd></div>
			</dl>
		</details>
		<Button onClick={event => { setCopied(false); setFailure(undefined); void copy(capture.markdown, event.currentTarget.win).then(() => setCopied(true), setFailure); }}>
			{t('browser.workspace.copyAnswer')}</Button>
		{copied && <span role="status">{t('browser.workspace.answerCopied')}</span>}
		{failure && <p role="alert">{browserError(failure)}</p>}
	</div>;
}
export function CaptureHistory({ captures, currentId, mount, copy }: { captures: Array<AnswerCapture | SelectedExcerpt>; currentId?: string; mount: MountMarkdown; copy: CopyAnswer }) {
	const [open, setOpen] = useState(false);
	return <details class="nand-browser-capture-history" onToggle={event => setOpen(event.currentTarget.open)}>
		<summary>{t('browser.workspace.captureHistory')}</summary>
		{open && captures.filter(row => row.id !== currentId).toReversed().map(row => <section key={row.id}>
			<h5>{t('browser.workspace.captureRevision', { revision: row.revision })} · {t('browser.workspace.acquire.' + (row.complete ? 'complete' : 'incomplete'))}</h5>
			{!row.complete && <IncompleteAnswer reasons={row.reasons} />}
			<CaptureDetails capture={row} current={false} copy={copy} />
			<Answer text={row.markdown} mount={mount} />
		</section>)}
	</details>;
}
