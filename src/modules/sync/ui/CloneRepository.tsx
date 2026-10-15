import type { App } from 'obsidian';
import { useState } from 'react';
import { t } from '../../../shared/i18n/index';
import { Button } from '../../../ui/components/button';
import { Input } from '../../../ui/components/input';
import { Label } from '../../../ui/components/label';
import { Download } from 'lucide-react';
import { errorText } from '../services/report';
import type { SyncService, SyncSnapshot } from '../services/sync-service';
import { confirmAction } from './dialogs';

export function CloneRepository({
	app,
	service,
	snapshot,
	report,
}: {
	app: App;
	service: SyncService;
	snapshot: SyncSnapshot;
	report: (error: unknown) => void;
}) {
	const [source, setSource] = useState('');
	const [target, setTarget] = useState('');
	const result = snapshot.clone;
	const running = result?.state === 'running';
	const busy = !!snapshot.running;
	const clone = async () => {
		const destination = target.trim();
		const url = source.trim();
		if (
			!(await confirmAction(app, {
				title: t('sync.cloneTitle'),
				message: t('sync.cloneConfirm', { path: destination }),
				action: t('sync.clone'),
			}))
		)
			return;
		await service.clone(destination, url);
	};
	return (
		<details className="rounded-lg border border-border p-4" open={!!result}>
			<summary>{t('sync.cloneTitle')}</summary>
			<div className="mt-3 space-y-3">
				<p className="text-sm text-muted-foreground">{t('sync.cloneHelp')}</p>
				<Label className="flex flex-col items-stretch gap-2">
					{t('sync.remoteUrl')}
					<Input value={source} disabled={busy} onChange={(e) => setSource(e.target.value)} />
				</Label>
				<Label className="flex flex-col items-stretch gap-2">
					{t('sync.cloneTarget')}
					<Input value={target} disabled={busy} onChange={(e) => setTarget(e.target.value)} />
				</Label>
				<div className="flex flex-wrap items-center gap-2">
					<Button
						variant="default"
						disabled={busy || !source.trim() || !target.trim()}
						onClick={() => void clone().catch(report)}
					>
						<Download />
						{t('sync.clone')}
					</Button>
					{running && <Button onClick={() => service.cancelClone()}>{t('sync.cloneCancel')}</Button>}
				</div>
				{result && (
					<div role={result.state === 'failed' || result.state === 'refused' ? 'alert' : 'status'}>
						{result.state === 'running' ? (
							<p>
								{result.progress
									? t(`sync.cloneProgress.${result.progress.phase}`, {
											percent: result.progress.percent,
										})
									: t('sync.cloneRunning')}
							</p>
						) : (
							<>
								<p>{t(`sync.cloneResult.${result.state}`, { path: result.target })}</p>
								{result.error && result.state !== 'cancelled' && <p>{errorText(result.error.kind)}</p>}
								{result.error?.detail && (
									<pre className="overflow-auto whitespace-pre-wrap text-xs">
										{result.error.detail}
									</pre>
								)}
								{result.recoveryPath && <p>{t('sync.cloneRecovery', { path: result.recoveryPath })}</p>}
							</>
						)}
					</div>
				)}
			</div>
		</details>
	);
}
