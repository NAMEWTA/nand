// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/pm-section.ts, src/pm-board-modal.ts
import { projectStageColor } from './stage-color';
import { ProjectBoard } from './ProjectBoard';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from 'zustand';
import { Star, Archive, Plus, Settings, Trash2, NotebookPen, Layers, Columns3 } from 'lucide-react';
import type { BoardStore } from '../../services/board-store';
import { ProjectStore, type Project } from '../../services/projects';
import { pmField, pmIncome, pmCycleText } from '../../core/pm/fields';
import type { DashboardColumn, PmConfig } from '../../core/board/types';
import { Input } from '../../../../ui/components/input';
import { Textarea } from '../../../../ui/components/textarea';
import { Button } from '../../../../ui/components/button';
import { Label } from '../../../../ui/components/label';
import { ObsidianIcon } from '../../../../ui/components/nand/ObsidianIcon';
import { useT } from '../../../../ui/react/hooks';
import { useVisible } from '../../../../ui/react/contexts';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { IconButton } from '../board/controls';
import { IconChoice } from '../sections/P1Controls';
import { p1Classes as cls } from '../theme/p1-classes';
const fields = [
	['client', 'user'],
	['status', 'clipboard-list'],
	['cycle', 'calendar-range'],
	['keyDate', 'target'],
	['deliverables', 'package'],
	['nextStep', 'footprints'],
] as const;
export function ProjectSection({
	store,
	column,
	actions,
}: {
	store: BoardStore;
	column: DashboardColumn;
	actions?: HTMLElement | null;
}) {
	const visible = useVisible();
	const config = column.pmConfig,
		[editing, setEditing] = useState(false),
		[draft, setDraft] = useState<PmConfig>(config ?? { rootFolder: '.nand/content/NAND/项目', stages: [] }),
		[newName, setNewName] = useState<string | null>(null),
		[selected, setSelected] = useState<string | null>(null),
		[archived, setArchived] = useState(false),
		[stage, setStage] = useState('_all'),
		[error, setError] = useState(''),
		[deleting, setDeleting] = useState<Project | null>(null),
		t = useT();
	const service = useMemo(
		() => new ProjectStore(store.host.app, config ?? { rootFolder: '', stages: [] }),
		[store, config],
	);
	useEffect(() => {
		return visible ? service.connect() : undefined;
	}, [service, visible]);
	const state = useStore(service.state);
	const projects = state.projects
		.filter(
			(p) =>
				(p.fields.archived === true) === archived && (stage === '_all' || pmField(p.fields, 'stage') === stage),
		)
		.sort((a, b) => {
			const pin =
				Number(config?.pinned?.includes(b.path) ?? false) - Number(config?.pinned?.includes(a.path) ?? false);
			if (pin) return pin;
			if (config?.sortMode === 'name') return a.title.localeCompare(b.title);
			if (config?.sortMode === 'milestone')
				return (
					b.body.milestones.filter((t) => t.checked).length / (b.body.milestones.length || 1) -
					a.body.milestones.filter((t) => t.checked).length / (a.body.milestones.length || 1)
				);
			if (config?.sortMode === 'keyDate')
				return pmField(a.fields, 'keyDate').localeCompare(pmField(b.fields, 'keyDate'));
			return (
				(config?.stages.findIndex((s) => s.label === pmField(a.fields, 'stage')) ?? 0) -
				(config?.stages.findIndex((s) => s.label === pmField(b.fields, 'stage')) ?? 0)
			);
		});
	const save = (pmConfig: PmConfig) =>
		store.edit((data) => {
			const col = data.columns.find((c) => c.name === column.name && c.id === column.id);
			if (col) col.pmConfig = pmConfig;
		});
	const act = (fn: () => Promise<unknown>) => {
		setError('');
		void fn().catch((e) => setError(String(e)));
	};
	const project = state.projects.find((p) => p.path === selected);
	const cards = (list: Project[], compact = false) => (
		<div
			className={cls(
				`dashboard-pmsec-list${compact ? ' dashboard-pmsec-list--col dashboard-pmsec-list--compact' : ''}`,
			)}
		>
			{list.map((p) => {
				const done = p.body.milestones.filter((v) => v.checked).length,
					total = p.body.milestones.length;
				return (
					<article
						key={p.path}
						className={cls(`dashboard-pmsec-card${config?.pinned?.includes(p.path) ? ' is-pinned' : ''}`)}
					>
						<div className={cls('dashboard-pmsec-eyebrow')}>
							<span
								className={cls('dashboard-pmsec-badge')}
								style={
									{
										'--pmsec-stage': projectStageColor(config, pmField(p.fields, 'stage')),
									} as CSSProperties
								}
							>
								<span className={cls('dashboard-pmsec-badge-dot')} />
								<span className={cls('dashboard-pmsec-badge-text')}>{pmField(p.fields, 'stage')}</span>
							</span>
						</div>
						<div className={cls('dashboard-pmsec-title-row')}>
							<button
								type="button"
								data-hit-control
								className={cls('dashboard-pmsec-title')}
								onClick={() => setSelected(p.path)}
							>
								{p.title}
							</button>
						</div>
						<div className={cls('dashboard-pmsec-intro')}>{pmField(p.fields, 'intro')}</div>
						{total > 0 && (
							<div className={cls('dashboard-pmsec-progress-row')}>
								<span className={cls('dashboard-pmsec-progress-pct')}>
									{Math.round((done / total) * 100)}%
								</span>
								<div className={cls('dashboard-pmsec-stepper')}>
									{p.body.milestones.map((task, i) => (
										<span
											key={i}
											title={task.text}
											className={cls(`dashboard-pmsec-step${task.checked ? ' is-done' : ''}`)}
										/>
									))}
								</div>
								<span className={cls('dashboard-pmsec-progress-label')}>
									{done}/{total}
								</span>
							</div>
						)}
						{!compact && (
							<>
								<div className={cls('dashboard-pmsec-fields')}>
									{fields.map(([key, icon]) => {
										const value = key === 'cycle' ? pmCycleText(p.fields) : pmField(p.fields, key);
										return value ? (
											<div className={cls('dashboard-pmsec-field')} key={key}>
												<ObsidianIcon
													name={icon}
													className={cls('dashboard-pmsec-field-icon')}
												/>
												<span className={cls('dashboard-pmsec-field-label')}>
													{t(`pm.f.${key}`)}
												</span>
												<span className={cls('dashboard-pmsec-field-value')}>{value}</span>
											</div>
										) : null;
									})}
								</div>
								<div className={cls('dashboard-pmsec-money')}>
									<div className={cls('dashboard-pmsec-money-block')}>
										<span className={cls('dashboard-pmsec-money-label')}>{t('pm.f.income')}</span>
										<span className={cls('dashboard-pmsec-money-value')}>
											{pmIncome(p.fields) > 0
												? `¥${Math.round(pmIncome(p.fields)).toLocaleString()}`
												: 'N/A'}
										</span>
									</div>
									<div
										className={cls(
											'dashboard-pmsec-money-block dashboard-pmsec-money-block--right',
										)}
									>
										<span className={cls('dashboard-pmsec-money-label')}>{t('pm.f.payment')}</span>
										<span
											className={cls(
												'dashboard-pmsec-money-value dashboard-pmsec-money-value--muted',
											)}
										>
											{pmField(p.fields, 'payment') || 'N/A'}
										</span>
									</div>
								</div>
							</>
						)}
						<div className={cls('dashboard-pmsec-foot-actions')}>
							<Button
								variant="ghost"
								size="sm"
								data-hit-control
								className={`${cls('dashboard-pmsec-foot-btn')} h-[30px] px-[10px] font-normal`}
								onClick={() =>
									act(async () => {
										await store.openFile(await service.workNote(p), true);
									})
								}
							>
								<NotebookPen className="size-[13px]" />
								{t('pm.workNoteName')}
							</Button>
							<IconButton
								className={cls('dashboard-pmsec-star')}
								label={t('pm.pin')}
								aria-pressed={config?.pinned?.includes(p.path)}
								onClick={() => {
									if (config)
										act(() =>
											save({
												...config,
												pinned: config.pinned?.includes(p.path)
													? config.pinned.filter((v) => v !== p.path)
													: [...(config.pinned ?? []), p.path],
											}),
										);
								}}
							>
								<Star />
							</IconButton>
						</div>
						<div className={cls('dashboard-pmsec-actions')}>
							<IconButton
								label={t('pm.board.archive')}
								onClick={() => act(() => service.archive(p, !archived))}
							>
								<Archive />
							</IconButton>
							<IconButton label={t('pm.board.delete')} onClick={() => setDeleting(p)}>
								<Trash2 />
							</IconButton>
						</div>
					</article>
				);
			})}
		</div>
	);
	const groupNames = [...new Set(projects.map((p) => (typeof p.fields.group === 'string' ? p.fields.group : '')))];
	return (
		<div className={cls('dashboard-pmsec-content')}>
			{actions &&
				createPortal(
					<>
						<IconButton
							label={t('pm.configure')}
							onClick={() => {
								setDraft(config ?? draft);
								setEditing(true);
							}}
						>
							<Settings />
						</IconButton>
						<IconButton label={t('home.p1.archived')} onClick={() => setArchived(!archived)}>
							<Archive />
						</IconButton>
						<IconButton
							label={t('home.p1.newProject')}
							disabled={!config?.rootFolder}
							onClick={() => setNewName('')}
						>
							<Plus />
						</IconButton>
					</>,
					actions,
				)}
			{!config?.rootFolder ? (
				<div className={cls('dashboard-pmsec-empty')}>
					<div className={cls('dashboard-pipeline-empty-title')}>{t('pm.emptyTitle')}</div>
					<div className={cls('dashboard-pipeline-empty-hint')}>{t('pm.emptyHint')}</div>
					<Button onClick={() => setEditing(true)}>{t('pm.configure')}</Button>
				</div>
			) : (
				<>
					<div className={cls('dashboard-pmsec-toolbar')}>
						<span className={cls('dashboard-pmsec-count')}>
							{t('pm.projectCount', { count: projects.length })}
						</span>
						<IconChoice
							icon="filter"
							label={t('pm.filterAllStages')}
							value={stage}
							options={[
								{ value: '_all', label: t('pm.filterAllStages') },
								...config.stages.map((s) => ({ value: s.label, label: s.label })),
							]}
							onChange={setStage}
						/>
						<IconChoice
							icon="arrow-down-up"
							label={t('home.pipeline.sort')}
							value={config.sortMode ?? 'stage'}
							options={['stage', 'name', 'milestone', 'keyDate'].map((value) => ({
								value,
								label: t(`pm.sort${value[0]!.toUpperCase()}${value.slice(1)}`),
							}))}
							onChange={(value) =>
								act(() =>
									save({
										...config,
										sortMode: value === 'stage' ? undefined : (value as PmConfig['sortMode']),
									}),
								)
							}
						/>
						<IconButton
							className={cls('dashboard-library-view-btn')}
							label={t('pm.groupView')}
							aria-pressed={config.groupView === 'blocks'}
							onClick={() =>
								act(() =>
									save({
										...config,
										groupView: config.groupView === 'blocks' ? undefined : 'blocks',
									}),
								)
							}
						>
							<Layers className="size-4" />
						</IconButton>
						<IconButton
							className={cls('dashboard-library-view-btn')}
							label={t('pm.groupViewKanban')}
							aria-pressed={config.groupView === 'kanban'}
							onClick={() =>
								act(() =>
									save({
										...config,
										groupView: config.groupView === 'kanban' ? undefined : 'kanban',
									}),
								)
							}
						>
							<Columns3 className="size-4" />
						</IconButton>
					</div>
					{config.groupView ? (
						<div
							className={cls(
								config.groupView === 'kanban' ? 'dashboard-pmsec-kanban' : 'dashboard-pmsec-groups',
							)}
						>
							{groupNames.map((name) => (
								<section
									className={cls(
										config.groupView === 'kanban'
											? 'dashboard-pmsec-kcol'
											: 'dashboard-pmsec-group',
									)}
									key={name}
								>
									<h3 className={cls('dashboard-pmsec-grouphead')}>
										{name || t('pm.ungroupedGroup')}
									</h3>
									{cards(
										projects.filter((p) => (p.fields.group ?? '') === name),
										config.groupView === 'kanban',
									)}
								</section>
							))}
						</div>
					) : (
						cards(projects)
					)}
				</>
			)}
			{(error || state.error) && <p role="alert">{error || state.error}</p>}
			{editing && (
				<DashboardDialog
					title={t('pm.configure')}
					onClose={() => setEditing(false)}
					onSave={() =>
						act(async () => {
							await save(draft);
							setEditing(false);
						})
					}
				>
					<Label>
						{t('home.pipeline.root')}
						<Input
							value={draft.rootFolder}
							onChange={(e) => setDraft({ ...draft, rootFolder: e.target.value })}
						/>
					</Label>
					<Label>
						{t('pipeline.cfgStages')}
						<Textarea
							value={draft.stages.map((s) => s.label).join('\n')}
							onChange={(e) =>
								setDraft({
									...draft,
									stages: e.target.value
										.split('\n')
										.filter(Boolean)
										.map((label) => ({ label })),
								})
							}
						/>
					</Label>
					<Label>
						{t('home.pipeline.archiveFolder')}
						<Input
							value={draft.archiveFolder ?? ''}
							onChange={(e) => setDraft({ ...draft, archiveFolder: e.target.value })}
						/>
					</Label>
					<Label>
						{t('home.dashboard.template')}
						<Input
							value={draft.workNoteTemplate ?? ''}
							onChange={(e) => setDraft({ ...draft, workNoteTemplate: e.target.value })}
						/>
					</Label>
					<Label>
						{t('exclude.folders')}
						<Textarea
							value={draft.excludeFolders?.join('\n') ?? ''}
							onChange={(e) =>
								setDraft({ ...draft, excludeFolders: e.target.value.split('\n').filter(Boolean) })
							}
						/>
					</Label>
				</DashboardDialog>
			)}
			{newName !== null && (
				<DashboardDialog
					title={t('home.p1.newProject')}
					onClose={() => setNewName(null)}
					onSave={() => {
						if (newName.trim())
							act(async () => {
								await service.create(newName.trim());
								setNewName(null);
							});
					}}
				>
					<Input
						aria-label={t('home.dashboard.name')}
						value={newName}
						onChange={(e) => setNewName(e.target.value)}
					/>
				</DashboardDialog>
			)}
			{project && (
				<ProjectBoard
					project={project}
					service={service}
					config={config!}
					store={store}
					close={() => setSelected(null)}
				/>
			)}
			{deleting && (
				<DashboardDialog title={t('common.confirmDelete')} onClose={() => setDeleting(null)}>
					<p>{t('common.confirmDeleteMessage')}</p>
					<Button
						variant="destructive"
						onClick={() =>
							act(async () => {
								await service.trash(deleting.path);
								setDeleting(null);
							})
						}
					>
						{t('common.delete')}
					</Button>
				</DashboardDialog>
			)}
		</div>
	);
}
