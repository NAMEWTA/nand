import type { TargetedKeyboardEvent } from 'preact';
import { Icon } from './Icon';

export interface SearchFieldProps {
	value: string;
	placeholder: string;
	onInput: (value: string) => void;
	onKeyDown?: (event: TargetedKeyboardEvent<HTMLInputElement>) => void;
	inputRef?: (element: HTMLInputElement | null) => void;
	className?: string;
}

/** Search input with a leading icon; Escape clears it. */
export function SearchField({ value, placeholder, onInput, onKeyDown, inputRef, className }: SearchFieldProps) {
	return (
		<div class={`nand-search${className ? ` ${className}` : ''}`}>
			<Icon name="search" className="nand-search-icon" />
			<input
				class="nand-input"
				type="search"
				value={value}
				placeholder={placeholder}
				aria-label={placeholder}
				ref={inputRef}
				onInput={(event) => onInput(event.currentTarget.value)}
				onKeyDown={(event) => {
					if (event.key === 'Escape' && value) {
						event.preventDefault();
						event.stopPropagation();
						onInput('');
						return;
					}
					onKeyDown?.(event);
				}}
			/>
		</div>
	);
}
