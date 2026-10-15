// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/skill-section.ts, src/skill-detail-modal.ts
import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { Pin, Star, Ellipsis, Sparkles, Copy, FolderOpen, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useOwnerDocument } from '../../../../ui/react/contexts';
import { useT } from '../../../../ui/react/hooks';
import { Button } from '../../../../ui/components/button';
import { RecordButton } from '../dialogs/RecordButton';
import { Textarea } from '../../../../ui/components/textarea';
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from '../../../../ui/components/dropdown-menu';
import type { LibrarySkill, LibrarySource, SkillLibrary } from '../../services/skill-library';
import type { BoardStore } from '../../services/board-store';
import type { SkillsSectionConfig } from '../../core/board/types';
import { skillGroup } from '../../core/skills/groups';
import { skillPrompt, dispatchSkillShortcut } from '../../services/skill-shortcuts';
import { buildSkillContext } from '../../core/skills/context';
import { MarkdownBody } from '../cards/MemoBody';
import { P1Dialog } from '../dialogs/P1Dialog';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { p1Classes as css } from '../theme/p1-classes';
export function sourceBadge(source: LibrarySource): string {
	return source.path.includes('.claude/') ? 'C' : source.path.includes('.codex/') ? 'X' : 'F';
}
function sourceClass(source: LibrarySource): string {
	return sourceBadge(source) === 'C' ? 'claude' : sourceBadge(source) === 'X' ? 'codex' : 'custom';
}

