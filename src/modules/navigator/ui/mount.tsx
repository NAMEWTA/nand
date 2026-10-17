// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { createRoot } from 'react-dom/client';
import { ContainerProviders } from '../../../ui/react/providers';
import type { NavigatorEnv } from './env';
import { NavigatorContext } from './hooks';
import { NavigatorRoot } from './NavigatorRoot';

/** Render the navigator into a side-panel container; returns the cleanup. */
export function mountNavigator(container: HTMLElement, env: NavigatorEnv): () => void {
	container.addClass('nand-ui');
	const root = createRoot(container);
	root.render(
		<ContainerProviders container={container}>
			<NavigatorContext.Provider value={env}>
				<NavigatorRoot />
			</NavigatorContext.Provider>
		</ContainerProviders>,
	);
	return () => {
		root.unmount();
		container.removeClass('nand-ui');
	};
}
