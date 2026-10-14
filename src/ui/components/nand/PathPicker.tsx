import { useState } from 'react';
import { Folder, File, ChevronsUpDown } from 'lucide-react';
import { Button } from '../button';
import { Popover, PopoverTrigger, PopoverContent } from '../popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from '../command';
import { useT } from '../../react/hooks';
export interface PathPickerItem {
	path: string;
	kind: 'file' | 'folder';
}
/** The caller supplies vault entries; this presentation never reads the filesystem. */
export function PathPicker({
	value,
	items,
	onChange,
	kind,
	disabled,
	label,
}: {
	value: string;
	items: readonly PathPickerItem[];
	onChange: (path: string) => void;
	kind?: PathPickerItem['kind'];
	disabled?: boolean;
	label?: string;
}) {
	const t = useT();
	const [open, setOpen] = useState(false);
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					aria-label={label ?? t('ui.choosePath')}
					disabled={disabled}
					className="max-w-full justify-between"
				>
					<span className="truncate">{value || t('ui.choosePath')}</span>
					<ChevronsUpDown />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-80 max-w-[calc(100vw-2rem)] p-0">
				<Command>
					<CommandInput aria-label={label ?? t('ui.choosePath')} placeholder={t('ui.search')} />
					<CommandList>
						<CommandEmpty>{t('ui.noResults')}</CommandEmpty>
						{items
							.filter((item) => !kind || item.kind === kind)
							.map((item) => (
								<CommandItem
									key={item.path}
									value={item.path}
									onSelect={() => {
										onChange(item.path);
										setOpen(false);
									}}
								>
									{item.kind === 'folder' ? <Folder /> : <File />}
									<span className="truncate">{item.path}</span>
								</CommandItem>
							))}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
