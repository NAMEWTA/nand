import { useEffect, useState } from 'preact/hooks';
import type { SkillScan } from '../../../agent/api';
import { homeServices } from '../../services/instances';
import { t } from '../../../../shared/i18n';
import { TextField } from '../../../../ui/primitives/TextField';
import { Button } from '../../../../ui/primitives/Button';

/** No scan on mount or text input. Opening or refreshing the picker is explicit. */
export function SkillNameField({ agentId, value, change }: { agentId: string; value: string; change(this: void, value: string): void }) {
	const [open, setOpen] = useState(false), [refresh, setRefresh] = useState(0), [query, setQuery] = useState('');
	const [scan, setScan] = useState<SkillScan | null>(null), [error, setError] = useState(false);
	const directory = homeServices.skills?.();
	useEffect(() => {
		setScan(null); setError(false);
		if (!open || !directory) return;
		const abort = new AbortController();
		void directory.list(agentId, abort.signal).then(result => { if (!abort.signal.aborted) setScan(result); }).catch(() => { if (!abort.signal.aborted) setError(true); });
		return () => abort.abort();
	}, [open, refresh, agentId, directory]);
	return <div class="nand-ui-stack nand-skill-picker">
		<TextField label={t('home.skills.skillName')} hint={t('home.skills.skillNameHint')} value={value} onInput={change} />
		{!directory?.capability(agentId) && <p class="nand-field-hint">{t('home.skills.plainOnly')}</p>}
		<Button disabled={!directory} onClick={() => setOpen(!open)}>{t(open ? 'home.skills.closePicker' : 'home.skills.choose')}</Button>
		{open && directory && <>
			<TextField label={t('home.skills.filter')} value={query} onInput={setQuery} />
			<Button onClick={() => setRefresh(value => value + 1)}>{t('home.skills.refresh')}</Button>
			{!scan && !error && <p role="status">{t('home.skills.loading')}</p>}
			{error && <p role="alert">{t('home.skills.discoveryFailed')}</p>}
			{!!scan?.unavailable.length && <details><summary>{t('home.skills.discoveryPartial', { count: scan.unavailable.length })}</summary><ul>{scan.unavailable.map(path => <li key={path}>{path}</li>)}</ul></details>}
			{scan?.entries.filter(entry => entry.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(entry => <div class="nand-skills-choice" key={entry.name}>
				<Button onClick={() => { change(entry.name); setOpen(false); }}>{entry.name}</Button>
				<small>{entry.sources.map(source => source.kind === 'remembered' ? t('home.skills.remembered') : source.path).join(' · ')}</small>
			</div>)}
			{scan && !scan.entries.length && <p>{t('home.skills.noneFound')}</p>}
		</>}
	</div>;
}
