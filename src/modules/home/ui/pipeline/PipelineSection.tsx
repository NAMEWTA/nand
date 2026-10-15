// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/pipeline-section.ts
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import { Settings, RefreshCw, Plus } from 'lucide-react';
import { IconButton, Choice } from '../board/controls';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { ResizeHandle } from '../board/ResizeHandle';
import { p1Classes } from '../theme/p1-classes';
import { contentFiles } from '../../../../host/obsidian/storage/content-files';
import { useEffect, useMemo, useState } from 'react';
import type { App } from 'obsidian';
import type { DashboardColumn, PipelineConfig as Config, PipelineSkill } from '../../core/board/types/model';
import { emptyPipeline } from '../../core/pipeline/model';
import {
	pipelineConfigError,
	pipelineDestination,
	pipelineFieldValues,
	pipelinePath,
	projectPipeline,
	withinPipeline,
} from '../../core/pipeline/rules';
import { pipelineSkillApplies } from '../../core/pipeline/context';
import { PipelineVault, type PipelineMoveResult } from '../../platform/pipeline/vault';
import { PipelineConfig } from './PipelineConfig';
import { PipelineCard, pipelineError } from './PipelineCard';
import type { RenderCallbacks } from '../render-contract';
import { homeServices } from '../../services/instances';
import { createNoteWithProps } from '../library/library-new-note';
import { t } from '../../../../shared/i18n';
import { Button } from '../../../../ui/components/button';
import { TextField } from '../sections/P1Controls';

