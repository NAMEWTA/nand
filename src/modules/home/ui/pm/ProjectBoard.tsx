// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/pm-board-modal.ts
import { projectStageColor } from './stage-color';
import { useState, type CSSProperties } from 'react';
import { Trash2, Unlink } from 'lucide-react';
import { contentFiles } from '../../../../host/obsidian/storage/content-files';
import { useT } from '../../../../ui/react/hooks';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import { Label } from '../../../../ui/components/label';
import { Checkbox } from '../../../../ui/components/checkbox';
import { ObsidianIcon } from '../../../../ui/components/nand/ObsidianIcon';
import type { BoardStore } from '../../services/board-store';
import type { Project, ProjectStore } from '../../services/projects';
import type { PmConfig } from '../../core/board/types';
import { pmField, pmIncome, pmCycleText } from '../../core/pm/fields';
import { P1Dialog } from '../dialogs/P1Dialog';
import { Choice, IconButton } from '../board/controls';
import { p1Classes as cls } from '../theme/p1-classes';

export function ProjectBoard({
	project,
	service,
	config,
	close,
	store,
}: {
	project: Project;
	service: ProjectStore;
	config: PmConfig;
	close: () => void;
	store: BoardStore;
}) {
	const t = useT(),
		[error, setError] = useState(''),
		[edit, setEdit] = useState(false),
		[task, setTask] = useState({ milestone: '', todo: '' }),
		[due, setDue] = useState({ kind: '', date: '', time: '' }),
		[query, setQuery] = useState(''),
		[custom, setCustom] = useState({ name: '', value: '' });
	const act = (fn: () => Promise<unknown>) => {
		void fn().catch((e) => setError(String(e)));
	};
	const commit = (section: 'milestone' | 'todo') => {
		if (!task[section].trim()) return;
		act(async () => {
			const marker =
				section === 'todo' && due.kind && due.date
					? ` [${due.kind}:: ${[due.date, due.time].filter(Boolean).join(' ')}]`
					: '';
			await service.addTask(project.path, section, task[section].trim() + marker);
			setTask((s) => ({ ...s, [section]: '' }));
			if (section === 'todo') setDue({ kind: '', date: '', time: '' });
		});
	};
	const checklist = (section: 'milestone' | 'todo') => {
		const rows = project.body[section === 'milestone' ? 'milestones' : 'todos'];
		return (
			<section className={cls(`dashboard-library-config-section dashboard-pmsec-section--${section}`)}>
				<div className={cls('dashboard-pmsec-check-title')}>
					<div className={cls('dashboard-library-config-section-title')}>
						{t(section === 'milestone' ? 'pm.board.milestones' : 'pm.board.todos')}
					</div>
					<span className={cls('dashboard-pmsec-check-count')}>
						{rows.filter((r) => r.checked).length}/{rows.length}
					</span>
				</div>
				<div className={cls('dashboard-pmsec-checklist')}>
					{!rows.length && <div className={cls('dashboard-library-empty')}>—</div>}
					{rows.map((row) => (
						<div className={cls('dashboard-pmsec-check-item')} key={row.line}>
							<Checkbox
								data-hit-control
								className="size-[14px]"
								aria-label={row.text}
								checked={row.checked}
								onCheckedChange={(checked) => act(() => service.toggle(project.path, row, !!checked))}
							/>
							<div className={cls('dashboard-pmsec-check-text')}>{row.text}</div>
							<IconButton
								className={cls(
									'dashboard-pipeline-cfg-icon-btn dashboard-pipeline-cfg-icon-btn--danger',
								)}
								label={t('common.delete')}
								onClick={() => act(() => service.removeTask(project.path, row))}
							>
								<Trash2 className="size-3" />
							</IconButton>
						</div>
					))}
				</div>
				<div className={cls('dashboard-pmsec-add-row')}>
					<Input
						data-hit-control
						className={cls('dashboard-modal-input')}
						placeholder={t(section === 'milestone' ? 'pm.addMilestone' : 'pm.addTodo')}
						aria-label={t(section === 'milestone' ? 'pm.addMilestone' : 'pm.addTodo')}
						value={task[section]}
						onChange={(e) => setTask({ ...task, [section]: e.target.value })}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.nativeEvent.isComposing) commit(section);
						}}
					/>
					{section === 'todo' && (
						<>
							<select
								data-hit-control
								className={cls('dashboard-pmsec-add-kind')}
								aria-label={t('pm.addTodoNone')}
								value={due.kind}
								onChange={(e) => setDue({ ...due, kind: e.target.value })}
							>
								{['', 'due', 'scheduled'].map((v) => (
									<option key={v} value={v}>
										{t(
											v === 'due'
												? 'pm.addTodoDue'
												: v === 'scheduled'
													? 'pm.addTodoScheduled'
													: 'pm.addTodoNone',
										)}
									</option>
								))}
							</select>
							<Input
								data-hit-control
								className={cls('dashboard-modal-input dashboard-pmsec-add-date')}
								type="date"
								aria-label={t('pm.f.keyDate')}
								value={due.date}
								onChange={(e) => setDue({ ...due, date: e.target.value })}
							/>
							<Input
								data-hit-control
								className={cls('dashboard-modal-input dashboard-pmsec-add-time')}
								type="time"
								aria-label={t('pm.addTodoTime')}
								value={due.time}
								onChange={(e) => setDue({ ...due, time: e.target.value })}
							/>
						</>
					)}
					<Button
						variant="ghost"
						data-hit-control
						className={'h-[30px] ' + cls('dashboard-modal-btn')}
						onClick={() => commit(section)}
					>
						{t('common.add')}
					</Button>
				</div>
			</section>
		);
	};
	const total = project.body.milestones.length,
		done = project.body.milestones.filter((r) => r.checked).length;
	const tile = (
		key: string,
		icon: string,
		value: string,
		options: { full?: boolean; big?: boolean; accent?: boolean; sub?: string } = {},
	) =>
		value && (
			<div
				key={key}
				className={cls(
					`dashboard-pmsec-tile${options.full ? ' dashboard-pmsec-tile--full' : ''}${options.accent ? ' dashboard-pmsec-tile--accent' : ''}`,
				)}
			>
				<ObsidianIcon name={icon} className={cls('dashboard-pmsec-tile-icon')} />
				<div className={cls('dashboard-pmsec-tile-body')}>
					<span className={cls('dashboard-pmsec-tile-label')}>
						{key === 'nextStep' ? t('pm.nextUp') : t(`pm.f.${key}`)}
					</span>
					<div
						className={cls(
							`dashboard-pmsec-tile-value${options.big ? ' dashboard-pmsec-tile-value--big' : ''}`,
						)}
					>
						{value}
					</div>
					{options.sub && <div className={cls('dashboard-pmsec-tile-sub')}>{options.sub}</div>}
				</div>
			</div>
		);
	const keyDate = pmField(project.fields, 'keyDate').slice(0, 10),
		days = keyDate
			? Math.round(
					(new Date(keyDate + 'T00:00:00').getTime() - new Date(new Date().toDateString()).getTime()) /
						86400000,
				)
			: NaN;
	const linked = (
		Array.isArray(project.fields.files)
			? project.fields.files
			: typeof project.fields.files === 'string'
				? [project.fields.files]
				: []
	)
		.filter((v): v is string => typeof v === 'string')
		.map((s) => s.replace(/^\[\[|\]\]$/g, ''));
	const files = contentFiles(store.host.app),
		folder = `${config.rootFolder.replace(/\/$/, '')}/${project.title}/`,
		folderFiles = files
			.getFiles()
			.filter(
				(f) =>
					f.path.replace(/^\.nand\/content\//, '').startsWith(folder.replace(/^\.nand\/content\//, '')) &&
					f.path !== project.path,
			);
	const allPaths = [...new Set([...linked, ...folderFiles.map((f) => f.path)])],
		matches = query.trim()
			? files
					.getFiles()
					.filter(
						(f) =>
							!allPaths.includes(f.path) &&
							f.path !== project.path &&
							(f.basename.toLowerCase().includes(query.toLowerCase()) ||
								f.path.toLowerCase().includes(query.toLowerCase())),
					)
					.slice(0, 8)
			: [];
	const link = (path?: string) => {
		const file = path
			? files.getFileByPath(path)
			: (matches[0] ?? files.resolveLink(query.replace(/^\[\[|\]\]$/g, '')));
		if (!file) {
			setError(t('pm.fileMissing'));
			return;
		}
		act(async () => {
			await service.fields(project.path, { files: [...new Set([...linked, file.path])] });
			setQuery('');
		});
	};
	const customs =
		project.fields.custom && typeof project.fields.custom === 'object' && !Array.isArray(project.fields.custom)
			? (project.fields.custom as Record<string, unknown>)
			: {};
	return (
		<P1Dialog
			title={project.title}
			classes="dashboard-modal dashboard-pmsec-board"
			onClose={close}
			width={1280}
			height="min(90vh, 960px)"
			contentHeight="calc(min(90vh, 960px) - 44px)"
		>
			<header className={cls('dashboard-modal-header dashboard-pmsec-hero')}>
				<div className={cls('dashboard-pmsec-hero-row')}>
					<div className={cls('dashboard-modal-title dashboard-pmsec-hero-title')}>{project.title}</div>
					<span
						className={cls('dashboard-pmsec-badge')}
						style={
							{
								'--pmsec-stage': projectStageColor(config, pmField(project.fields, 'stage')),
							} as CSSProperties
						}
					>
						<span className={cls('dashboard-pmsec-badge-dot')} />
						<span className={cls('dashboard-pmsec-badge-text')}>{pmField(project.fields, 'stage')}</span>
					</span>
					{total > 0 && (
						<div className={cls('dashboard-pmsec-hero-progress')}>
							<span className={cls('dashboard-pmsec-progress-pct')}>
								{Math.round((done / total) * 100)}%
							</span>
							<div className={cls('dashboard-pmsec-stepper')}>
								{project.body.milestones.map((r, i) => (
									<span
										key={i}
										title={r.text}
										className={cls(`dashboard-pmsec-step${r.checked ? ' is-done' : ''}`)}
									/>
								))}
							</div>
							<span className={cls('dashboard-pmsec-progress-label')}>
								{done}/{total}
							</span>
						</div>
					)}
				</div>
				<div className={cls('dashboard-pmsec-hero-intro')}>{pmField(project.fields, 'intro')}</div>
			</header>
			<div className={cls('dashboard-modal-body dashboard-pmsec-board-body')}>
				<div className={cls('dashboard-pmsec-pane')}>
					<section
						className={cls(
							`dashboard-library-config-section ${edit ? 'dashboard-pmsec-edit' : 'dashboard-pmsec-ov'}`,
						)}
					>
						<div className={cls('dashboard-pmsec-check-title dashboard-pmsec-ov-head')}>
							<Button
								variant="ghost"
								data-hit-control
								className={'h-[30px] ' + cls('dashboard-modal-btn dashboard-pmsec-ov-edit')}
								onClick={() => setEdit(!edit)}
							>
								{t(edit ? 'pm.doneEditing' : 'pm.editOverview')}
							</Button>
						</div>
						{edit ? (
							<div className="grid gap-3">
								{[
									'intro',
									'client',
									'status',
									'income',
									'keyDate',
									'cycleStart',
									'cycleEnd',
									'nextStep',
									'deliverables',
									'payment',
								].map((key) => (
									<Label key={key}>
										{t(`home.p1.project.${key}`)}
										<Input
											defaultValue={pmField(project.fields, key)}
											onBlur={(e) => {
												if (pmField(project.fields, key) !== e.target.value)
													act(() =>
														service.fields(project.path, {
															[key]: e.target.value || undefined,
														}),
													);
											}}
										/>
									</Label>
								))}
								<Choice
									label={t('home.pipeline.stage')}
									value={pmField(project.fields, 'stage') || '_none'}
									options={[
										{ value: '_none', label: '—' },
										...config.stages.map((s) => ({ value: s.label, label: s.label })),
									]}
									onChange={(stage) =>
										act(() =>
											service.fields(project.path, {
												stage: stage === '_none' ? undefined : stage,
											}),
										)
									}
								/>
								<div className="flex gap-2">
									<Input
										aria-label={t('pm.addField')}
										placeholder={t('pm.addField')}
										value={custom.name}
										onChange={(e) => setCustom({ ...custom, name: e.target.value })}
									/>
									<Input
										aria-label={t('home.dashboard.name')}
										value={custom.value}
										onChange={(e) => setCustom({ ...custom, value: e.target.value })}
									/>
									<Button
										variant="ghost"
										onClick={() => {
											if (custom.name.trim())
												act(() =>
													service.fields(project.path, {
														custom: { ...customs, [custom.name.trim()]: custom.value },
													}),
												);
										}}
									>
										{t('common.add')}
									</Button>
								</div>
							</div>
						) : (
							<div className={cls('dashboard-pmsec-ov-grid')}>
								{tile('nextStep', 'arrow-up-right', pmField(project.fields, 'nextStep'), {
									full: true,
									big: true,
									accent: true,
								})}
								{tile('keyDate', 'target', keyDate, {
									big: true,
									sub: Number.isFinite(days)
										? t(days < 0 ? 'pm.daysOverdue' : 'pm.daysLeft', { n: Math.abs(days) })
										: undefined,
								})}
								{tile('cycle', 'calendar-range', pmCycleText(project.fields))}
								{tile(
									'income',
									'wallet',
									pmIncome(project.fields) > 0
										? `¥${Math.round(pmIncome(project.fields)).toLocaleString()}`
										: '',
									{ big: true, accent: true },
								)}
								{tile('payment', 'receipt', pmField(project.fields, 'payment'))}
								{tile('client', 'user', pmField(project.fields, 'client'))}
								{tile('status', 'clipboard-list', pmField(project.fields, 'status'))}
								{tile('deliverables', 'package', pmField(project.fields, 'deliverables'), {
									full: true,
								})}
								{Object.entries(customs).map(([key, value]) => (
									<div className={cls('dashboard-pmsec-tile dashboard-pmsec-tile--custom')} key={key}>
										<span>{key}</span>
										<span>{String(value)}</span>
										<IconButton
											label={t('common.delete')}
											onClick={() =>
												act(() =>
													service.fields(project.path, {
														custom: Object.fromEntries(
															Object.entries(customs).filter(([k]) => k !== key),
														),
													}),
												)
											}
										>
											<Trash2 />
										</IconButton>
									</div>
								))}
							</div>
						)}
					</section>
					{checklist('milestone')}
				</div>
				<div className={cls('dashboard-pmsec-pane')}>
					{checklist('todo')}
					<section className={cls('dashboard-library-config-section dashboard-pmsec-section--files')}>
						<div className={cls('dashboard-library-config-inline-row')}>
							<div className={cls('dashboard-library-config-section-title')}>{t('pm.board.files')}</div>
							<Button
								variant="ghost"
								data-hit-control
								className={'h-[30px] ' + cls('dashboard-modal-btn')}
								onClick={() =>
									act(async () => {
										await service.workNote(project);
										await service.load();
									})
								}
							>
								{t('pm.board.addWorkNote')}
							</Button>
						</div>
						<div className={cls('dashboard-pmsec-add-row dashboard-pmsec-link-row')}>
							<Input
								data-hit-control
								className={cls('dashboard-modal-input')}
								placeholder={t('pm.linkFilePh')}
								aria-label={t('pm.linkFilePh')}
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && !e.nativeEvent.isComposing) link();
								}}
							/>
							<Button
								variant="ghost"
								data-hit-control
								className={'h-[30px] ' + cls('dashboard-modal-btn')}
								onClick={() => link()}
							>
								{t('pm.linkFile')}
							</Button>
						</div>
						{!!matches.length && (
							<div className={cls('dashboard-pmsec-link-results')}>
								{matches.map((f) => (
									<button
										data-hit-control
										key={f.path}
										className={cls('dashboard-pmsec-link-item')}
										onClick={() => link(f.path)}
									>
										{f.basename}
									</button>
								))}
							</div>
						)}
						<div className={cls('dashboard-pmsec-files')}>
							{!allPaths.length && (
								<div className={cls('dashboard-library-empty')}>{t('pm.board.noFiles')}</div>
							)}
							{allPaths.map((path) => (
								<div key={path} className={cls('dashboard-pmsec-file')}>
									<button
										data-hit-control
										className={cls('dashboard-pmsec-file-name')}
										onClick={() => {
											void store.openFile(path);
										}}
									>
										{files.getFileByPath(path)?.basename ?? path}
									</button>
									{linked.includes(path) && (
										<IconButton
											className={cls('dashboard-pmsec-file-unlink')}
											label={t('pm.unlink')}
											onClick={() =>
												act(() =>
													service.fields(project.path, {
														files: linked.filter((p) => p !== path),
													}),
												)
											}
										>
											<Unlink />
										</IconButton>
									)}
								</div>
							))}
						</div>
					</section>
				</div>
			</div>
			{error && <p role="alert">{error}</p>}
		</P1Dialog>
	);
}
