// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/section-type-modal.ts
import { observeBoardAction } from '../board/actions';
import { useState } from 'react';
import { ObsidianIcon } from '../../../../ui/components/nand/ObsidianIcon';
import { useT } from '../../../../ui/react/hooks';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import type { BoardStore } from '../../services/board-store';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { SECTION_TYPES, P0_SECTIONS, P1_SECTIONS, P2_SECTIONS } from './registry';
export function SectionTypePicker({ store }: { store: BoardStore }) {
	const t = useT(),
		[type, setType] = useState('sticky'),
		[name, setName] = useState('');
	return (
		<DashboardDialog
			title={t('home.dashboard.addSection')}
			onClose={() => store.setDialog(null)}
			onSave={() => {
				void observeBoardAction(
					store.sync
						.addColumn(name.trim() || t(`home.dashboard.section.${type}`), type)
						.then(() => store.setDialog(null)),
				);
			}}
		>
			<div className="grid grid-cols-5 gap-2">
				{SECTION_TYPES.map((kind) => (
					<Button
						key={kind}
						disabled={
							!P0_SECTIONS.includes(kind) && !P1_SECTIONS.includes(kind) && !P2_SECTIONS.includes(kind)
						}
						variant={kind === type ? 'secondary' : 'ghost'}
						className="h-16 flex-col gap-1 px-1 text-xs"
						onClick={() => setType(kind)}
					>
						<ObsidianIcon
							name={
								[
									'sticky-note',
									'folder',
									'database',
									'notebook',
									'table',
									'kanban',
									'workflow',
									'sparkles',
									'calendar',
									'rss',
									'image',
									'video',
									'globe',
									'book-open',
									'check-square',
								][SECTION_TYPES.indexOf(kind)]!
							}
							className="size-5"
						/>
						{t(`home.dashboard.section.${kind}`)}
					</Button>
				))}
			</div>
			<Input
				aria-label={t('home.dashboard.name')}
				placeholder={t(`home.dashboard.section.${type}`)}
				value={name}
				onChange={(e) => setName(e.target.value)}
			/>
		</DashboardDialog>
	);
}
