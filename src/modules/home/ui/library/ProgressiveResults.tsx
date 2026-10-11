import { useLayoutEffect, useMemo, useState } from 'preact/hooks';
import { moreGroupItems, progressiveGroup, sectionCandidates } from '../../core/board/progressive-results';
import type { LibraryFileResult } from './library-file-result';
import { t } from '../../../../shared/i18n';

/** Page-local limits survive data refreshes and reset when the query/grouping changes. */
export function useProgressiveResults(results: readonly LibraryFileResult[], scope: string) {
	const [state, setState] = useState({ scope, limits: new Map<string, number>() });
	useLayoutEffect(() => {
		setState(previous => previous.scope === scope ? previous : { scope, limits: new Map<string, number>() });
	}, [scope]);
	const candidates = useMemo(
		() => new Set(sectionCandidates(results).items.map((result) => result.file.path)),
		[results],
	);
	return {
		group: (key: string, items: readonly LibraryFileResult[]) =>
			progressiveGroup(
				items,
				(item) => item.file.path,
				candidates,
				state.scope === scope ? state.limits.get(key) : undefined,
			),
		more: (key: string, available: number) =>
			setState((previous) => {
				const limits = new Map(previous.scope === scope ? previous.limits : []);
				limits.set(key, moreGroupItems(limits.get(key), available));
				return { scope, limits };
			}),
	};
}

export function GroupWindow({
	label,
	shown,
	available,
	total,
	more,
}: {
	label: string;
	shown: number;
	available: number;
	total: number;
	more: () => void;
}) {
	return (
		<div class="nand-ui-stack dashboard-library-group-window">
			<small>{t('library.windowCount', { shown, available, total })}</small>
			{available > 50 && (
				<button
					type="button"
					class="nand-btn"
					aria-label={t('library.moreInGroup', { group: label })}
					aria-disabled={shown >= available}
					onClick={() => {
						if (shown < available) more();
					}}
				>
					{shown < available
						? t('library.showMore', { count: Math.min(50, available - shown) })
						: t('library.allShown')}
				</button>
			)}
		</div>
	);
}
