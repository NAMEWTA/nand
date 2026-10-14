// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/workspace-switcher.ts
import { useState } from 'react';
import { useStore } from 'zustand';
import { Plus } from 'lucide-react';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import { Label } from '../../../../ui/components/label';
import { useT } from '../../../../ui/react/hooks';
import type { BoardStore } from '../../services/board-store';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { Choice, IconButton } from '../board/controls';
export function WorkspaceSwitcher({ store }: { store: BoardStore }) {
	const { settings, path } = useStore(store.state),
		t = useT();
	const [open, setOpen] = useState(false),
		[name, setName] = useState(''),
		[layout, setLayout] = useState<'side' | 'stacked'>('side');
	return (
		<>
			<div className="dashboard-workspace-switcher absolute top-2 left-3 flex gap-1 rounded-full bg-[var(--db-bg-hover)] p-1">
				{settings.workspaces.files.map((file, i) => (
					<Button
						key={file}
						size="xs"
						variant={file === path ? 'secondary' : 'ghost'}
						className="h-5 min-w-5 rounded-full px-1.5 text-[10px]"
						aria-label={settings.workspaces.names[i] || String(i + 1)}
						aria-current={file === path ? 'page' : undefined}
						onClick={() => {
							void store.host.switchWorkspace(file).then(() => store.switch(file));
						}}
					>
						{i + 1}
					</Button>
				))}
				<IconButton
					label={t('workbench.newBoard')}
					className="size-5 rounded-full"
					onClick={() => setOpen(true)}
				>
					<Plus className="size-3" />
				</IconButton>
			</div>
			{open && (
				<DashboardDialog
					title={t('workbench.newBoard')}
					onClose={() => setOpen(false)}
					onSave={() => {
						void store.host
							.createWorkspace(name, layout)
							.then(() => store.switch(store.host.settings.dashboardFile))
							.then(() => setOpen(false));
					}}
				>
					<Label>
						{t('home.dashboard.name')}
						<Input value={name} onChange={(e) => setName(e.target.value)} />
					</Label>
					<Choice
						label={t('home.dashboard.layout')}
						value={layout}
						onChange={(v) => setLayout(v as 'side' | 'stacked')}
						options={['side', 'stacked'].map((value) => ({
							value,
							label: t(value === 'side' ? 'renderer.layoutSide' : 'renderer.layoutStacked'),
						}))}
					/>
				</DashboardDialog>
			)}
		</>
	);
}
