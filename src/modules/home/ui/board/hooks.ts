import { useEffect, useState } from 'react';
import { useOwnerDocument, useVisible } from '../../../../ui/react/contexts';
import type { BoardStore } from '../../services/board-store';
export function useImage(store: BoardStore, path: string): string {
	const [result, setResult] = useState({ path: '', url: '' });
	useEffect(() => {
		let active = true;
		if (path)
			void store
				.image(path)
				.then((url) => {
					if (active) setResult({ path, url });
				})
				.catch(() => {
					if (active) setResult({ path, url: '' });
				});
		return () => {
			active = false;
		};
	}, [store, path]);
	return result.path === path ? result.url : '';
}
export function useClock(interval = 60000): number {
	const doc = useOwnerDocument(),
		visible = useVisible();
	const [time, setTime] = useState(Date.now);
	useEffect(() => {
		const win = doc.defaultView;
		if (!win || !visible) return;
		const id = win.setInterval(() => setTime(Date.now()), interval);
		return () => win.clearInterval(id);
	}, [doc, visible, interval]);
	return time;
}
