import { useVisible } from '../../../../ui/react/contexts';
import { useLayoutEffect, useState } from 'react';
/** Native services own their timers; each mounted panel owns its subscriptions. */
export function useService(service: {
	subscribe(listener: () => void): () => void;
	subscribeTick?(listener: () => void): () => void;
}): void {
	const [, update] = useState(0),
		visible = useVisible();
	useLayoutEffect(() => {
		if (!visible) return;
		const refresh = () => update((value) => value + 1);
		const data = service.subscribe(refresh),
			ticks = service.subscribeTick?.(refresh);
		return () => {
			data();
			ticks?.();
		};
	}, [service, visible]);
}
