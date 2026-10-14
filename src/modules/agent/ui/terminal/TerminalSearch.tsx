import { useState } from 'react';
import { ArrowDown, ArrowUp, CaseSensitive, Regex, X } from 'lucide-react';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../../ui/components/tooltip';
import { useT } from '../../../../ui/react/hooks';
import type { SearchOptions } from './terminal-view';

/** Retains NAND's search options and feedback from the former agent-page buildSearch. */
export function TerminalSearch({
	find,
	close,
}: {
	find: (query: string, direction: 'next' | 'previous', options: SearchOptions) => boolean;
	close: () => void;
}) {
	const t = useT(),
		[query, setQuery] = useState(''),
		[options, setOptions] = useState({ caseSensitive: false, regex: false }),
		[missing, setMissing] = useState(false);
	const search = (direction: 'next' | 'previous', next = options) => {
		try {
			setMissing(!!query && !find(query, direction, next));
		} catch {
			setMissing(!!query);
		}
	};
	return (
		<div
			className="absolute top-2 right-2 z-[var(--layer-popover)] flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-1 rounded-md border bg-popover p-1 shadow-sm"
			onKeyDown={(event) => {
				event.stopPropagation();
				if (event.nativeEvent.isComposing) return;
				if (event.key === 'Escape') {
					event.preventDefault();
					close();
				}
			}}
		>
			<Input
				autoFocus
				className="h-7 min-w-0 flex-1 basis-32 text-xs"
				aria-label={t('agent.search')}
				aria-invalid={missing}
				value={query}
				onKeyDown={(event) => {
					if (event.nativeEvent.isComposing || event.key !== 'Enter') return;
					event.preventDefault();
					search(event.shiftKey ? 'previous' : 'next');
				}}
				onChange={(e) => {
					setQuery(e.target.value);
					setMissing(false);
				}}
			/>
			{(
				[
					{ key: 'caseSensitive', label: 'agent.matchCase', icon: CaseSensitive },
					{ key: 'regex', label: 'agent.regex', icon: Regex },
				] as const
			).map(({ key, label, icon: Icon }) => (
				<Tooltip key={key}>
					<TooltipTrigger asChild>
						<Button
							variant={options[key] ? 'secondary' : 'ghost'}
							size="icon-xs"
							aria-label={t(label)}
							aria-pressed={options[key]}
							onClick={() => {
								const next = { ...options, [key]: !options[key] };
								setOptions(next);
								search('next', next);
							}}
						>
							<Icon className="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>{t(label)}</TooltipContent>
				</Tooltip>
			))}
			{(
				[
					{ direction: 'previous', label: 'agent.searchPrevious', icon: ArrowUp },
					{ direction: 'next', label: 'agent.searchNext', icon: ArrowDown },
				] as const
			).map(({ direction, label, icon: Icon }) => (
				<Tooltip key={direction}>
					<TooltipTrigger asChild>
						<Button variant="ghost" size="icon-xs" aria-label={t(label)} onClick={() => search(direction)}>
							<Icon className="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>{t(label)}</TooltipContent>
				</Tooltip>
			))}
			<Button variant="ghost" size="icon-xs" aria-label={t('agent.close')} onClick={close}>
				<X className="size-3" />
			</Button>
			{missing && (
				<span role="status" className="w-full px-1 text-xs text-destructive">
					{t('agent.searchNoMatch')}
				</span>
			)}
		</div>
	);
}
