// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/automations/AutomationListSearchField.tsx
import { useRef } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '../../../../ui/components/input';
import { useT } from '../../../../ui/react/hooks';
import { IconButton } from '../parts';
export function SearchField({
	query,
	onChange,
	onArrowNavigate,
	onEnter,
}: {
	query: string;
	onChange: (query: string) => void;
	onArrowNavigate: (direction: 'ArrowUp' | 'ArrowDown') => void;
	onEnter: () => void;
}) {
	const t = useT(),
		inputRef = useRef<HTMLInputElement>(null);
	return (
		<div className="relative w-full max-w-xs">
			<Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
			<Input
				ref={inputRef}
				type="text"
				value={query}
				aria-label={t('automation.searchAll')}
				placeholder={t('automation.searchAll')}
				maxLength={2048}
				className="h-8 border-border bg-background pr-8 pl-8 text-xs shadow-none focus-visible:border-ring/70 dark:bg-background"
				onChange={(event) => onChange(event.target.value)}
				onKeyDown={(event) => {
					if (
						event.nativeEvent.isComposing ||
						event.altKey ||
						event.ctrlKey ||
						event.metaKey ||
						event.shiftKey
					)
						return;
					if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
						event.preventDefault();
						onArrowNavigate(event.key);
					}
					if (event.key === 'Enter') {
						event.preventDefault();
						onEnter();
					}
					if (event.key === 'Escape' && query) {
						event.preventDefault();
						event.stopPropagation();
						onChange('');
					}
				}}
			/>
			{query && (
				<div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center">
					<IconButton
						label={t('automation.clearSearch')}
						size="icon-xs"
						onMouseDown={(event) => event.preventDefault()}
						onClick={() => {
							onChange('');
							inputRef.current?.focus();
						}}
					>
						<X className="size-3.5" />
					</IconButton>
				</div>
			)}
		</div>
	);
}
