import { Platform } from 'obsidian';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../../shared/i18n';
import { Button } from '../../../ui/primitives/Button';
import { TextField } from '../../../ui/primitives/TextField';
import type { BrowserPageTarget } from '../core/control';
import { EXTERNAL_BROWSER_OPERATIONS, type ExternalAccessRequest } from '../core/external-access';
import type { ScopedBrowserOperation } from '../core/scoped-grant';
import { browserError } from '../core/text';
import type { BrowserModule } from '../services';
import type { BrowserGrants } from '../services/grants';

function connectionCommand(environment: Readonly<Record<string, string>>): string {
	const quote = (value: string) => "'" + (Platform.isWin ? value.replace(/'/g, "''") : value.replace(/'/g, "'\\''")) + "'";
	const names = ['NAND_BROWSER_CLI', 'NAND_BROWSER_CONTEXT', 'NAND_BROWSER_TOKEN', 'NAND_BROWSER_TASK'];
	const assignments = names.map(name => Platform.isWin ? `$env:${name}=${quote(environment[name] ?? '')};` : `export ${name}=${quote(environment[name] ?? '')};`).join('\n');
	return assignments + (Platform.isWin ? '\nnode $env:NAND_BROWSER_CLI tab list' : '\nnode "$NAND_BROWSER_CLI" tab list');
}

export function BrowserAccess({ module, grants }: { module: BrowserModule; grants: BrowserGrants }) {
	const [purpose, setPurpose] = useState(''), [targets, setTargets] = useState<BrowserPageTarget[]>([]);
	const [operations, setOperations] = useState<ScopedBrowserOperation[]>(['snapshot', 'get']), [minutes, setMinutes] = useState(10), [limit, setLimit] = useState(100);
	const [review, setReview] = useState<ExternalAccessRequest>(), [issued, setIssued] = useState<{ id: string; command: string }>();
	const [busy, setBusy] = useState(false), [failure, setFailure] = useState<unknown>(), locked = useRef(false);
	const mounted = useRef(true); useEffect(() => () => { mounted.current = false; }, []);
	const work = (action: () => Promise<unknown>) => { if (locked.current) return; locked.current = true; setBusy(true); setFailure(undefined);
		void action().catch(setFailure).finally(() => { locked.current = false; setBusy(false); }); };
	const change = (action: () => void) => { setReview(undefined); action(); };
	const pages = module.control.list(), records = grants.list(), activeConnection = issued && records.some(row => row.id === issued.id && row.state === 'active');
	return <div class="nand-browser-workspace nand-browser-access"><h2>{t('browser.access.title')}</h2><p>{t('browser.access.intro')}</p>
		{failure && <p role="alert">{browserError(failure)}</p>}
		<fieldset disabled={busy}><legend>{t('browser.access.new')}</legend>
			<TextField label={t('browser.access.purpose')} value={purpose} onInput={value => change(() => setPurpose(value))} />
			<fieldset><legend>{t('browser.assistant.pages')}</legend>{pages.map(page => <label class="nand-browser-workspace-check" key={page.target.pageId}>
				<input type="checkbox" checked={targets.some(target => target.pageId === page.target.pageId)} onChange={event => change(() => setTargets(event.currentTarget.checked ? [...targets, { ...page.target }] : targets.filter(target => target.pageId !== page.target.pageId)))} />
				<span>{page.title || page.url} · {module.profiles().find(profile => profile.id === page.target.profileId)?.label || t('browser.profile.default')}<br /><small>{page.url}</small></span>
			</label>)}</fieldset>
			<fieldset><legend>{t('browser.assistant.operations')}</legend><div class="nand-browser-assistant-operations">
				{EXTERNAL_BROWSER_OPERATIONS.map(operation => <label class="nand-browser-workspace-check" key={operation}><input type="checkbox" checked={operations.includes(operation)}
					onChange={event => change(() => setOperations(event.currentTarget.checked ? [...operations, operation] : operations.filter(old => old !== operation)))} />{t('browser.assistant.operation.' + operation)}</label>)}
			</div></fieldset>
			<div class="nand-browser-assistant-limits"><label class="nand-field"><span class="nand-field-label">{t('browser.assistant.minutes')}</span><input type="number" min={1} max={30} value={minutes} onInput={event => change(() => setMinutes(event.currentTarget.valueAsNumber))} /></label>
				<label class="nand-field"><span class="nand-field-label">{t('browser.assistant.maxOperations')}</span><input type="number" min={1} max={200} value={limit} onInput={event => change(() => setLimit(event.currentTarget.valueAsNumber))} /></label></div>
			<Button disabled={!purpose.trim() || !targets.length || !operations.length || !Number.isSafeInteger(minutes) || minutes < 1 || minutes > 30 || !Number.isSafeInteger(limit) || limit < 1 || limit > 200}
				onClick={() => setReview(structuredClone({ purpose, targets, operations, minutes, maxOperations: limit }))}>{t('browser.access.review')}</Button>
		</fieldset>
		{review && <section class="nand-browser-workspace-preview" data-access-review><h3>{review.purpose}</h3><p>{t('browser.access.reviewHelp', { minutes: review.minutes, count: review.maxOperations })}</p>
			<ul>{review.targets.map(target => { const page = pages.find(page => page.target.pageId === target.pageId); return <li key={target.pageId}>{page?.title} · {page?.url} · {module.profiles().find(profile => profile.id === target.profileId)?.label || t('browser.profile.default')}</li>; })}</ul>
			<p>{review.operations.map(operation => t('browser.assistant.operation.' + operation)).join(' · ')}</p>
			<Button disabled={busy} variant="primary" onClick={() => work(async () => { const created = await grants.create(review); if (!mounted.current) { grants.revoke(created.grant.id); return; } setReview(undefined); setIssued({ id: created.grant.id, command: connectionCommand(created.environment) }); })}>{t('browser.access.create')}</Button>
		</section>}
		{issued && activeConnection && <section class="nand-browser-workspace-preview" data-access-connection={issued.id}><h3>{t('browser.access.connection')}</h3><p>{t('browser.access.secretHelp')}</p><pre>{issued.command}</pre>
			<div class="nand-browser-workspace-actions"><Button onClick={() => module.copyText(issued.command)}>{t('browser.access.copy')}</Button><Button onClick={() => setIssued(undefined)}>{t('browser.access.hide')}</Button></div>
		</section>}
		<h3>{t('browser.access.grants')}</h3><p>{t('browser.access.historyHelp')}</p>
		{records.map(record => <article key={record.id} class="nand-browser-workspace-preview" data-access-grant={record.id}><h4>{record.purpose}</h4>
			<p role="status">{t('browser.access.state.' + record.state)} · {t('browser.access.expires', { time: new Date(record.expiresAt).toLocaleTimeString() })} · {record.used}/{record.maxOperations}</p>
			<ul>{record.pages.map(page => <li key={page.target.pageId}>{page.title} · {page.accountLabel} · {page.url}</li>)}</ul>
			<p>{record.operations.map(operation => t('browser.assistant.operation.' + operation)).join(' · ')}</p>
			{record.state === 'active' && <Button onClick={() => { grants.revoke(record.id); if (issued?.id === record.id) setIssued(undefined); }}>{t('browser.access.revoke')}</Button>}
			{record.events.length > 0 && <details><summary>{t('browser.access.events')}</summary><ol>{record.events.map(event => <li key={event.id}>{t('browser.assistant.operation.' + event.operation)} · {t('browser.assistant.step.' + event.state)}{event.errorCode && <p>{browserError(event.errorCode)}</p>}</li>)}</ol></details>}
		</article>)}
	</div>;
}
