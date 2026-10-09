import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { t } from '../../../../shared/i18n/index';
import { Button } from '../../../../ui/primitives/Button';
import type { NativeUsage } from '../../platform/desktop/server/agent-data-client';
import type { AgentController } from '../../services/controller';
import { UsagePanel } from '../usage/UsagePanel';
import { UsageLine } from './history-view';

function Usage({ controller }: { controller: AgentController }) {
	const [state, setState] = useState(controller.usage.getState());
	const [vault, setVault] = useState<NativeUsage | null>(null);
	useEffect(() => {
		const update = () => setState(controller.usage.getState());
		const off = controller.usage.subscribe(update);
		const release = controller.usage.retain();
		update();
		return () => {
			off();
			release();
		};
	}, [controller]);
	useEffect(() => {
		const abort = new AbortController();
		void controller.history().usage(abort.signal).then(setVault, () => setVault(null));
		return () => abort.abort();
	}, [controller]);
	return (
		<div class="nand-agent-usage">
			<div class="nand-agent-usage-toolbar">
				<Button size="sm" icon="refresh-cw" disabled={state.refreshing} onClick={() => controller.usage.invalidate()}>{t('agent.refresh')}</Button>
			</div>
			<UsagePanel snapshots={state.snapshots} />
			<section class="nand-agent-usage-vault">
				<h3>{t('agent.vaultUsage')}</h3>
				{vault ? <UsageLine usage={vault} /> : <p>{t('agent.usageUnknown')}</p>}
			</section>
		</div>
	);
}

/** Subscription quotas from each CLI's login and this vault's token use. */
export function mountUsage(host: HTMLElement, controller: AgentController): () => void {
	render(<Usage controller={controller} />, host);
	return () => render(null, host);
}
