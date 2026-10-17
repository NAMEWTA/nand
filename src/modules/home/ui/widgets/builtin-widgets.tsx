import type { HomeWidgetContext } from '../../api';
import type { HomeHost } from '../../services/home-host';
import { BoardStore } from '../../services/board-store';
import { createRoot } from 'react-dom/client';
import { ContainerProviders } from '../../../../ui/react/providers';
import { ThemeBridge } from '../theme/ThemeBridge';
import { WIDGET_COMPONENTS } from '../canvas/widget-components';
import { ImmersiveWidgetFrame } from './WidgetBackground';
/** Public providers use the same React widgets and lifetime as board pages. */
export async function renderBuiltinWidget(
	home: HomeHost,
	kind: string,
	element: HTMLElement,
	context: HomeWidgetContext,
): Promise<void> {
	const Component = WIDGET_COMPONENTS[kind];
	if (!Component) throw new Error(`Unknown home widget: ${kind}`);
	const store = new BoardStore(home, context.boardPath, () => element.ownerDocument.defaultView ?? context.window),
		root = createRoot(element);
	let closed = false;
	const close = () => {
		if (closed) return;
		closed = true;
		context.signal.removeEventListener('abort', close);
		root.unmount();
		void store.dispose().catch(context.reportError);
	};
	context.register(close);
	context.signal.addEventListener('abort', close, { once: true });
	element.classList.add('nand-ui');
	try {
		await store.init();
		if (!closed && !context.signal.aborted)
			root.render(
				<ContainerProviders container={element}>
					<ThemeBridge store={store} layout="canvas">
						<ImmersiveWidgetFrame store={store} kind={kind}>
							<Component
								store={store}
								entryId={context.instanceId === 'default' ? undefined : context.instanceId}
							/>
						</ImmersiveWidgetFrame>
					</ThemeBridge>
				</ContainerProviders>,
			);
	} catch (error) {
		close();
		throw error;
	}
}
