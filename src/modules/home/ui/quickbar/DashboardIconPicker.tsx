// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/quick-note-config-modal.ts
import { useState } from 'react';
import { getIconIds, prepareFuzzySearch } from 'obsidian';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import { ObsidianIcon } from '../../../../ui/components/nand/ObsidianIcon';
import { useT } from '../../../../ui/react/hooks';
import { orderedHostIcons } from '../../core/board/icon-catalog';
import { DashboardDialog } from '../dialogs/DashboardDialog';
export function DashboardIconPicker({ value, onChange }: { value: string; onChange(this: void, value: string): void }) {
	const t = useT(),
		[open, setOpen] = useState(false),
		[query, setQuery] = useState('');
	return (
		<>
			<Button variant="outline" size="xs" aria-label={t('quickNote.pickIcon')} onClick={() => setOpen(true)}>
				<ObsidianIcon name={value} />
			</Button>
			{open && (
				<DashboardDialog title={t('quickNote.pickIcon')} onClose={() => setOpen(false)}>
					<Input
						placeholder={t('quickNote.iconPickerPlaceholder')}
						aria-label={t('quickNote.pickIcon')}
						value={query}
						onChange={(e) => setQuery(e.target.value)}
					/>
					<div className="grid max-h-80 grid-cols-8 gap-2 overflow-y-auto">
						{orderedHostIcons(getIconIds())
							.filter((name) => !query.trim() || prepareFuzzySearch(query)(name) !== null)
							.slice(0, 400)
							.map((name) => (
								<Button
									key={name}
									variant="ghost"
									size="icon"
									aria-label={name}
									title={name}
									onClick={() => {
										onChange(name);
										setOpen(false);
									}}
								>
									<ObsidianIcon name={name} />
								</Button>
							))}
					</div>
				</DashboardDialog>
			)}
		</>
	);
}
