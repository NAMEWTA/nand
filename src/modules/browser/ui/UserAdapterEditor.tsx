import { useEffect, useState } from 'preact/hooks';
import { t } from '../../../shared/i18n';
import { Button } from '../../../ui/primitives/Button';
import type { BrowserPageTarget } from '../core/control';
import type { BrowserGrab } from '../core/model';
import { browserError } from '../core/text';
import { WORKSPACE_PROVIDERS } from '../core/providers/ids';
import { officialWorkspaceOrigin } from '../core/providers/official-url';
import type { AdapterDefinition, AdapterSelectors, UserAdapter } from '../core/providers/user-adapter';
import type { AdapterResult, AdapterReview, UserAdapters } from '../services/user-adapters';
import type { BrowserHost } from '../services/page-host';

export function UserAdapterEditor({ host, target, url, grab, pick, close }: {
	host: BrowserHost; target: BrowserPageTarget; url: string; grab?: BrowserGrab; pick: () => void; close: () => void;
}) {
	const provider = WORKSPACE_PROVIDERS.find(provider => !!officialWorkspaceOrigin(provider, url));
	const origin = provider && officialWorkspaceOrigin(provider, url);
	const [service, setService] = useState<UserAdapters>(), [rules, setRules] = useState<UserAdapter[]>([]), [selected, setSelected] = useState('');
	const [title, setTitle] = useState(''), [path, setPath] = useState('/*');
	const [selectors, setSelectors] = useState<AdapterSelectors>({ composer: '', submit: '', answer: '' });
	const [prompt, setPrompt] = useState(''), [scenario, setScenario] = useState('');
	const [review, setReview] = useState<AdapterReview>(), [result, setResult] = useState<AdapterResult>();
	const [busy, setBusy] = useState(false), [failure, setFailure] = useState<unknown>();
	useEffect(() => {
		let live = true;
		void host.getUserAdapters?.().then(async service => { const rules = await service.list(); if (live) { setService(service); setRules(rules); } }).catch(error => { if (live) setFailure(error); });
		return () => { live = false; };
	}, [host]);
	const run = (work: (service: UserAdapters) => Promise<void>) => {
		if (!service || busy) return; setBusy(true); setFailure(undefined);
		void work(service).then(async () => setRules(await service.list())).catch(setFailure).finally(() => setBusy(false));
	};
	const changed = () => { setReview(undefined); setResult(undefined); };
	const choose = (id: string) => {
		changed(); setSelected(id); const rule = rules.find(rule => rule.id === id);
		setTitle(rule?.title ?? ''); setPath(rule?.pathPattern ?? '/*'); setSelectors(rule?.selectors ?? { composer: '', submit: '', answer: '' });
	};
	const rule = rules.find(rule => rule.id === selected);
	const definition: AdapterDefinition | undefined = provider && origin ? { title, pathPattern: path, selectors, provider, origin, profileScope: target.profileId } : undefined;
	const saved = !!rule && definition && rule.title === title && rule.pathPattern === path && (['composer', 'submit', 'answer'] as const).every(role => selectors[role] === rule.selectors[role]);
	const canUseGrab = !!grab && grab.url === url;
	return <section class="nand-browser-user-adapter">
		<div class="nand-browser-workspace-actions"><h3>{t('browser.userAdapter')}</h3><Button onClick={close} disabled={busy}>{t('browser.close')}</Button></div>
		<p>{t('browser.adapter.help')}</p>
		{!definition ? <p>{t('browser.adapter.officialOnly')}</p> : <>
			<p>{provider} · {origin} · {host.profiles().find(profile => profile.id === target.profileId)?.label || t('browser.profile.default')}</p>
			<label class="nand-field"><span class="nand-field-label">{t('browser.adapter.rules')}</span><select value={selected} disabled={busy} onChange={event => choose(event.currentTarget.value)}>
				<option value="">{t('browser.adapter.new')}</option>{rules.filter(rule => rule.profileScope === target.profileId && rule.origin === origin).map(rule =>
					<option key={rule.id} value={rule.id}>{rule.title} · v{rule.version} · {t('browser.adapter.state.' + rule.state)}</option>)}
			</select></label>
			<label class="nand-field"><span class="nand-field-label">{t('browser.adapter.title')}</span><input value={title} disabled={busy} onInput={event => { setTitle(event.currentTarget.value); changed(); }} /></label>
			<label class="nand-field"><span class="nand-field-label">{t('browser.adapter.path')}</span><input value={path} disabled={busy} onInput={event => { setPath(event.currentTarget.value); changed(); }} /></label>
			<Button onClick={pick} disabled={busy}>{t('browser.adapter.pick')}</Button>
			{(['composer', 'submit', 'answer'] as const).map(role => <div class="nand-field" key={role}>
				<label><span class="nand-field-label">{t('browser.adapter.selector.' + role)}</span><input value={selectors[role]} disabled={busy} onInput={event => { setSelectors({ ...selectors, [role]: event.currentTarget.value }); changed(); }} /></label>
				<Button disabled={busy || !canUseGrab} onClick={() => { setSelectors({ ...selectors, [role]: grab!.selector }); changed(); }}>{t('browser.adapter.useSelection')}</Button>
			</div>)}
			<div class="nand-browser-workspace-actions"><Button disabled={busy || !service} onClick={() => run(async service => {
				const rule = await service.save(definition, selected || undefined); setSelected(rule.id); changed();
			})}>{t('browser.adapter.save')}</Button>
			{rule && <Button disabled={busy} onClick={() => run(async service => { await service.disable(rule.id); changed(); })}>{t('browser.adapter.disable')}</Button>}</div>
			{rule?.verification && <p>{t('browser.adapter.verified', { version: rule.verification.version, at: new Date(rule.verification.verifiedAt).toLocaleString() })} · {rule.verification.scenario}</p>}
			<label class="nand-field"><span class="nand-field-label">{t('browser.adapter.scenario')}</span><textarea value={scenario} disabled={busy} onInput={event => { setScenario(event.currentTarget.value); changed(); }} /></label>
			<label class="nand-field"><span class="nand-field-label">{t('browser.adapter.prompt')}</span><textarea value={prompt} disabled={busy} onInput={event => { setPrompt(event.currentTarget.value); changed(); }} /></label>
			<Button disabled={busy || !saved || rule?.state === 'enabled' || !prompt.trim() || !scenario.trim()} onClick={() => run(async service => {
				changed(); setReview(await service.preview(selected, target, prompt, scenario));
			})}>{t('browser.adapter.preview')}</Button>
			{review && <section class="nand-browser-adapter-review"><h4>{t('browser.adapter.review')}</h4>
				<p>{review.rule.title} · v{review.rule.version} · {review.rule.origin} · {review.rule.profileScope} · {review.rule.pathPattern}</p>
				<pre>{review.turn.finalPrompt}</pre><pre>{JSON.stringify(review.rule.selectors, null, 2)}</pre>
				<Button disabled={busy || !!result} onClick={() => run(async service => { const frozen = review; setReview(undefined); const result = await service.send(frozen.id); setReview(frozen); setResult(result); })}>{t('browser.adapter.send')}</Button>
			</section>}
			{result && <section class="nand-browser-adapter-result"><h4>{t('browser.adapter.confirmAnswer')}</h4>
				<p>{t('browser.adapter.partial')}</p><p>{result.capture.conversationId} · {result.capture.messageId}</p><pre>{result.capture.markdown}</pre>
				<Button disabled={busy} onClick={() => run(async service => { await service.enable(result.review.id); changed(); })}>{t('browser.adapter.enable')}</Button>
			</section>}
		</>}
		{failure && <p role="alert">{browserError(failure)}</p>}
		{service && ['unsaved', 'conflict'].includes(service.state().status) && <Button disabled={busy} onClick={() => run(service => service.retrySave())}>{t('browser.workspace.retrySave')}</Button>}
	</section>;
}
