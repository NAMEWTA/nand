import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'preact/hooks';
import { onLanguageChanged, t } from '../../../../shared/i18n';
import { Button } from '../../../../ui/primitives/Button';
import { TextField } from '../../../../ui/primitives/TextField';
import type { AppearancePresets } from '../../services/appearance-presets';

export function AppearancePresetsPanel({ service, applied }: { service: AppearancePresets; applied: () => void }) {
	const [name, setName] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
	const [, refresh] = useReducer(n => n + 1, 0);
	const alive = useRef(true);
	useLayoutEffect(() => () => { alive.current = false; }, []);
	useEffect(() => service.subscribe(() => refresh(undefined)), [service]);
	useEffect(() => onLanguageChanged(() => refresh(undefined)), []);
	const run = async (action: () => Promise<void>, success: string) => {
		if (busy) return;
		setBusy(true); setError(''); setMessage('');
		try { await action(); if (alive.current) setMessage(success); }
		catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : String(failure)); }
		finally { if (alive.current) setBusy(false); }
	};
	const save = () => run(async () => { await service.save(name); if (alive.current) setName(''); }, 'appearancePresets.saved');
	return <section class="nand-ui-stack nand-appearance-presets">
		<h3>{t('appearancePresets.title')}</h3>
		<p class="nand-field-hint">{t('appearancePresets.hint')}</p>
		<TextField label={t('appearancePresets.name')} value={name} onInput={setName} disabled={busy}
			onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void save(); } }} />
		<Button disabled={busy} onClick={() => void save()}>{t('appearancePresets.save')}</Button>
		{service.presets.length === 0 && <p class="nand-field-hint">{t('appearancePresets.empty')}</p>}
		{service.presets.map(preset => <div class="nand-ui-stack nand-appearance-preset" key={preset.id} data-preset-id={preset.id}>
			<strong>{preset.name}</strong>
			{preset.id === service.activeId && <span class="nand-field-hint">{t('appearancePresets.active')}</span>}
			<div class="nand-appearance-actions">
				<Button disabled={busy} onClick={() => void run(() => { const pending = service.apply(preset.id); applied(); return pending; }, 'appearancePresets.applied')}>{t('appearancePresets.apply')}</Button>
				<Button disabled={busy} onClick={() => void run(() => service.remove(preset.id), 'appearancePresets.removed')}>{t('common.delete')}</Button>
			</div>
		</div>)}
		{service.status === 'error' && <div role="alert" class="nand-ui-stack">
			<p>{t('appearancePresets.unsaved')}</p>
			<Button disabled={busy} onClick={() => void run(() => service.retry(), 'appearancePresets.saved')}>{t('appearancePresets.retry')}</Button>
		</div>}
		{error && <p role="alert">{error}</p>}
		{message && !busy && service.status !== 'error' && <p role="status">{t(message)}</p>}
	</section>;
}
