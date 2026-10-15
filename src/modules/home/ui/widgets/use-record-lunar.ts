import { useEffect, useState } from 'react';
import { createLunarLookup, type DisplayLunarLookup } from '../../platform/calendar/lunar-lookup';

export function useLunarLookup(enabled: boolean): { lookup?: DisplayLunarLookup; failed: boolean } {
	const [state, setState] = useState<{ lookup?: DisplayLunarLookup; failed: boolean }>({ failed: false });
	useEffect(() => {
		if (!enabled) return;
		let closed = false;
		void createLunarLookup().then(
			(lookup) => {
				if (!closed) setState({ lookup, failed: false });
			},
			() => {
				if (!closed) setState({ failed: true });
			},
		);
		return () => {
			closed = true;
		};
	}, [enabled]);
	return state;
}
