import type { HomeWidgetContext } from '../../api';
import { WidgetLifetime } from '../../core/board/widget-lifetime';
import type { BoardStore } from '../../services/board-store';

/** A mount context for provider code (create/configure/render), tied to one lifetime the caller disposes. */
export function widgetContext(
	store: BoardStore,
	ids: { memberId: string; instanceId: string },
	doc: Document,
	lifetime: WidgetLifetime,
	onError: (error: unknown) => void,
	boardPath: string = store.state.getState().path,
): HomeWidgetContext {
	return {
		boardPath,
		memberId: ids.memberId,
		instanceId: ids.instanceId,
		document: doc,
		window: doc.defaultView!,
		signal: lifetime.signal,
		register: lifetime.register,
		reportError: onError,
		openSettings: () => store.host.openSettings(),
	};
}
