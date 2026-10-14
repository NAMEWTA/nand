import { useVisible } from '../../../../ui/react/contexts';
import { useLayoutEffect, useState } from 'react';
/** Each timer belongs to the window that owns the mounted panel. */
export function useWindowClock(win: Window, interval = 60_000): Date {
	const [now, setNow] = useState(() => new Date()),
		visible = useVisible();
	useLayoutEffect(() => {
		if (!visible) return;
		const timer = win.setInterval(() => setNow(new Date()), interval);
		return () => win.clearInterval(timer);
	}, [win, interval, visible]);
	return now;
}
