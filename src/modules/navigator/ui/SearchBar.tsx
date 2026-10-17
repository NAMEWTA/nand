// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { Search, Star, X } from 'lucide-react';
import { Button } from '../../../ui/components/button';
import { Input } from '../../../ui/components/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../ui/components/tooltip';
import { cn } from '../../../ui/lib/utils';
import { useT } from '../../../ui/react/hooks';
import { makeShortcut } from '../core/shortcuts';
import { useEnv, useNav, useNavigatorSettings } from './hooks';

/**
 * The list filter field. Enter or Tab hands the keyboard to the list, Shift+Tab to the navigation pane, and Escape
 * closes the search (the query is kept and comes back when the search is opened again).
 */
export function SearchBar() {
	const env = useEnv();
	const { service } = env;
	const t = useT();
	const search = useNav(service, (state) => state.search);
	const nonce = useNav(service, (state) => state.searchFocusNonce);
	const settings = useNavigatorSettings(service);
	const input = useRef<HTMLInputElement>(null);
	// Opening the search (command, button or a saved search) focuses the field.
	useEffect(() => {
		if (nonce > 0) input.current?.focus();
	}, [nonce]);

	const query = search.query.trim();
	const saved = !!query && settings.shortcuts.some((entry) => entry.kind === 'search' && entry.key === query);
	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.nativeEvent.isComposing) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			service.closeSearch();
			service.focusPane('list');
		} else if (event.key === 'Enter' || (event.key === 'Tab' && !event.shiftKey)) {
			event.preventDefault();
			event.stopPropagation();
			service.focusListFromSearch();
		} else if (event.key === 'Tab' && event.shiftKey) {
			event.preventDefault();
			event.stopPropagation();
			service.focusPane('nav');
		}
	};

	return (
		<div role="search" className="flex shrink-0 items-center gap-1 border-b border-sidebar-border px-2 py-1" data-navigator-search>
			<div className="relative min-w-0 flex-1">
				<Search aria-hidden className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
				<Input
					ref={input}
					type="text"
					value={search.query}
					placeholder={t('navigator.searchPlaceholder')}
					aria-label={t('navigator.searchLabel')}
					spellCheck={false}
					autoComplete="off"
					className={cn('h-7 pl-7 text-[13px]', search.query && 'pr-7')}
					onChange={(event) => service.setSearchQuery(event.target.value)}
					onKeyDown={onKeyDown}
				/>
				{search.query && (
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={t('navigator.searchClear')}
						className="absolute right-0.5 top-1/2 size-6 -translate-y-1/2 text-muted-foreground [&_svg]:size-3.5"
						onClick={() => { service.setSearchQuery(''); input.current?.focus(); }}
					>
						<X />
					</Button>
				)}
			</div>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						disabled={!query}
						aria-label={t(saved ? 'navigator.searchUnsave' : 'navigator.searchSave')}
						aria-pressed={saved}
						className="text-muted-foreground [&_svg]:size-4"
						onClick={() => service.toggleShortcut(makeShortcut('search', query))}
					>
						<Star className={cn(saved && 'fill-current text-foreground')} />
					</Button>
				</TooltipTrigger>
				<TooltipContent>{t(saved ? 'navigator.searchUnsave' : 'navigator.searchSave')}</TooltipContent>
			</Tooltip>
		</div>
	);
}