export function SkillCard({
	store,
	entry,
	config,
	pinned,
	pin,
	detail,
	reveal,
	remove,
	assign,
}: {
	store: BoardStore;
	entry: LibrarySkill;
	config: SkillsSectionConfig;
	pinned: boolean;
	pin(this: void): void;
	detail(this: void): void;
	reveal(this: void): void;
	remove(this: void): void;
	assign(this: void, group: string): void;
}) {
	const t = useT(),
		doc = useOwnerDocument(),
		[launch, setLaunch] = useState<string | null>(null);
	const agents = [...new Set(entry.sources.flatMap((source) => source.agents))];
	const copy = () => {
		void doc.defaultView?.navigator.clipboard
			.writeText(entry.sources[0]!.path)
			.then(() => toast(t('skills.copied')))
			.catch(() => toast(t('skills.copyFailed')));
	};
	return (
		<>
			<article
				role="button"
				tabIndex={0}
				data-skill={entry.name}
				draggable={config.groupView === 'kanban'}
				className={css(`dashboard-skillsec-card ${pinned ? 'is-pinned' : ''}`)}
				onDragStart={(event) => {
					event.dataTransfer.effectAllowed = 'move';
					event.dataTransfer.setData('application/x-nand-skill', entry.name);
					event.currentTarget.classList.add('is-dragging');
				}}
				onDragEnd={(event) => event.currentTarget.classList.remove('is-dragging')}
				onClick={(event) => {
					if (!(event.target as Element).closest('button,[role="menuitem"]')) detail();
				}}
				onKeyDown={(event) => {
					if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) {
						event.preventDefault();
						detail();
					}
				}}
			>
				<div className={css('dashboard-skillsec-card-top')}>
					<div className={css('dashboard-skillsec-name-row')}>
						{pinned && (
							<span className={css('dashboard-skillsec-pin')}>
								<Pin />
							</span>
						)}
						<span className={css('dashboard-skillsec-name')}>{entry.name}</span>
					</div>
					<div className={css('dashboard-skillsec-badges')}>
						{entry.sources.map((source) => (
							<span
								key={`${source.kind}:${source.path}`}
								title={source.path}
								className={css(`dashboard-skillsec-badge is-${sourceClass(source)}`)}
							>
								{sourceBadge(source)}
							</span>
						))}
						{!!entry.sources[0]?.mtime && (
							<span className={css('dashboard-skillsec-date')}>
								{new Date(entry.sources[0].mtime).toLocaleDateString('sv-SE')}
							</span>
						)}
					</div>
				</div>
				{entry.description && <div className={css('dashboard-skillsec-desc')}>{entry.description}</div>}
				<div className={css('dashboard-skillsec-actions')}>
					{agents.map((agent) => (
						<RecordButton
							key={agent}
							variant="ghost"
							className={`${css('dashboard-skillsec-launch')} h-[var(--input-height)] has-[>svg]:px-[5px]`}
							aria-label={t('skills.launch', { agent })}
							onClick={() => setLaunch(agent)}
						>
							<Sparkles className="size-[11px]" />
							<span className={css('dashboard-skillsec-launch-label')}>
								{agent === 'claude-code'
									? 'Claude'
									: (store.widgets
											.skills?.()
											?.targets()
											.find((target) => target.id === agent)?.title ?? agent)}
							</span>
						</RecordButton>
					))}
					<RecordButton
						variant="ghost"
						className={`${css(`dashboard-skillsec-star ${pinned ? 'is-active' : ''}`)} has-[>svg]:px-0`}
						aria-label={t(pinned ? 'skills.unpin' : 'skills.pin')}
						aria-pressed={pinned}
						onClick={pin}
					>
						<Star className="size-[14px]" />
					</RecordButton>
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<RecordButton
							variant="ghost"
							className={css('dashboard-skillsec-menu')}
							aria-label={t('skills.cardMenu')}
						>
							<Ellipsis className="size-[16px]" />
						</RecordButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent>
						<DropdownMenuItem onSelect={detail}>{t('skills.detail')}</DropdownMenuItem>
						<DropdownMenuItem onSelect={copy}>{t('skills.copyPath')}</DropdownMenuItem>
						<DropdownMenuItem onSelect={reveal}>{t('skills.reveal')}</DropdownMenuItem>
						{entry.sources.length === 1 && (
							<DropdownMenuItem onSelect={remove}>{t('skills.remove')}</DropdownMenuItem>
						)}
						<DropdownMenuSeparator />
						{[{ id: '_none', name: t('home.p1.ungrouped') }, ...(config.groups ?? [])].map((group) => (
							<DropdownMenuItem
								key={group.id}
								aria-current={skillGroup(entry.name, config) === group.id}
								onSelect={() => assign(group.id)}
							>
								{group.name}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</article>
			{launch && <SkillLaunch store={store} name={entry.name} agent={launch} close={() => setLaunch(null)} />}
		</>
	);
}
function SkillLaunch({
	store,
	name,
	agent,
	close,
}: {
	store: BoardStore;
	name: string;
	agent: string;
	close(this: void): void;
}) {
	const t = useT(),
		[prompt, setPrompt] = useState(() =>
			skillPrompt(
				{
					id: name,
					label: name,
					icon: 'sparkles',
					agentId: agent,
					skillName: name,
					promptTemplate: '',
					directSend: false,
					destination: { kind: 'fresh', cwd: '' },
				},
				{},
			),
		),
		[busy, setBusy] = useState(false),
		abort = useRef<AbortController | null>(null);
	useEffect(() => () => abort.current?.abort(), []);
	return (
		<DashboardDialog
			title={t('skills.launch', { agent })}
			busy={busy}
			onClose={close}
			onSave={() => {
				if (busy) return;
				const controller = new AbortController();
				abort.current = controller;
				setBusy(true);
				void dispatchSkillShortcut(
					{
						id: name,
						label: name,
						icon: 'sparkles',
						agentId: agent,
						skillName: name,
						promptTemplate: '',
						directSend: false,
						destination: { kind: 'fresh', cwd: '' },
					},
					buildSkillContext({
						source: { kind: 'widget', path: store.state.getState().path, id: name },
						title: name,
						input: '',
					}),
					{
						dispatch: store.widgets.acquireDispatch ?? (async () => undefined),
						preview: async (_skill, _context, draft) => ({ ...draft, finalPrompt: prompt }),
						notify: (message) => toast(message),
						signal: controller.signal,
					},
				)
					.then((receipt) => {
						if (receipt && ['started', 'pasted'].includes(receipt.delivery)) close();
					})
					.finally(() => {
						if (!controller.signal.aborted) setBusy(false);
					});
			}}
		>
			<Textarea
				aria-label={t('home.dashboard.prompt')}
				value={prompt}
				onChange={(event) => setPrompt(event.target.value)}
			/>
		</DashboardDialog>
	);
}
export function SkillDetail({
	store,
	entry: initial,
	service,
	close,
	pinned,
	pin,
	focusDelete = false,
}: {
	store: BoardStore;
	entry: LibrarySkill;
	service: SkillLibrary;
	pinned: boolean;
	pin(this: void): void;
	focusDelete?: boolean;
	close(this: void): void;
}) {
	const entry =
		useStore(service.state, (state) => state.entries.find((item) => item.name === initial.name)) ?? initial;
	const t = useT(),
		doc = useOwnerDocument(),
		[remove, setRemove] = useState<LibrarySource | null>(focusDelete ? (entry.sources[0] ?? null) : null),
		[error, setError] = useState('');
	const run = (task: Promise<unknown>) => {
		void task.catch((e) => setError(String(e)));
	};
	return (
		<P1Dialog
			title={entry.name}
			onClose={close}
			width={562}
			classes="dashboard-modal dashboard-modal--compact dashboard-skillsec-detail"
		>
			<div className={css('dashboard-modal-header dashboard-skillsec-detail-header')}>
				<div className={css('dashboard-skillsec-detail-title-row')}>
					<div className={css('dashboard-modal-title')}>{entry.name}</div>
					<div className={css('dashboard-skillsec-badges')}>
						{entry.sources.map((source) => (
							<span
								key={`${source.kind}:${source.path}`}
								className={css(`dashboard-skillsec-badge is-${sourceClass(source)}`)}
								title={source.path}
							>
								{sourceBadge(source)}
							</span>
						))}
					</div>
				</div>
				<RecordButton
					variant="ghost"
					className={css(`dashboard-skillsec-detail-pin ${pinned ? 'is-pinned' : ''}`)}
					onClick={pin}
					aria-label={t(pinned ? 'skills.unpin' : 'skills.pin')}
				>
					<Pin className="size-[14px]" />
				</RecordButton>
			</div>
			<div className={css('dashboard-modal-body dashboard-skillsec-detail-body')}>
				{entry.description && <div className={css('dashboard-skillsec-detail-desc')}>{entry.description}</div>}
				<div className={css('dashboard-library-config-section')}>
					<div className={css('dashboard-library-config-section-title')}>{t('skills.detailInstances')}</div>
					{entry.sources.map((source) => (
						<div key={`${source.kind}:${source.path}`} className={css('dashboard-skillsec-instance')}>
							<span className={css(`dashboard-skillsec-badge is-${sourceClass(source)}`)}>
								{sourceBadge(source)}
							</span>
							<div className={css('dashboard-skillsec-instance-main')}>
								<div className={css('dashboard-skillsec-instance-path')}>{source.path}</div>
								<div className={css('dashboard-skillsec-instance-date')}>
									{t('skills.detailModified', {
										date: source.mtime
											? new Date(source.mtime).toLocaleString('sv-SE').slice(0, 16)
											: '—',
									})}
								</div>
							</div>
							<div className={css('dashboard-skillsec-instance-actions')}>
								<RecordButton
									variant="ghost"
									className={css('dashboard-skillsec-instance-btn')}
									aria-label={t('skills.reveal')}
									onClick={() => run(service.reveal(source))}
								>
									<FolderOpen className="size-[13px]" />
								</RecordButton>
								<RecordButton
									variant="ghost"
									className={css('dashboard-skillsec-instance-btn')}
									aria-label={t('skills.copyPath')}
									onClick={() => run(doc.defaultView!.navigator.clipboard.writeText(source.path))}
								>
									<Copy className="size-[13px]" />
								</RecordButton>
								<RecordButton
									variant="ghost"
									className={css(
										'dashboard-skillsec-instance-btn dashboard-skillsec-instance-delete',
									)}
									aria-label={t('skills.remove')}
									onClick={() => setRemove(source)}
								>
									<Trash2 className="size-[13px]" />
								</RecordButton>
							</div>
						</div>
					))}
				</div>
				{error && <p role="alert">{error}</p>}
				<div className={css('dashboard-library-config-section')}>
					<div className={css('dashboard-library-config-section-title')}>SKILL.md</div>
					<MarkdownBody
						className={`${css('dashboard-skillsec-detail-doc')} nand-native`}
						store={store}
						text={entry.sources.find((source) => source.text)?.text ?? t('skills.docReadFailed')}
					/>
				</div>
			</div>
			{remove && (
				<DashboardDialog title={t('skills.remove')} onClose={() => setRemove(null)}>
					<p>
						{t('skills.removeConfirmMsg', {
							name: entry.name,
							store: sourceBadge(remove),
							path: remove.path,
						})}
					</p>
					<Button
						variant="destructive"
						onClick={() =>
							run(
								service.remove(entry, remove).then(() => {
									setRemove(null);
									if (entry.sources.length === 1) close();
								}),
							)
						}
					>
						{t('common.delete')}
					</Button>
				</DashboardDialog>
			)}
		</P1Dialog>
	);
}
