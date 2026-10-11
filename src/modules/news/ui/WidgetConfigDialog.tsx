import type { App } from 'obsidian';
import { useEffect, useReducer, useState } from 'preact/hooks';
import type { HomeWidgetContext, HomeWidgetInstance } from '../../home/api';
import type { SettingsHandle } from '../../../shared/settings/store';
import { onLanguageChanged, t } from '../../../shared/i18n';
import { Button } from '../../../ui/primitives/Button';
import { TextField } from '../../../ui/primitives/TextField';
import { openDialog } from '../../../ui/primitives/dialog';
import type { NewsSettings } from '../settings';
import { defaultNewsWidgets, type NewsWidgetConfig, type NewsWidgetMode } from '../core/home-widgets';
import { saveNewsWidget } from '../services/widget-settings';

export function configureNewsWidget(app: App, settings: SettingsHandle<NewsSettings>, mode: NewsWidgetMode, context: Pick<HomeWidgetContext, 'signal' | 'register' | 'instanceId'>, create: boolean): Promise<HomeWidgetInstance | null> {
	if (context.signal.aborted) return Promise.resolve(null);
	const initial: NewsWidgetConfig | undefined = create ? { id: crypto.randomUUID(), mode, name: '', count: 8, showSummary: true, staleMinutes: 60, ...(mode === 'view' ? { viewId: settings.get().views[0]?.id } : {}) }
		: (settings.get().widgets ?? defaultNewsWidgets()).find(item => item.id === context.instanceId && item.mode === mode);
	if (!initial) return Promise.reject(new Error('news.widget.missing'));
	return new Promise(resolve => {
		let result: HomeWidgetInstance | null = null, closed = false;
		function Form({ close }: { close: () => void }) {
			const [draft, setDraft] = useState(initial!);
			const [count, setCount] = useState(String(initial!.count)), [stale, setStale] = useState(String(initial!.staleMinutes));
			const [busy, setBusy] = useState(false), [error, setError] = useState('');
			const [, refresh] = useReducer((value: number) => value + 1, 0);
			useEffect(() => { const off = settings.subscribe(() => refresh(undefined)), language = onLanguageChanged(() => refresh(undefined)); return () => { off(); language(); }; }, []);
			const views = settings.get().views;
			const valid = Number.isInteger(Number(count)) && Number(count) >= 1 && Number(count) <= 50
				&& Number.isInteger(Number(stale)) && Number(stale) >= 15 && Number(stale) <= 1440
				&& (mode !== 'view' || views.some(view => view.id === draft.viewId));
			const save = async () => {
				if (!valid || busy || context.signal.aborted) return;
				setBusy(true); setError('');
				try {
					const value = { ...draft, name: draft.name.trim(), count: Number(count), staleMinutes: Number(stale) };
					await saveNewsWidget(settings, value.id, value);
					if (!closed && !context.signal.aborted) { result = { id: value.id, label: value.name || undefined }; close(); }
				} catch { if (!closed) setError(t('news.widget.saveFailed')); }
				finally { if (!closed) setBusy(false); }
			};
			return <div class="nand-ui-stack nand-news-widget-config">
				<TextField label={t('news.widget.name')} value={draft.name} onInput={name => setDraft({ ...draft, name })} />
				{mode === 'view' && <label class="nand-field"><span class="nand-field-label">{t('news.widget.view')}</span><select class="nand-input" value={draft.viewId ?? ''} onChange={event => setDraft({ ...draft, viewId: event.currentTarget.value })}>
					<option value="">{t('news.widget.chooseView')}</option>{views.map(view => <option key={view.id} value={view.id}>{view.name}</option>)}
				</select></label>}
				<TextField type="number" label={t('news.widget.count')} value={count} onInput={setCount} />
				<TextField type="number" label={t('news.widget.staleMinutes')} value={stale} onInput={setStale} />
				<label class="nand-ui-toolbar"><input type="checkbox" checked={draft.showSummary} onChange={event => setDraft({ ...draft, showSummary: event.currentTarget.checked })} />{t('news.widget.summary')}</label>
				{error && <p role="alert">{error}</p>}
				<div class="nand-dialog-footer"><Button disabled={busy} onClick={close}>{t('common.cancel')}</Button><Button variant="primary" disabled={!valid || busy} onClick={() => { void save(); }}>{t('common.save')}</Button></div>
			</div>;
		}
		const close = openDialog(app, { title: t(`news.widget.${mode}`), className: 'nand-news-widget-dialog', content: close => <Form close={close} />, onClose: () => { closed = true; resolve(result); } });
		context.register(close);
	});
}
