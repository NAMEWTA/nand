import { useEffect, useState } from 'preact/hooks';
import { t } from '../../../shared/i18n';
import { Button } from '../../../ui/primitives/Button';
import type { BrowserPageTarget } from '../core/control';
import type { BrowserGrab } from '../core/model';
import { browserError } from '../core/text';
import type { BrowserHost } from '../services/page-host';

/** Explicit partial source for a chosen round; no submission or model invocation. */
export function SelectionGuidance({ host, target, grab, saved }: { host: BrowserHost; target: BrowserPageTarget; grab: BrowserGrab; saved: () => void }) {
	const [choices, setChoices] = useState<Array<{ id: string; label: string }>>(), [selected, setSelected] = useState('');
	const [failure, setFailure] = useState<unknown>(), [busy, setBusy] = useState(false);
	useEffect(() => {
		let live = true;
		void host.guidanceChoices?.(target).then(rows => { if (live) setChoices(rows); }, error => { if (live) setFailure(error); });
		return () => { live = false; };
	}, [host, target]);
	return <section class="nand-browser-guidance">
		<p>{t('browser.guidance.partialHelp')}</p>
		{choices?.length ? <><label class="nand-field"><span class="nand-field-label">{t('browser.guidance.round')}</span>
			<select value={selected} disabled={busy} onChange={event => setSelected(event.currentTarget.value)}><option value="">{t('browser.guidance.choose')}</option>
				{choices.map(choice => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
			</select></label>
			<Button disabled={!selected || busy || !grab.text.trim()} onClick={() => { setBusy(true); setFailure(undefined);
				void host.saveGuidance?.(target, grab, selected).then(saved, setFailure).finally(() => setBusy(false));
			}}>{t('browser.guidance.save')}</Button>
		</> : <p>{t(choices ? 'browser.guidance.noRound' : 'browser.workspace.loading')}</p>}
		{failure && <p role="alert">{browserError(failure)}</p>}
	</section>;
}
