import { useEffect, useState } from 'preact/hooks';
import type { LunarLookup } from '../../core/anniversaries/lunar-map';
import { createLunarLookup } from '../../platform/calendar/lunar-lookup';

export function useLunarLookup(enabled: boolean): { lookup?: LunarLookup; failed: boolean } {
	const [state, setState] = useState<{ lookup?: LunarLookup; failed: boolean }>({ failed: false });
	useEffect(() => {
		if (!enabled) return;
		let closed = false;
		void createLunarLookup().then(lookup => { if (!closed) setState({ lookup, failed: false }); }, () => { if (!closed) setState({ failed: true }); });
		return () => { closed = true; };
	}, [enabled]);
	return state;
}
