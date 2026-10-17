import { useSyncExternalStore } from 'react';
import { EmptyState } from '../../../../ui/components/nand/EmptyState';
import { ObsidianIcon } from '../../../../ui/components/nand/ObsidianIcon';
import { Button } from '../../../../ui/components/button';
import { useT } from '../../../../ui/react/hooks';
import type { NavigatorLists, NavigatorListTarget, NavigatorListsSnapshot } from '../../../navigator/api';
import type { BoardStore } from '../../services/board-store';
import { WidgetHeader } from './WidgetHeader';

const TARGET_ICONS: Record<NavigatorListTarget['kind'], string> = {
	note: 'file-text',
	folder: 'folder',
	tag: 'tag',
	property: 'list-filter',
	search: 'search',
};

const none = () => undefined;

/** The navigator service while its module is active, with its latest lists. */
function useNavigatorLists(store: BoardStore): { lists: NavigatorLists | undefined; snapshot: NavigatorListsSnapshot | undefined } {
	const { navigatorLists: current, watchNavigatorLists } = store.widgets,
		lists = useSyncExternalStore(
			(listener: () => void) => watchNavigatorLists?.(listener) ?? none,
			() => current?.(),
		),
		snapshot = useSyncExternalStore(
			(listener: () => void) => lists?.subscribe(listener) ?? none,
			() => lists?.snapshot(),
		);
	return { lists, snapshot };
}

/**
 * Recent notes or shortcuts of the notes navigator. The lists belong to the navigator; this widget only shows them
 * and asks the navigator to open an entry.
 */
export function NavigatorListWidget({ store, mode }: { store: BoardStore; mode: 'recent' | 'shortcuts' }) {
	const t = useT(),
		{ lists, snapshot } = useNavigatorLists(store),
		title = t(mode === 'recent' ? 'home.widget.nav-recent' : 'home.widget.nav-shortcuts'),
		items: ReadonlyArray<{ key: string; title: string; target: NavigatorListTarget }> = !snapshot
			? []
			: mode === 'recent'
				? snapshot.recent.map((item) => ({
						key: item.path,
						title: item.title,
						target: { kind: 'note', key: item.path },
					}))
				: snapshot.shortcuts.map((item) => ({
						key: `${item.kind}:${item.key}`,
						title: item.title,
						target: { kind: item.kind, key: item.key },
					}));
	return (
		<div className="flex h-full min-h-0 flex-col" data-nav-list={mode}>
			<WidgetHeader icon={mode === 'recent' ? 'history' : 'bookmark'} title={title} />
			{!lists ? (
				<EmptyState className="p-2" title={t('navWidget.unavailable')} description={t('navWidget.unavailableHint')} />
			) : items.length === 0 ? (
				<EmptyState
					className="p-2"
					title={t(mode === 'recent' ? 'navWidget.noRecent' : 'navWidget.noShortcuts')}
					description={t(mode === 'recent' ? 'navWidget.noRecentHint' : 'navWidget.noShortcutsHint')}
				/>
			) : (
				<ul className="m-0 min-h-0 flex-1 list-none overflow-auto p-0">
					{items.map((item) => (
						<li key={item.key}>
							<Button
								variant="ghost"
								title={item.title}
								className="h-8 w-full min-w-0 justify-start gap-1.5 px-1 text-[.75em]"
								onClick={() => lists.open(item.target)}
							>
								<ObsidianIcon name={TARGET_ICONS[item.target.kind]} className="size-3.5" />
								<span className="min-w-0 flex-1 truncate text-left">{item.title}</span>
							</Button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

export const NavigatorRecentWidget = ({ store }: { store: BoardStore }) => (
	<NavigatorListWidget store={store} mode="recent" />
);
export const NavigatorShortcutsWidget = ({ store }: { store: BoardStore }) => (
	<NavigatorListWidget store={store} mode="shortcuts" />
);
