import { useEffect, useRef, useState } from 'preact/hooks';
import type { PipelineConfig, PipelineNote, PipelineSkill } from '../../core/pipeline/model';
import { pipelineTasks } from '../../core/pipeline/rules';
import { pipelineDue } from '../../core/pipeline/due';
import { PipelineVault } from '../../platform/pipeline/vault';
import { t } from '../../../../shared/i18n';
import { Button } from '../../../../ui/primitives/Button';
import { TextField } from '../../../../ui/primitives/TextField';
import { cardSkillInput } from '../skills/context-menu';

export const pipelineError = (error: unknown): string => {
	const message = error instanceof Error ? error.message : String(error);
	return message.startsWith('home.pipeline.') ? t(message) : message;
};

export function PipelineCard({ note, config, port, signal, busy, skills, canRun, open, move, refresh, run }: {
	note: PipelineNote; config: PipelineConfig; port: PipelineVault; signal: AbortSignal; busy: boolean; skills: readonly PipelineSkill[];
	open: () => void; move: (target: string) => void; refresh: () => void; run: (skill: PipelineSkill, input: string) => void;
	canRun: (skill: PipelineSkill) => boolean;
}) {
	const skillInput = useRef('');
	const [raw, setRaw] = useState(''), [error, setError] = useState(''), [pending, setPending] = useState(false);
	const [editingDue, setEditingDue] = useState(false), [date, setDate] = useState(''), [time, setTime] = useState(''), [remind, setRemind] = useState(false);
	useEffect(() => {
		let closed = false;
		void port.read(note.path).then(value => { if (!closed && !signal.aborted) setRaw(value.raw); }).catch(error => { if (!closed && !signal.aborted) setError(pipelineError(error)); });
		return () => { closed = true; };
	}, [port, note.path, note.mtime, signal]);
	const tasks = pipelineTasks(raw), due = pipelineDue(note.frontmatter.due);
	const mutate = async (operation: () => Promise<void>) => {
		if (pending || signal.aborted) return;
		setPending(true); setError('');
		try { await operation(); if (!signal.aborted) { setRaw((await port.read(note.path)).raw); refresh(); setEditingDue(false); } }
		catch (error) { if (!signal.aborted) setError(pipelineError(error)); }
		finally { if (!signal.aborted) setPending(false); }
	};
	return <article class="nand-pipeline-card nand-ui-stack" data-pipeline-path={note.path}>
		<button type="button" class="nand-btn nand-btn--ghost" onClick={open} draggable={!busy && !pending} onDragStart={event => { if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-nand-pipeline-path', note.path); } event.stopPropagation(); }}>{note.title}</button>
		<small>{note.path}</small>
		{tasks.length > 0 && <details><summary>{t('home.pipeline.checklist', { done: tasks.filter(task => task.checked).length, total: tasks.length })}</summary>
			{tasks.map(task => <label class="nand-skills-check" key={`${task.line}:${task.originalLine}`}><input type="checkbox" disabled={busy || pending} checked={task.checked} onChange={event => { const checked = event.currentTarget.checked; void mutate(() => port.toggleTask(config, note.path, task, checked, signal)); }} /><span>{task.text}</span></label>)}
		</details>}
		{due && <time dateTime={due.date + (due.time ? `T${due.time}` : '')}>{due.date} {due.time}</time>}
		<div class="nand-ui-toolbar">
			<label class="nand-field"><span>{t('home.pipeline.move')}</span><select disabled={busy || pending} value="" onChange={event => { const target = event.currentTarget.value; if (target) move(target); event.currentTarget.value = ''; }}><option value="">—</option>{config.stages.map(stage => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></label>
			{config.archiveFolder && <Button disabled={busy || pending} onClick={() => move('archive')}>{t('home.pipeline.archive')}</Button>}
			<Button disabled={busy || pending} onClick={() => { setDate(due?.date ?? ''); setTime(due?.time ?? ''); setRemind(note.frontmatter.remind === true); setEditingDue(!editingDue); }}>{t('home.pipeline.due')}</Button>
		</div>
		{editingDue && <div class="nand-ui-stack nand-pipeline-due">
			<TextField type="date" label={t('home.pipeline.due')} value={date} onInput={setDate} />
			<TextField type="time" label={t('home.pipeline.time')} value={time} onInput={setTime} />
			<label class="nand-skills-check"><input type="checkbox" checked={remind} onChange={event => setRemind(event.currentTarget.checked)} />{t('home.pipeline.remind')}</label>
			<div class="nand-ui-toolbar"><Button disabled={pending} onClick={() => setEditingDue(false)}>{t('common.cancel')}</Button><Button disabled={pending || !date} onClick={() => { void mutate(() => port.setDue(config, note.path, date + (time ? ` ${time}` : ''), remind, signal)); }}>{t('common.save')}</Button><Button disabled={pending} onClick={() => { void mutate(() => port.setDue(config, note.path, '', false, signal)); }}>{t('home.pipeline.clearDue')}</Button></div>
		</div>}
		{skills.map(skill => <button type="button" class="nand-btn" key={skill.id} disabled={busy || pending || !canRun(skill)} onPointerDown={event => { skillInput.current = cardSkillInput(event.currentTarget.closest<HTMLElement>('.nand-pipeline-card')!); event.preventDefault(); }} onClick={event => run(skill, event.detail ? skillInput.current : cardSkillInput(event.currentTarget.closest<HTMLElement>('.nand-pipeline-card')!))}>{skill.label}</button>)}
		{error && <p role="alert">{error}</p>}
	</article>;
}
