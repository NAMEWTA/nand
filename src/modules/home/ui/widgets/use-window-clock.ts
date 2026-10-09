import { useLayoutEffect, useState } from 'preact/hooks';
/** Each timer belongs to the window that owns the mounted panel. */
export function useWindowClock(win: Window, interval = 60_000): Date {
	const [now, setNow] = useState(() => new Date());
	useLayoutEffect(() => {
		const timer = win.setInterval(() => setNow(new Date()), interval);
		return () => win.clearInterval(timer);
	}, [win, interval]);
	return now;
}
