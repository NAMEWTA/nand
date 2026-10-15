import { createRoot } from 'react-dom/client';
import { MessageSquareText } from 'lucide-react';
import { ContainerProviders } from '../../ui/react/providers';
import { useT } from '../../ui/react/hooks';
import { EmptyState } from '../../ui/components/nand/EmptyState';
import { Button } from '../../ui/components/button';

function CommentsEmptyState({ openSettings }: { openSettings: () => void }) {
	const t = useT();
	return <EmptyState icon={<MessageSquareText />} title={t('modules.editor')} description={t('modules.editorOff')} action={<Button onClick={openSettings}>{t('workbench.enableModule')}</Button>} />;
}

/** Loaded only when a disabled comments leaf is actually opened. */
export function mountCommentsEmptyState(parent: HTMLElement, openSettings: () => void): () => void {
	const container = parent.createDiv({ cls: 'nand-ui h-full overflow-auto' });
	const root = createRoot(container);
	root.render(<ContainerProviders container={container}><CommentsEmptyState openSettings={openSettings} /></ContainerProviders>);
	return () => { root.unmount(); container.remove(); };
}
