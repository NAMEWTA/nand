// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), src/notes-config-modal.ts, src/template-modal.ts
import { useState } from 'react';
import type { DashboardColumn, TaskTemplate } from '../../core/board/types/model';
import type { BoardStore } from '../../services/board-store';
import { Input } from '../../../../ui/components/input';
import { Textarea } from '../../../../ui/components/textarea';
import { Label } from '../../../../ui/components/label';
import { Switch } from '../../../../ui/components/switch';
import { Button } from '../../../../ui/components/button';
import { useT } from '../../../../ui/react/hooks';
import { DashboardDialog } from '../dialogs/DashboardDialog';
export function SectionOptions({
	store,
	column,
	onClose,
}: {
	store: BoardStore;
	column: DashboardColumn;
	onClose: () => void;
}) {
	const t = useT(),
		[cover, setCover] = useState(column.showCover !== false),
		[folder, setFolder] = useState(column.libraryConfig?.folders?.[0] ?? ''),
		[templates, setTemplates] = useState(
			(column.libraryConfig?.templatePaths ?? [column.libraryConfig?.templatePath ?? '']).join('\n'),
		),
		[tasks, setTasks] = useState<TaskTemplate[]>(() => structuredClone(store.host.settings.taskTemplates));
	const project = column.sectionType === 'projects' || column.sectionType === 'notes';
	return (
		<DashboardDialog
			title={t('home.dashboard.settings')}
			onClose={onClose}
			onSave={() => {
				void (
					project
						? store.edit((data) => {
								const col = data.columns.find((c) => c.name === column.name);
								if (col) {
									col.showCover = cover ? undefined : false;
									col.libraryConfig = {
										filters: [],
										viewMode: 'grid',
										sortBy: 'modified',
										sortDesc: true,
										...col.libraryConfig,
										folders: folder ? [folder] : [],
										templatePaths: templates
											.split('\n')
											.map((v) => v.trim())
											.filter(Boolean),
									};
								}
							})
						: store.settings((s) => {
								s.taskTemplates = tasks;
							})
				).then(onClose);
			}}
		>
			{project ? (
				<>
					<Label className="flex gap-2">
						<Switch checked={cover} onCheckedChange={setCover} />
						{t('home.dashboard.showCover')}
					</Label>
					<Label>
						{t('home.dashboard.folder')}
						<Input value={folder} onChange={(e) => setFolder(e.target.value)} />
					</Label>
					<Label>
						{t('home.dashboard.template')}
						<Textarea value={templates} onChange={(e) => setTemplates(e.target.value)} />
					</Label>
				</>
			) : (
				<>
					{tasks.map((task, i) => (
						<div key={task.id} className="grid gap-2">
							<Input
								aria-label={t('home.dashboard.name')}
								value={task.name}
								onChange={(e) =>
									setTasks(tasks.map((row, n) => (n === i ? { ...row, name: e.target.value } : row)))
								}
							/>
							<Textarea
								aria-label={t('home.dashboard.tasks')}
								value={task.tasks.join('\n')}
								onChange={(e) =>
									setTasks(
										tasks.map((row, n) =>
											n === i ? { ...row, tasks: e.target.value.split('\n') } : row,
										),
									)
								}
							/>
							<div className="flex gap-2">
								<Button
									variant="outline"
									onClick={() => {
										void store.sync
											.addCard(column.name, {
												title: task.name,
												type: 'task',
												tasks: task.tasks
													.filter(Boolean)
													.map((text) => ({ text, checked: false })),
											})
											.then(onClose);
									}}
								>
									{t('home.dashboard.useTemplate')}
								</Button>
								<Button variant="ghost" onClick={() => setTasks(tasks.filter((_, n) => n !== i))}>
									{t('common.delete')}
								</Button>
							</div>
						</div>
					))}
					<Button
						variant="outline"
						onClick={() => setTasks([...tasks, { id: crypto.randomUUID(), name: '', tasks: [] }])}
					>
						{t('home.dashboard.addTemplate')}
					</Button>
				</>
			)}
		</DashboardDialog>
	);
}
