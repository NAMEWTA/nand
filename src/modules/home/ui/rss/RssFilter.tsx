// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/toolbar-dropdown.ts
import { Inbox, Rss, Circle, Folder } from 'lucide-react';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from '../../../../ui/components/dropdown-menu';
import { RecordButton } from '../dialogs/RecordButton';
import { p2Classes as c } from '../theme/p2-classes';
export function RssFilter({
	value,
	options,
	onChange,
}: {
	value: string;
	options: { value: string; label: string }[];
	onChange: (key: string) => void;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<RecordButton
					variant="ghost"
					className={c('dashboard-library-view-btn dashboard-toolbar-dropdown')}
					aria-label={options.find((o) => o.value === value)?.label ?? options[0]?.label}
				>
					{value === 'all' ? (
						<Inbox />
					) : value === 'unread' ? (
						<Circle />
					) : value.startsWith('feed:') ? (
						<Rss />
					) : (
						<Folder />
					)}
				</RecordButton>
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuRadioGroup value={value} onValueChange={onChange}>
					{options.map((option) => (
						<DropdownMenuRadioItem key={option.value} value={option.value}>
							{option.label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
