import { useState } from 'react';
import { getIconIds } from 'obsidian';
import { Button } from '../button';
import { Popover, PopoverTrigger, PopoverContent } from '../popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from '../command';
import { ObsidianIcon } from './ObsidianIcon';
import { useT } from '../../react/hooks';
export function IconPicker({
	value,
	onChange,
	icons,
	label,
}: {
	value: string;
	onChange: (icon: string) => void;
	icons?: readonly string[];
	label?: string;
}) {
	const t = useT();
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState('');
	const candidates = (icons ?? (open ? getIconIds() : []))
		.filter((name) => name.toLowerCase().includes(search.toLowerCase()))
		.slice(0, 100);
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="outline" aria-label={label ?? t('ui.chooseIcon')}>
					<ObsidianIcon name={value} />
					<span>{value || t('ui.chooseIcon')}</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-72 p-0">
				<Command shouldFilter={false}>
					<CommandInput
						value={search}
						onValueChange={setSearch}
						aria-label={t('ui.chooseIcon')}
						placeholder={t('ui.search')}
					/>
					<CommandList>
						<CommandEmpty>{t('ui.noResults')}</CommandEmpty>
						{candidates.map((name) => (
							<CommandItem
								key={name}
								value={name}
								onSelect={() => {
									onChange(name);
									setOpen(false);
								}}
							>
								<ObsidianIcon name={name} />
								{name}
							</CommandItem>
						))}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
