import type { App } from 'obsidian';
import { useState } from 'preact/hooks';
import { t } from '../../../shared/i18n/index';
import { Button } from '../../../ui/primitives/Button';
import { TextField } from '../../../ui/primitives/TextField';
import { errorText } from '../services/report';
import type { SyncService, SyncSnapshot } from '../services/sync-service';
import { confirmAction } from './dialogs';

export function CloneRepository({ app, service, snapshot, report }: { app: App; service: SyncService; snapshot: SyncSnapshot; report: (error: unknown) => void }) {
	const [source, setSource] = useState('');
	const [target, setTarget] = useState('');
	const result = snapshot.clone;
	const running = result?.state === 'running';
	const busy = !!snapshot.running;
	const clone = async () => {
		const destination = target.trim();
		const url = source.trim();
		if (!(await confirmAction(app, { title: t('sync.cloneTitle'), message: t('sync.cloneConfirm', { path: destination }), action: t('sync.clone') }))) return;
		await service.clone(destination, url);
	};
	return (
		<details class="nand-sync-clone" open={!!result}>
			<summary>{t('sync.cloneTitle')}</summary>
			<div class="nand-sync-clone-form">
				<p class="nand-sync-muted">{t('sync.cloneHelp')}</p>
				<TextField label={t('sync.remoteUrl')} value={source} disabled={busy} onInput={setSource} />
				<TextField label={t('sync.cloneTarget')} value={target} disabled={busy} onInput={setTarget} />
				<div class="nand-sync-actions">
					<Button variant="primary" icon="download" disabled={busy || !source.trim() || !target.trim()} onClick={() => void clone().catch(report)}>{t('sync.clone')}</Button>
					{running && <Button onClick={() => service.cancelClone()}>{t('sync.cloneCancel')}</Button>}
				</div>
				{result && <div role={result.state === 'failed' || result.state === 'refused' ? 'alert' : 'status'}>
					{result.state === 'running' ? <p>{result.progress ? t(`sync.cloneProgress.${result.progress.phase}`, { percent: result.progress.percent }) : t('sync.cloneRunning')}</p> : <>
						<p>{t(`sync.cloneResult.${result.state}`, { path: result.target })}</p>
						{result.error && result.state !== 'cancelled' && <p>{errorText(result.error.kind)}</p>}
						{result.error?.detail && <pre class="nand-sync-detail">{result.error.detail}</pre>}
						{result.recoveryPath && <p>{t('sync.cloneRecovery', { path: result.recoveryPath })}</p>}
					</>}
				</div>}
			</div>
		</details>
	);
}