export function PipelineSection({
	app,
	column,
	callbacks,
	signal,
	win,
	actions,
}: {
	app: App;
	column: DashboardColumn;
	callbacks: Pick<RenderCallbacks, 'onOpenNoteInPopover' | 'onPipelineConfigChange' | 'onPipelineSkill'>;
	signal: AbortSignal;
	win: Window;
	actions?: HTMLElement | null;
}) {
	const port = useMemo(() => new PipelineVault(app), [app]);
	const [config, setConfig] = useState<Config>(() => column.pipelineConfig ?? emptyPipeline());
	const [editing, setEditing] = useState(false),
		[, setRevision] = useState(0),
		[busy, setBusy] = useState(false),
		[error, setError] = useState('');
	const [saving, setSaving] = useState(false);
	const [limits, setLimits] = useState<Record<string, number>>({}),
		[partial, setPartial] = useState<{ result: PipelineMoveResult; target: string } | null>(null);
	const [newNote, setNewNote] = useState<{ stageId: string; title: string; template: string } | null>(null);
	const agents = homeServices.agents?.() ?? [];
	const canRun = (skill: PipelineSkill) => agents.some((agent) => agent.id === skill.agentId && agent.enabled);
	const refresh = () => setRevision((value) => value + 1);
	useEffect(() => {
		let timer = 0,
			disposed = false;
		const index = () => {
			void contentFiles(app)
				.prepareMetadata()
				.then(() => {
					if (!disposed && !signal.aborted) refresh();
				})
				.catch((error) => {
					if (!disposed) setError(pipelineError(error));
				});
		};
		const changed = (file: { path: string }, oldPath?: string) => {
			if (
				!withinPipeline(config.rootFolder, file.path) &&
				!(oldPath && withinPipeline(config.rootFolder, oldPath))
			)
				return;
			win.clearTimeout(timer);
			timer = win.setTimeout(() => {
				if (!signal.aborted) index();
			}, 80);
		};
		const vaultRefs = [
			app.vault.on('create', changed),
			app.vault.on('delete', changed),
			app.vault.on('rename', changed),
		];
		const metadataRef = app.metadataCache.on('changed', (file) => changed(file));
		const stop = contentFiles(app).subscribe((event) => changed(event, event.oldPath));
		index();
		return () => {
			disposed = true;
			stop();
			win.clearTimeout(timer);
			vaultRefs.forEach((ref) => app.vault.offref(ref));
			app.metadataCache.offref(metadataRef);
		};
	}, [app, config.rootFolder, signal, win]);
	const notes = port.scan(config);
	const view = useMemo(() => projectPipeline(config, notes), [config, notes]);
	const persist = async (next: Config) => {
		if (!callbacks.onPipelineConfigChange || signal.aborted) return;
		setSaving(true);
		try {
			await callbacks.onPipelineConfigChange(column.name, next);
			if (!signal.aborted) {
				setConfig(next);
				setLimits({});
			}
		} finally {
			if (!signal.aborted) setSaving(false);
		}
	};
	const saveView = (next: Config) => {
		setError('');
		void persist(next).catch((error) => {
			if (!signal.aborted) setError(pipelineError(error));
		});
	};
	const move = async (path: string, target: string) => {
		if (busy || signal.aborted) return;
		setBusy(true);
		setError('');
		setPartial(null);
		try {
			const result = await port.move(config, path, target, signal);
			if (signal.aborted) return;
			if (result.status !== 'done') {
				setError(
					t(result.status === 'partial' ? 'home.pipeline.partial' : 'home.pipeline.refused', {
						path: result.path,
						steps: result.completed.map((step) => t(`home.pipeline.step.${step}`)).join(', '),
						error: pipelineError(result.error ?? ''),
					}),
				);
				if (result.status === 'partial' && !result.completed.includes('rename')) setPartial({ result, target });
			}
			refresh();
		} finally {
			if (!signal.aborted) setBusy(false);
		}
	};
	const run = (skill: PipelineSkill, stageId: string, path?: string, input?: string) => {
		if (!callbacks.onPipelineSkill || busy || !canRun(skill)) return;
		setBusy(true);
		setError('');
		void callbacks
			.onPipelineSkill(column.name, skill.id, stageId, path, input, signal)
			.catch((error) => {
				if (!signal.aborted) setError(pipelineError(error));
			})
			.finally(() => {
				if (!signal.aborted) setBusy(false);
			});
	};
	const create = async () => {
		if (!newNote || busy) return;
		setBusy(true);
		setError('');
		try {
			const stage = config.stages.find((stage) => stage.id === newNote.stageId);
			if (!stage) throw new Error('home.pipeline.contextChanged');
			const destination = pipelineDestination(config, `${pipelinePath(config.rootFolder)!}/new.md`, stage),
				folder = destination.slice(0, destination.lastIndexOf('/'));
			const props = Object.fromEntries(
				config.filterFields
					.filter((field) => config.filters[field])
					.map((field) => [field, config.filters[field]!]),
			);
			props[config.statusField] = stage.value.trim();
			const file = await createNoteWithProps(app, folder, newNote.title, props, newNote.template);
			if (!signal.aborted) {
				setNewNote(null);
				refresh();
				await contentFiles(app).open(file.path);
			}
		} catch (error) {
			if (!signal.aborted) setError(pipelineError(error));
		} finally {
			if (!signal.aborted) setBusy(false);
		}
	};

	const dimensions = config.filterFields.length ? config.filterFields : ['platform', 'project'];
	const dim = Object.keys(config.filters).find((key) => dimensions.includes(key)) ?? dimensions[0] ?? 'platform';
	const values = [...new Set(notes.flatMap((note) => pipelineFieldValues(note.frontmatter[dim])))].sort();
	const anyValues = dimensions.some((field) =>
		notes.some((note) => pipelineFieldValues(note.frontmatter[field]).length),
	);
	return (
		<section
			className={p1Classes(
				`dashboard-section-cards min-h-0 flex-1 dashboard-pipeline dashboard-pipeline--${config.boardStyle ?? 'trello'}`,
			)}
		>
			{actions &&
				createPortal(
					<>
						<IconButton
							label={t('home.pipeline.configure')}
							disabled={busy || saving}
							onClick={() => setEditing(true)}
						>
							<Settings />
						</IconButton>
						<IconButton label={t('home.pipeline.refresh')} disabled={busy} onClick={refresh}>
							<RefreshCw />
						</IconButton>
					</>,
					actions,
				)}
			{editing && (
				<DashboardDialog title={t('home.pipeline.configure')} onClose={() => setEditing(false)} wide>
					<PipelineConfig initial={config} save={persist} close={() => setEditing(false)} />
				</DashboardDialog>
			)}
			{pipelineConfigError(config) ? (
				<div className={p1Classes('dashboard-pipeline-empty')}>
					<div className={p1Classes('dashboard-pipeline-empty-title')}>{t('pipeline.emptyTitle')}</div>
					<div className={p1Classes('dashboard-pipeline-empty-hint')}>{t('pipeline.emptyHint')}</div>
					<Button onClick={() => setEditing(true)}>{t('home.pipeline.configure')}</Button>
				</div>
			) : (
				<div className={p1Classes('dashboard-pipeline-wrap')}>
					{anyValues && (
						<aside className={p1Classes('dashboard-pipeline-rail')}>
							<Button
								variant="ghost"
								className={p1Classes(
									`dashboard-pipeline-rail-item is-all${!config.filters[dim] ? ' is-active' : ''}`,
								)}
								onClick={() => saveView({ ...config, filters: { [dim]: '' } })}
							>
								{t('home.pipeline.all')}
							</Button>
							<div className={p1Classes('dashboard-pipeline-rail-dims')}>
								{dimensions.map((field) => (
									<Button
										variant="ghost"
										className={p1Classes(
											`dashboard-pipeline-rail-dim${dim === field ? ' is-active' : ''}`,
										)}
										key={field}
										onClick={() => saveView({ ...config, filters: { [field]: '' } })}
									>
										{field}
									</Button>
								))}
							</div>
							{values.map((value) => (
								<Button
									variant="ghost"
									key={value}
									className={p1Classes(
										`dashboard-pipeline-rail-item dashboard-pipeline-rail-value${config.filters[dim] === value ? ' is-active' : ''}`,
									)}
									onClick={() => saveView({ ...config, filters: { [dim]: value } })}
								>
									<span className={p1Classes('dashboard-pipeline-rail-label')}>{value}</span>
									<span className={p1Classes('dashboard-pipeline-rail-count')}>
										{
											notes.filter((note) =>
												pipelineFieldValues(note.frontmatter[dim]).includes(value),
											).length
										}
									</span>
								</Button>
							))}
						</aside>
					)}
					<div className={p1Classes('dashboard-pipeline-board')}>
						{view.stages.map(({ stage, total, notes }) => (
							<section
								key={stage.id}
								className={p1Classes('dashboard-pipeline-col')}
								data-pipeline-stage={stage.id}
								style={
									{
										width: stage.width ?? 260,
										'--db-pipe-accent': stage.color ?? 'var(--db-accent)',
									} as CSSProperties
								}
								onDragOver={(event) => {
									if (event.dataTransfer.types.includes('application/x-nand-pipeline-path')) {
										event.preventDefault();
										event.stopPropagation();
										event.dataTransfer.dropEffect = 'move';
									}
								}}
								onDrop={(event) => {
									const path = event.dataTransfer.getData('application/x-nand-pipeline-path');
									if (path) {
										event.preventDefault();
										event.stopPropagation();
										void move(path, stage.id);
									}
								}}
							>
								<header className={p1Classes('dashboard-pipeline-col-head')}>
									<span
										className={p1Classes('dashboard-pipeline-col-dot')}
										style={{ background: stage.color ?? 'var(--db-accent)' }}
									/>
									<strong className={p1Classes('dashboard-pipeline-col-title')}>{stage.label}</strong>
									<span className={p1Classes('dashboard-pipeline-col-count')}>{total}</span>
									<div className={p1Classes('dashboard-pipeline-col-spacer')} />
									<div className={p1Classes('dashboard-pipeline-col-actions')}>
										{config.skills
											.filter(
												(skill) =>
													skill.scope === 'stage' && pipelineSkillApplies(skill, stage.value),
											)
											.map((skill) => (
												<Button
													key={skill.id}
													variant="ghost"
													disabled={busy || !canRun(skill)}
													onClick={() => run(skill, stage.id)}
												>
													{skill.label}
												</Button>
											))}
										<IconButton
											label={t('home.pipeline.newNote')}
											className={p1Classes('dashboard-pipeline-col-add')}
											disabled={busy || saving}
											onClick={() =>
												setNewNote({
													stageId: stage.id,
													title: '',
													template: config.templatePaths[0] ?? '',
												})
											}
										>
											<Plus />
										</IconButton>
									</div>
								</header>
								<div className={p1Classes('dashboard-pipeline-cards')}>
									{notes.slice(0, limits[stage.id] ?? 50).map((note) => (
										<PipelineCard
											key={note.path}
											note={note}
											config={config}
											port={port}
											signal={signal}
											busy={busy || saving}
											skills={config.skills.filter(
												(skill) =>
													skill.scope === 'card' && pipelineSkillApplies(skill, stage.value),
											)}
											canRun={canRun}
											open={() => {
												const file = contentFiles(app).getFileByPath(note.path);
												if (file) callbacks.onOpenNoteInPopover(file);
											}}
											move={(target) => {
												void move(note.path, target);
											}}
											refresh={refresh}
											run={(skill, input) => run(skill, stage.id, note.path, input)}
										/>
									))}
									{notes.length > (limits[stage.id] ?? 50) && (
										<Button
											onClick={() =>
												setLimits((value) => ({
													...value,
													[stage.id]: (value[stage.id] ?? 50) + 50,
												}))
											}
										>
											{t('home.pipeline.more')}
										</Button>
									)}
								</div>
								<ResizeHandle
									axis="x"
									value={stage.width ?? 260}
									min={200}
									max={460}
									label={t('home.pipeline.width')}
									className="absolute top-0 right-0 h-full w-2 cursor-col-resize"
									onPreview={() => {}}
									onCommit={(width) =>
										saveView({
											...config,
											stages: config.stages.map((s) => (s.id === stage.id ? { ...s, width } : s)),
										})
									}
								/>
							</section>
						))}
					</div>
				</div>
			)}
			{newNote && (
				<DashboardDialog
					title={t('home.pipeline.newNote')}
					onClose={() => setNewNote(null)}
					onSave={() => {
						void create();
					}}
					busy={busy}
				>
					<TextField
						label={t('home.pipeline.noteTitle')}
						value={newNote.title}
						onInput={(title) => setNewNote({ ...newNote, title })}
					/>
					{config.templatePaths.length > 0 && (
						<Choice
							label={t('home.pipeline.template')}
							value={newNote.template}
							options={config.templatePaths.map((value) => ({ value, label: value }))}
							onChange={(template) => setNewNote({ ...newNote, template })}
						/>
					)}
				</DashboardDialog>
			)}
			{view.truncated && <p role="status">{t('home.pipeline.truncated', { count: view.total })}</p>}
			{error && <p role="alert">{error}</p>}
			{partial && (
				<Button
					disabled={busy || saving}
					onClick={() => {
						void move(partial.result.path, partial.target);
					}}
				>
					{t('home.pipeline.retry')}
				</Button>
			)}
		</section>
	);
}
