import { useEffect, useMemo, useState } from 'preact/hooks';
import type { App, TAbstractFile } from 'obsidian';
import type { DashboardColumn, PipelineConfig as Config, PipelineSkill } from '../../core/board/types/model';
import { emptyPipeline } from '../../core/pipeline/model';
import { pipelineConfigError, pipelineDestination, pipelineFieldValues, pipelinePath, projectPipeline, withinPipeline } from '../../core/pipeline/rules';
import { pipelineSkillApplies } from '../../core/pipeline/context';
import { PipelineVault, type PipelineMoveResult } from '../../platform/pipeline/vault';
import { PipelineConfig } from './PipelineConfig';
import { PipelineCard, pipelineError } from './PipelineCard';
import type { RenderCallbacks } from '../render-contract';
import { useSkillAgents } from '../skills/SkillTarget';
import { createNoteWithProps } from '../library/library-new-note';
import { t } from '../../../../shared/i18n';
import { Button } from '../../../../ui/primitives/Button';
import { TextField } from '../../../../ui/primitives/TextField';

export function PipelineSection({ app, column, callbacks, signal, win }: { app: App; column: DashboardColumn; callbacks: RenderCallbacks; signal: AbortSignal; win: Window }) {
	const port = useMemo(() => new PipelineVault(app), [app]);
	const [config, setConfig] = useState<Config>(() => column.pipelineConfig ?? emptyPipeline());
	const [searchDraft, setSearchDraft] = useState(config.search);
	const [editing, setEditing] = useState(!column.pipelineConfig), [revision, setRevision] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState('');
	const [saving, setSaving] = useState(false);
	const [limits, setLimits] = useState<Record<string, number>>({}), [partial, setPartial] = useState<{ result: PipelineMoveResult; target: string } | null>(null);
	const [newNote, setNewNote] = useState<{ stageId: string; title: string; template: string } | null>(null);
	const { agents } = useSkillAgents();
	const canRun = (skill: PipelineSkill) => agents.some(agent => agent.id === skill.agentId && agent.enabled);
	const refresh = () => setRevision(value => value + 1);
	useEffect(() => {
		let timer = 0;
		const changed = (file: TAbstractFile, oldPath?: string) => {
			if (!withinPipeline(config.rootFolder, file.path) && !(oldPath && withinPipeline(config.rootFolder, oldPath))) return;
			win.clearTimeout(timer); timer = win.setTimeout(() => { if (!signal.aborted) refresh(); }, 80);
		};
		const vaultRefs = [app.vault.on('create', changed), app.vault.on('delete', changed), app.vault.on('rename', changed)];
		const metadataRef = app.metadataCache.on('changed', file => changed(file));
		return () => { win.clearTimeout(timer); vaultRefs.forEach(ref => app.vault.offref(ref)); app.metadataCache.offref(metadataRef); };
	}, [app, config.rootFolder, signal, win]);
	const notes = useMemo(() => port.scan(config), [port, config, revision]);
	const view = useMemo(() => projectPipeline(config, notes), [config, notes]);
	const persist = async (next: Config) => {
		if (!callbacks.onPipelineConfigChange || signal.aborted) return;
		setSaving(true);
		try {
			await callbacks.onPipelineConfigChange(column.name, next);
			if (!signal.aborted) { setConfig(next); setSearchDraft(next.search); setLimits({}); }
		} finally { if (!signal.aborted) setSaving(false); }
	};
	const saveView = (next: Config) => { setError(''); void persist(next).catch(error => { if (!signal.aborted) setError(pipelineError(error)); }); };
	const move = async (path: string, target: string) => {
		if (busy || signal.aborted) return;
		setBusy(true); setError(''); setPartial(null);
		try {
			const result = await port.move(config, path, target, signal);
			if (signal.aborted) return;
			if (result.status !== 'done') {
				setError(t(result.status === 'partial' ? 'home.pipeline.partial' : 'home.pipeline.refused', { path: result.path, steps: result.completed.map(step => t(`home.pipeline.step.${step}`)).join(', '), error: pipelineError(result.error ?? '') }));
				if (result.status === 'partial' && !result.completed.includes('rename')) setPartial({ result, target });
			}
			refresh();
		} finally { if (!signal.aborted) setBusy(false); }
	};
	const run = (skill: PipelineSkill, stageId: string, path?: string, input?: string) => {
		if (!callbacks.onPipelineSkill || busy || !canRun(skill)) return;
		setBusy(true); setError('');
		void callbacks.onPipelineSkill(column.name, skill.id, stageId, path, input, signal).catch(error => { if (!signal.aborted) setError(pipelineError(error)); }).finally(() => { if (!signal.aborted) setBusy(false); });
	};
	const create = async () => {
		if (!newNote || busy) return;
		setBusy(true); setError('');
		try {
			const stage = config.stages.find(stage => stage.id === newNote.stageId);
			if (!stage) throw new Error('home.pipeline.contextChanged');
			const destination = pipelineDestination(config, `${pipelinePath(config.rootFolder)!}/new.md`, stage), folder = destination.slice(0, destination.lastIndexOf('/'));
			const props = Object.fromEntries(config.filterFields.filter(field => config.filters[field]).map(field => [field, config.filters[field]!]));
			props[config.statusField] = stage.value.trim();
			const file = await createNoteWithProps(app, folder, newNote.title, props, newNote.template);
			if (!signal.aborted) { setNewNote(null); refresh(); callbacks.onOpenNoteInPopover(file); }
		} catch (error) { if (!signal.aborted) setError(pipelineError(error)); }
		finally { if (!signal.aborted) setBusy(false); }
	};
	if (editing) return <PipelineConfig initial={config} save={persist} close={() => setEditing(false)} />;
	return <section class="nand-ui-stack nand-pipeline">
		<div class="nand-ui-toolbar"><Button disabled={busy || saving} onClick={() => setEditing(true)}>{t('home.pipeline.configure')}</Button><Button disabled={busy || saving} onClick={refresh}>{t('home.pipeline.refresh')}</Button></div>
		{pipelineConfigError(config) ? <p role="status">{t(`home.pipeline.configError.${pipelineConfigError(config)}`)}</p> : <>
			<div class="nand-pipeline-filters">
				<TextField disabled={busy || saving} label={t('home.pipeline.search')} value={searchDraft} onInput={setSearchDraft} onKeyDown={event => { if (event.key === 'Enter') saveView({ ...config, search: searchDraft }); }} />
				<Button disabled={busy || saving} onClick={() => saveView({ ...config, search: searchDraft })}>{t('common.save')}</Button>
				<label class="nand-field"><span>{t('home.pipeline.sort')}</span><select disabled={busy || saving} value={config.sortBy} onChange={event => saveView({ ...config, sortBy: event.currentTarget.value as Config['sortBy'] })}>{(['title', 'modified', 'created', 'due'] as const).map(key => <option key={key} value={key}>{t(`home.pipeline.sort.${key}`)}</option>)}</select></label>
				<label class="nand-skills-check"><input type="checkbox" disabled={busy || saving} checked={config.sortDesc} onChange={event => saveView({ ...config, sortDesc: event.currentTarget.checked })} />{t('home.pipeline.descending')}</label>
				{config.filterFields.map(field => <label class="nand-field" key={field}><span>{field}</span><select disabled={busy || saving} value={config.filters[field] ?? ''} onChange={event => saveView({ ...config, filters: { ...config.filters, [field]: event.currentTarget.value } })}><option value="">{t('home.pipeline.all')}</option>{[...new Set(notes.flatMap(note => pipelineFieldValues(note.frontmatter[field])))].sort().map(value => <option key={value} value={value}>{value}</option>)}</select></label>)}
			</div>
			{view.truncated && <p role="status">{t('home.pipeline.truncated', { count: view.total })}</p>}
			{config.skills.length > 0 && !agents.length && <p role="status">{t('quickActions.skillUnavailable')}</p>}
			<div class="nand-pipeline-stages">{view.stages.map(({ stage, total, notes }) => <section key={stage.id} class="nand-pipeline-stage nand-ui-stack" data-pipeline-stage={stage.id} style={{ '--nand-pipeline-width': `${stage.width ?? 280}px` }}
				onDragOver={event => { if (event.dataTransfer?.types.includes('application/x-nand-pipeline-path')) { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'move'; } }}
				onDrop={event => { const path = event.dataTransfer?.getData('application/x-nand-pipeline-path'); if (path) { event.preventDefault(); event.stopPropagation(); void move(path, stage.id); } }}>
				<header class="nand-ui-stack"><strong>{stage.label}</strong><small>{t('home.pipeline.count', { count: total })}</small>
					<label class="nand-field"><span>{t('home.pipeline.width')}</span><input type="number" disabled={busy || saving} min={220} max={640} step={10} defaultValue={stage.width ?? 280} onChange={event => { const width = Math.max(220, Math.min(640, Number(event.currentTarget.value) || 280)); saveView({ ...config, stages: config.stages.map(item => item.id === stage.id ? { ...item, width } : item) }); }} /></label>
					<Button disabled={busy || saving} onClick={() => setNewNote({ stageId: stage.id, title: '', template: config.templatePaths[0] ?? '' })}>{t('home.pipeline.newNote')}</Button>
					{config.skills.filter(skill => skill.scope === 'stage' && pipelineSkillApplies(skill, stage.value)).map(skill => <Button key={skill.id} disabled={busy || !canRun(skill)} onClick={() => run(skill, stage.id)}>{skill.label}</Button>)}
				</header>
				{newNote?.stageId === stage.id && <div class="nand-ui-stack nand-pipeline-new-note"><TextField label={t('home.pipeline.noteTitle')} value={newNote.title} onInput={title => setNewNote(value => value ? { ...value, title } : null)} />
					{config.templatePaths.length > 0 && <label class="nand-field"><span>{t('home.pipeline.template')}</span><select value={newNote.template} onChange={event => setNewNote(value => value ? { ...value, template: event.currentTarget.value } : null)}>{config.templatePaths.map(path => <option key={path} value={path}>{path}</option>)}</select></label>}
					<div class="nand-ui-toolbar"><Button disabled={busy || saving} onClick={() => setNewNote(null)}>{t('common.cancel')}</Button><Button disabled={busy || !newNote.title.trim()} onClick={() => { void create(); }}>{t('home.pipeline.create')}</Button></div>
				</div>}
				{notes.slice(0, limits[stage.id] ?? 50).map(note => <PipelineCard key={note.path} note={note} config={config} port={port} signal={signal} busy={busy || saving} skills={config.skills.filter(skill => skill.scope === 'card' && pipelineSkillApplies(skill, stage.value))} canRun={canRun}
					open={() => { const file = app.vault.getFileByPath(note.path); if (file) callbacks.onOpenNoteInPopover(file); }} move={target => { void move(note.path, target); }} refresh={refresh} run={(skill, input) => run(skill, stage.id, note.path, input)} />)}
				{notes.length > (limits[stage.id] ?? 50) && <Button onClick={() => setLimits(value => ({ ...value, [stage.id]: (value[stage.id] ?? 50) + 50 }))}>{t('home.pipeline.more')}</Button>}
			</section>)}</div>
		</>}
		{error && <p role="alert">{error}</p>}
		{partial && <Button disabled={busy || saving} onClick={() => { void move(partial.result.path, partial.target); }}>{t('home.pipeline.retry')}</Button>}
	</section>;
}
