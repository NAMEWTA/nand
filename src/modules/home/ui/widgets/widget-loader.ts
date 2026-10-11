import type { HomeWidgetContext } from '../../api';
import type { HomeHost } from '../../services/home-host';

/** Registering the provider never evaluates all widget views; they load at the first mount. */
export async function mountBuiltinWidget(key: string, host: HTMLElement, context: HomeWidgetContext): Promise<void> {
	const ui = await import('./builtin-widgets');
	if (!context.signal.aborted) ui.renderBuiltinWidget(key, host, context);
}

export async function configureBuiltinWidget(host: HomeHost, key: string, context: HomeWidgetContext, create: boolean) {
	const ui = await import('./widget-configuration');
	return context.signal.aborted ? null : ui.configureBuiltinWidget(host, key, context, create);
}
