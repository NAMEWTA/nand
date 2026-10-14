import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SettingsPageRenderer } from '../../contracts/module';
import { SettingsSearchContext, matchesSettingsSearch } from './SearchableSetting';
import { useVisible } from '../../../ui/react/contexts';
/** The only DOM renderer bridge. Each mount owns and releases all legacy subscriptions. */
export function LegacySettings({
	render,
	onResult,
}: {
	render: SettingsPageRenderer;
	onResult?: (matches: number) => void;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const [revision, setRevision] = useState(0);
	const query = useContext(SettingsSearchContext);
	const visible = useVisible();
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el || !visible) return;
		const kept: Array<() => void> = [];
		el.replaceChildren();
		const cleanup = () => {
			try {
				for (const off of kept.splice(0)) {
					try {
						off();
					} catch (error) {
						console.error('[NAND settings cleanup]', error);
					}
				}
			} finally {
				el.replaceChildren();
			}
		};
		try {
			render(el, { refresh: () => setRevision((value) => value + 1), keep: (off) => kept.push(off) });
		} catch (error) {
			cleanup();
			throw error;
		}
		return cleanup;
	}, [render, revision, visible]);
	useEffect(() => {
		const el = ref.current;
		if (!el || !visible) return;
		let count = 0;
		for (const mark of el.querySelectorAll<HTMLElement>('[data-settings-match]'))
			mark.replaceWith(...mark.childNodes);
		el.normalize();
		for (const row of el.querySelectorAll<HTMLElement>('.setting-item')) {
			const title = row.querySelector<HTMLElement>('.setting-item-name');
			const description = row.querySelector<HTMLElement>('.setting-item-description');
			const matched = matchesSettingsSearch(query, {
				title: title?.textContent ?? '',
				description: description?.textContent ?? '',
				keywords: row.dataset.keywords?.split(','),
			});
			row.hidden = !matched;
			if (matched) count++;
			if (matched && query.trim() && title) {
				const text = title.textContent ?? '';
				const start = text.toLocaleLowerCase().indexOf(query.trim().toLocaleLowerCase());
				if (start >= 0 && title.childNodes.length === 1 && title.firstChild?.nodeType === 3) {
					const mark = el.ownerDocument.createElement('mark');
					mark.dataset.settingsMatch = '';
					mark.className = 'rounded-sm bg-accent text-accent-foreground';
					mark.textContent = text.slice(start, start + query.trim().length);
					title.replaceChildren(text.slice(0, start), mark, text.slice(start + query.trim().length));
				}
			}
		}
		onResult?.(count);
	}, [query, revision, render, onResult, visible]);
	return <div ref={ref} className="nand-native dashboard-settings-content [&_[hidden]]:hidden" />;
}
