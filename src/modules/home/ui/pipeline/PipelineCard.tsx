// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/pipeline-section.ts
import { p1Classes } from '../theme/p1-classes';
import { useEffect, useRef, useState } from 'react';
import type { PipelineConfig, PipelineNote, PipelineSkill } from '../../core/pipeline/model';
import { pipelineTasks } from '../../core/pipeline/rules';
import { pipelineDue } from '../../core/pipeline/due';
import { PipelineVault } from '../../platform/pipeline/vault';
import { t } from '../../../../shared/i18n';
import { Button } from '../../../../ui/components/button';
import { CalendarClock, ListChecks, MoreHorizontal, Archive, Sparkles } from 'lucide-react';
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
} from '../../../../ui/components/dropdown-menu';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { TextField } from '../sections/P1Controls';
import { cardSkillInput } from '../skills/context-menu';

export const pipelineError = (error: unknown): string => {
	const message = error instanceof Error ? error.message : String(error);
	return message.startsWith('home.pipeline.') ? t(message) : message;
};

export function PipelineCard({
	note,
	config,
	port,
	signal,
	busy,
	skills,
	canRun,
	open,
	move,
	refresh,
	run,
}: {
	note: PipelineNote;
	config: PipelineConfig;
	port: PipelineVault;
	signal: AbortSignal;
	busy: boolean;
	skills: readonly PipelineSkill[];
	open: () => void;
	move: (target: string) => void;
	refresh: () => void;
	run: (skill: PipelineSkill, input: string) => void;
	canRun: (skill: PipelineSkill) => boolean;
}) {
	const [expanded, setExpanded] = useState(false);
	const skillInput = useRef('');
	const [raw, setRaw] = useState(''),
		[error, setError] = useState(''),
		[pending, setPending] = useState(false);
	const [editingDue, setEditingDue] = useState(false),
		[date, setDate] = useState(''),
		[time, setTime] = useState(''),
		[remind, setRemind] = useState(false);
	useEffect(() => {
		let closed = false;
		void port
			.read(note.path)
			.then((value) => {
				if (!closed && !signal.aborted) setRaw(value.raw);
			})
			.catch((error) => {
				if (!closed && !signal.aborted) setError(pipelineError(error));
			});
		return () => {
			closed = true;
		};
	}, [port, note.path, note.mtime, signal]);
	const tasks = pipelineTasks(raw),
		due = pipelineDue(note.frontmatter.due);
	const mutate = async (operation: () => Promise<void>) => {
		if (pending || signal.aborted) return;
		setPending(true);
		setError('');
		try {
			await operation();
			if (!signal.aborted) {
				setRaw((await port.read(note.path)).raw);
				refresh();
				setEditingDue(false);
			}
		} catch (error) {
			if (!signal.aborted) setError(pipelineError(error));
		} finally {
			if (!signal.aborted) setPending(false);
		}
	};
	return (
		<article
			className={p1Classes('nand-pipeline-card dashboard-pipeline-card group/pipeline relative')}
			data-pipeline-path={note.path}
		>
			<button
				data-hit-control
				type="button"
				className={p1Classes('dashboard-pipeline-card-title block w-full text-left')}
				onClick={open}
				draggable={!busy && !pending}
				onDragStart={(event) => {
					if (event.dataTransfer) {
						event.dataTransfer.effectAllowed = 'move';
						event.dataTransfer.setData('application/x-nand-pipeline-path', note.path);
					}
					event.stopPropagation();
				}}
			>
				{note.title}
			</button>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						data-hit-control
						type="button"
						aria-label={t('home.pipeline.move')}
						className="absolute top-1 right-1 p-1 opacity-0 group-hover/pipeline:opacity-100 focus-visible:opacity-100"
					>
						<MoreHorizontal className="size-3" />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					{config.stages.map((stage) => (
						<DropdownMenuItem key={stage.id} disabled={busy || pending} onSelect={() => move(stage.id)}>
							{t('home.pipeline.move')} · {stage.label}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
			<div className={p1Classes('dashboard-pipeline-card-foot')}>
				<button
					data-hit-control
					type="button"
					className={p1Classes(`dashboard-pipeline-foot-btn${due ? ' is-set' : ''}`)}
					disabled={busy || pending}
					onClick={() => {
						setDate(due?.date ?? '');
						setTime(due?.time ?? '');
						setRemind(note.frontmatter.remind === true);
						setEditingDue(true);
					}}
				>
					<CalendarClock className="size-3" />
					<span>{due ? `${due.date} ${due.time ?? ''}` : t('pipeline.dueSet')}</span>
				</button>
				<button
					data-hit-control
					type="button"
					className={p1Classes('dashboard-pipeline-foot-btn dashboard-pipeline-todo-toggle')}
					aria-expanded={expanded}
					onClick={() => setExpanded(!expanded)}
				>
					<ListChecks className="size-3" />
					<span>
						{tasks.length
							? `${tasks.filter((task) => task.checked).length}/${tasks.length}`
							: t('pipeline.todoEmptyLabel')}
					</span>
				</button>
				<div className={p1Classes('dashboard-pipeline-foot-spacer')} />
				{config.archiveFolder && (
					<button
						data-hit-control
						type="button"
						className={p1Classes('dashboard-pipeline-skill-btn')}
						aria-label={t('home.pipeline.archive')}
						disabled={busy || pending}
						onClick={() => move('archive')}
					>
						<Archive className="size-3" />
					</button>
				)}
				{skills.map((skill) => (
					<button
						data-hit-control
						type="button"
						key={skill.id}
						className={p1Classes('dashboard-pipeline-skill-btn')}
						aria-label={skill.label}
						disabled={busy || pending || !canRun(skill)}
						onPointerDown={(event) => {
							skillInput.current = cardSkillInput(
								event.currentTarget.closest<HTMLElement>('.nand-pipeline-card')!,
							);
							event.preventDefault();
						}}
						onClick={(event) =>
							run(
								skill,
								event.detail
									? skillInput.current
									: cardSkillInput(event.currentTarget.closest<HTMLElement>('.nand-pipeline-card')!),
							)
						}
					>
						<Sparkles className="size-3" />
					</button>
				))}
			</div>
			{expanded && (
				<div className={p1Classes('dashboard-pipeline-tasks')}>
					{tasks.map((task) => (
						<label className="flex items-center gap-1" key={`${task.line}:${task.originalLine}`}>
							<input
								type="checkbox"
								disabled={busy || pending}
								checked={task.checked}
								onChange={(event) => {
									const checked = event.currentTarget.checked;
									void mutate(() => port.toggleTask(config, note.path, task, checked, signal));
								}}
							/>
							<span>{task.text}</span>
						</label>
					))}
				</div>
			)}

			{editingDue && (
				<DashboardDialog title={t('home.pipeline.due')} onClose={() => setEditingDue(false)}>
					<div className="grid gap-2">
						<TextField type="date" label={t('home.pipeline.due')} value={date} onInput={setDate} />
						<TextField type="time" label={t('home.pipeline.time')} value={time} onInput={setTime} />
						<label className={p1Classes('flex items-center gap-1')}>
							<input
								type="checkbox"
								checked={remind}
								onChange={(event) => setRemind(event.currentTarget.checked)}
							/>
							{t('home.pipeline.remind')}
						</label>
						<div className={p1Classes('dashboard-pipeline-card-foot flex gap-2')}>
							<Button disabled={pending} onClick={() => setEditingDue(false)}>
								{t('common.cancel')}
							</Button>
							<Button
								disabled={pending || !date}
								onClick={() => {
									void mutate(() =>
										port.setDue(config, note.path, date + (time ? ` ${time}` : ''), remind, signal),
									);
								}}
							>
								{t('common.save')}
							</Button>
							<Button
								disabled={pending}
								onClick={() => {
									void mutate(() => port.setDue(config, note.path, '', false, signal));
								}}
							>
								{t('home.pipeline.clearDue')}
							</Button>
						</div>
					</div>
				</DashboardDialog>
			)}
			{error && <p role="alert">{error}</p>}
		</article>
	);
}
