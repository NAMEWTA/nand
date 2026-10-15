import type { HomeWidgetContext } from '../../api';
import type { HomeHost } from '../../services/home-host';
import { BoardStore } from '../../services/board-store';
import { createRoot } from 'react-dom/client';
import { ContainerProviders } from '../../../../ui/react/providers';
import { ThemeBridge } from '../theme/ThemeBridge';
import { WidgetDeck } from './WidgetDeck';
/** Public providers use the same React widgets and lifetime as board pages. */
export async function renderBuiltinWidget(
	home: HomeHost,
	kind: string,
	element: HTMLElement,
	context: HomeWidgetContext,
): Promise<void> {
	const aliases: Record<string, string> = { 'quick-actions': 'quickActions', 'year-progress': 'yearProgress' };
	const key = aliases[kind] ?? kind,
		id = ['album', 'anniversary', 'countdown'].includes(key) ? `${key}-${context.instanceId}` : key;
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
					<ThemeBridge store={store} layout="side">
						<WidgetDeck store={store} only={id} />
					</ThemeBridge>
				</ContainerProviders>,
			);
	} catch (error) {
		close();
		throw error;
	}
}
