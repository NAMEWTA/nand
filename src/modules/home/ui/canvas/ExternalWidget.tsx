import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { HomeWidgetKind } from '../../api';
import { WidgetLifetime } from '../../core/board/widget-lifetime';
import type { BoardStore } from '../../services/board-store';
import { useOwnerDocument } from '../../../../ui/react/contexts';
import { useT } from '../../../../ui/react/hooks';
import { widgetContext } from './widget-context';

/** Mounts a widget another module contributes through `HOME_WIDGETS`; its resources end with the tile. */
export function ExternalWidget({
	store,
	kind,
	memberId,
	instanceId,
}: {
	store: BoardStore;
	kind: HomeWidgetKind;
	memberId: string;
	instanceId: string;
}) {
	const ref = useRef<HTMLDivElement>(null),
		doc = useOwnerDocument(),
		path = useStore(store.state, (state) => state.path),
		t = useT(),
		[error, setError] = useState('');
	useEffect(() => {
		const host = ref.current;
		if (!host) return;
		const fail = (reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason));
		const lifetime = new WidgetLifetime(fail);
		const context = widgetContext(store, { memberId, instanceId }, doc, lifetime, fail, path);
		void Promise.resolve()
			.then(() => kind.render(host, context))
			.then((dispose) => {
				if (dispose) lifetime.register(dispose);
			})
			.catch(fail);
		return () => {
			lifetime.dispose();
			host.replaceChildren();
		};
	}, [store, kind, memberId, instanceId, doc, path]);
	return (
		<div className="dashboard-external-widget h-full min-h-0 w-full">
			{error && (
				<p role="alert" className="m-0 p-3 text-xs text-[var(--db-danger)]">
					{t('home.widget.failed', { detail: error })}
				</p>
			)}
			<div ref={ref} className="h-full" />
		</div>
	);
}
