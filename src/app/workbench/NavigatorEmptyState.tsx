// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { createRoot } from 'react-dom/client';
import { NotebookTabs } from 'lucide-react';
import { ContainerProviders } from '../../ui/react/providers';
import { useT } from '../../ui/react/hooks';
import { EmptyState } from '../../ui/components/nand/EmptyState';
import { Button } from '../../ui/components/button';

function NavigatorEmptyState({ openSettings }: { openSettings: () => void }) {
	const t = useT();
	return <EmptyState icon={<NotebookTabs />} title={t('modules.navigator')} description={t('modules.navigatorOff')} action={<Button onClick={openSettings}>{t('workbench.enableModule')}</Button>} />;
}

/** Loaded only when a disabled navigator leaf is actually opened. */
export function mountNavigatorEmptyState(parent: HTMLElement, openSettings: () => void): () => void {
	const container = parent.createDiv({ cls: 'nand-ui h-full overflow-auto' });
	const root = createRoot(container);
	root.render(<ContainerProviders container={container}><NavigatorEmptyState openSettings={openSettings} /></ContainerProviders>);
	return () => { root.unmount(); container.remove(); };
}
