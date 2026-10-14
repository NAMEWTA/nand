import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { ContainerProviders } from '../../../../ui/react/providers';
import { getRenderContext } from '../renderer/render-context';
/** Adapter for the remaining imperative section renderers, with ownership registered in their existing lifetime. */
export function mountRecordPanel(element: HTMLElement, content: ReactNode): void {
	const context = getRenderContext(element);
	context.resources.get(element)?.();
	element.classList.add('nand-ui');
	const root = createRoot(element);
	context.resources.set(element, () => root.unmount());
	root.render(<ContainerProviders container={element}>{content}</ContainerProviders>);
}
