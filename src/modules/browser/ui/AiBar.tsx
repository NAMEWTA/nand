import { useState } from 'preact/hooks';
import { t } from '../../../shared/i18n';
import type { AiWorkspace } from '../services/ai-workspace';

/** Send, capture, profiles, history import, and opt-in synthesis for the open page. */
export function AiBar({ workspace }: { workspace: AiWorkspace }) {
	const [prompt, setPrompt] = useState('');
	const [archive, setArchive] = useState('');
	const [optIn, setOptIn] = useState(false);
	const [readyOnly, setReadyOnly] = useState(false);
	const [note, setNote] = useState('');
	const [, redraw] = useState(0);
	const refresh = () => redraw((value) => value + 1);
	const send = () => {
		setNote('');
		void workspace.send(prompt, readyOnly).then(refresh);
	};
	return (
		<div class="nand-browser-ai">
			<input
				class="nand-browser-ai-prompt"
				aria-label={t('browser.ai.prompt')}
				placeholder={t('browser.ai.prompt')}
				value={prompt}
				onInput={(event) => setPrompt(event.currentTarget.value)}
			/>
			<button type="button" onClick={send}>{t('browser.ai.send')}</button>
			<button type="button" onClick={() => { workspace.cancel(); refresh(); }}>{t('browser.ai.cancel')}</button>
			<select
				aria-label={t('browser.ai.profile')}
				value={workspace.profileId}
				onChange={(event) => {
					workspace.profileId = event.currentTarget.value;
					refresh();
				}}
			>
				{workspace.profiles.map((profile) => (
					<option key={profile.id} value={profile.id}>{profile.id}</option>
				))}
			</select>
			<button
				type="button"
				onClick={() => {
					workspace.addProfile(`site-${workspace.profiles.length}`);
					refresh();
				}}
			>
				{t('browser.ai.newProfile')}
			</button>
			<textarea
				aria-label={t('browser.ai.import')}
				value={archive}
				onInput={(event) => setArchive(event.currentTarget.value)}
			/>
			<button
				type="button"
				onClick={() => {
					const result = workspace.importArchive(archive);
					setNote(result.written ? t('browser.ai.imported') : t('browser.ai.rejected'));
					refresh();
				}}
			>
				{t('browser.ai.import')}
			</button>
			<label>
				<input type="checkbox" checked={readyOnly} onChange={(event) => setReadyOnly(event.currentTarget.checked)} />
				{t('browser.ai.readyOnly')}
			</label>
			<label>
				<input type="checkbox" checked={optIn} onChange={(event) => setOptIn(event.currentTarget.checked)} />
				{t('browser.ai.synthesisOptIn')}
			</label>
			<button
				type="button"
				onClick={() => {
					void workspace.synthesize(optIn, prompt).then((result) => {
						setNote(result.status);
						refresh();
					});
				}}
			>
				{t('browser.ai.synthesis')}
			</button>
			<label>
				<input
					type="checkbox"
					checked={workspace.grant.confirmed}
					onChange={(event) => {
						workspace.grant = { ...workspace.grant, confirmed: event.currentTarget.checked };
						refresh();
					}}
				/>
				{t('browser.ai.confirm')}
			</label>
			<ul>
				{workspace.targets.map((target) => (
					<li key={target.id}>
						{target.id} {target.binding} {target.send} {target.capture}
						<button
							type="button"
							onClick={() => {
								workspace.resend(target.id);
								void workspace.send(prompt, readyOnly).then(refresh);
							}}
						>
							{t('browser.ai.resend')}
						</button>
						<button type="button" onClick={() => void workspace.recollect(target.id).then(refresh)}>{t('browser.ai.recollect')}</button>
					</li>
				))}
			</ul>
			{workspace.frozen ? <p>{t('browser.ai.frozen')}: {workspace.frozen.prompt}</p> : null}
			{workspace.comparison.complete.length > 0 ? <p>{t('browser.ai.compare')}: {workspace.comparison.complete.join(', ')}</p> : null}
			{workspace.support.every((site) => !site.verified) ? <p>{t('browser.ai.unverified')}</p> : null}
			{workspace.synthesis ? <p>{workspace.synthesis}</p> : null}
			{note ? <p>{note}</p> : null}
		</div>
	);
}
