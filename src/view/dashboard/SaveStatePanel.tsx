import { useLayoutEffect, useState } from 'preact/hooks';
import { h, render } from 'preact';
import { dashboardSaveMessage } from '../../core/dashboard/save-state';
import type { SyncEngine } from '../../platform/obsidian/dashboard/sync';
import { onLanguageChanged, t } from '../../shared/i18n/index';
import { observeDashboardPromise } from './save-feedback';
import { showConfirmDialog } from './ui/confirm-dialog';
import type { App } from 'obsidian';
export function SaveStatePanel({ engine, app, owner }: { engine: SyncEngine; app: App; owner: Document }) {
	const [state, setState] = useState(engine.getSaveState());
	const [, repaint] = useState(0);
	useLayoutEffect(() => engine.onSaveStateUpdate(setState), [engine]);
	useLayoutEffect(() => onLanguageChanged(() => repaint(value => value + 1)), []);
	if (state.status === 'saved' || state.status === 'saving') return null;
	const copy = (text: string) => { const clipboard = owner.defaultView?.navigator.clipboard; if (clipboard) void observeDashboardPromise(clipboard.writeText(text)); };
	const reload = async () => {
		if (await showConfirmDialog(app, {
			title: t('dashboard.sync.reload'),
			message: t('dashboard.sync.reloadConfirm'),
			confirmLabel: t('dashboard.sync.reloadAction'),
			destructive: false,
		})) await engine.reloadFromDisk();
	};
	return <div class="dashboard-save-state" role="status" aria-live="polite" data-save-status={state.status}>
		<p>{dashboardSaveMessage(state)}</p>
		{state.detail && state.status.endsWith('error') && <code>{state.detail}</code>}
		<button type="button" onClick={() => copy(engine.getLocalDraft())}>{t('dashboard.sync.copyDraft')}</button>
		{state.recoveryPath && <button type="button" onClick={() => copy(state.recoveryPath!)}>{t('dashboard.sync.copyPath')}</button>}
		<button type="button" disabled={state.status === 'conflict-pending'} onClick={() => { void observeDashboardPromise(engine.retrySave()); }}>{t('dashboard.sync.retry')}</button>
		<button type="button" disabled={state.status === 'conflict-pending'} onClick={() => { void observeDashboardPromise(reload()); }}>{t('dashboard.sync.reload')}</button>
	</div>;
}
export function mountSaveState(container: HTMLElement, engine: SyncEngine, app: App): () => void {
	const root = container.createDiv({ cls: 'dashboard-save-state-host' });
	render(h(SaveStatePanel, { engine, app, owner: container.ownerDocument }), root);
	return () => { render(null, root); root.remove(); };
}
