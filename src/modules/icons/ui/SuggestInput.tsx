import { useId, useMemo, useRef, useState, type ComponentProps } from 'react';
import { prepareFuzzySearch } from 'obsidian';
import { Input } from '../../../ui/components/input';
import { Popover, PopoverAnchor, PopoverContent } from '../../../ui/components/popover';
import { Command, CommandItem, CommandList } from '../../../ui/components/command';

/** Iconic's fuzzy suggestions, presented by the shared React controls. */
export function SuggestInput({
	suggestions,
	value,
	onValueChange,
	onKeyDown,
	onFocus,
	...props
}: Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> & {
	suggestions: readonly string[];
	value: string;
	onValueChange: (value: string) => void;
}) {
	const [open, setOpen] = useState(false),
		[active, setActive] = useState(''),
		input = useRef<HTMLInputElement>(null),
		listId = useId();
	const matches = useMemo(() => {
		const search = prepareFuzzySearch(value);
		return [...new Set(suggestions)]
			.filter((text) => text !== value)
			.flatMap((text) => {
				const result = search(text);
				return result ? [{ text, score: result.score }] : [];
			})
			.sort((a, b) => b.score - a.score || a.text.localeCompare(b.text));
	}, [suggestions, value]);
	const visible = open && matches.length > 0;
	const select = (text: string) => {
		onValueChange(text);
		setOpen(false);
		setActive('');
		input.current?.focus();
	};
	return (
		<Popover open={visible} onOpenChange={setOpen}>
			<PopoverAnchor asChild>
				<Input
					{...props}
					ref={input}
					value={value}
					role="combobox"
					aria-autocomplete="list"
					aria-expanded={visible}
					aria-controls={listId}
					aria-activedescendant={
						visible && active ? `${listId}-${matches.findIndex((item) => item.text === active)}` : undefined
					}
					onFocus={(event) => {
						setOpen(true);
						onFocus?.(event);
					}}
					onChange={(event) => {
						onValueChange(event.target.value);
						setActive('');
						setOpen(true);
					}}
					onKeyDown={(event) => {
						if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
							event.preventDefault();
							setOpen(true);
							const index = matches.findIndex((item) => item.text === active),
								next =
									event.key === 'ArrowDown'
										? (index + 1) % matches.length
										: index <= 0
											? matches.length - 1
											: index - 1;
							setActive(matches[next]?.text ?? '');
						} else if (event.key === 'Enter' && visible && active) {
							event.preventDefault();
							select(active);
						} else if (event.key === 'Escape' && visible) {
							event.preventDefault();
							event.stopPropagation();
							setOpen(false);
						} else onKeyDown?.(event);
					}}
				/>
			</PopoverAnchor>
			<PopoverContent
				align="start"
				className="w-[var(--radix-popover-trigger-width)] min-w-48 p-0"
				onOpenAutoFocus={(event) => event.preventDefault()}
				onCloseAutoFocus={(event) => event.preventDefault()}
				onInteractOutside={(event) => {
					if (event.target === input.current) event.preventDefault();
				}}
			>
				<Command shouldFilter={false} value={active} onValueChange={setActive}>
					<CommandList id={listId}>
						{matches.map(({ text }, index) => (
							<CommandItem
								key={text}
								id={`${listId}-${index}`}
								value={text}
								onMouseDown={(event) => event.preventDefault()}
								onSelect={() => select(text)}
							>
								{text}
							</CommandItem>
						))}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
