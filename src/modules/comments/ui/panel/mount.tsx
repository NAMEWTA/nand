import { createRoot } from 'react-dom/client';
import { ContainerProviders } from '../../../../ui/react/providers';
import type { CommentsEnv } from '../env';
import { CommentsPanel } from './CommentsPanel';
export function mountCommentsPanel(container: HTMLElement, env: CommentsEnv) {
	container.addClass('nand-ui');
	const root = createRoot(container);
	root.render(<ContainerProviders container={container}><CommentsPanel env={env} /></ContainerProviders>);
	return () => { root.unmount(); container.removeClass('nand-ui'); };
}
