// Adapted from stablyai/orca 464bd5a54b3364021c5cc0319859616e5ec41bbf (MIT), Copyright (c) 2026 Lovecast Inc.
// Original: src/renderer/src/components/right-sidebar/source-control/commit/commit-message-composer.tsx; sync/git-history-row.tsx
// NAND retains its Git service/actions and uses a 32px minimum target instead of Orca’s 26px history row.
import { moment, Notice, TFile, type App } from 'obsidian';
import { ReactSurface } from '../../../ui/react/surface';
import { useCallback, useEffect, useState } from 'react';
import { onLanguageChanged, t } from '../../../shared/i18n/index';
import { Button } from '../../../ui/components/button';
import { EmptyState } from '../../../ui/components/nand/EmptyState';
import { ActionButton } from '../../../ui/components/nand/ActionButton';
import { Textarea } from '../../../ui/components/textarea';
import { Checkbox } from '../../../ui/components/checkbox';
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from '../../../ui/components/dropdown-menu';
import {
	GitBranch,
	Loader2,
	TriangleAlert,
	History as HistoryIcon,
	ArrowDown,
	ArrowUp,
	CloudDownload,
	RotateCw,
	Play,
	Pause,
	Plus,
	Minus,
	FileDiff,
	Undo2,
	Check,
	CheckCheck,
	RefreshCw,
	Ellipsis,
} from 'lucide-react';
import { type NativeSurfaceContext } from '../../../ui/native-surface';
import { hasConflictBlocks } from '../core/conflict-blocks';
import type { Commit, CommitFile } from '../core/repo';
import type { ChangeCode, FileChange } from '../core/status';
import { errorText, lastRunText, describeReport } from '../services/report';
import type { SyncService, SyncSnapshot } from '../services/sync-service';
import { askText, confirmAction } from './dialogs';
import { CloneRepository } from './CloneRepository';

const actionIcons: Record<string, typeof Plus> = { plus: Plus, minus: Minus };
function SyncActionIcon({ name }: { name: string }) {
	const Icon = actionIcons[name] ?? Ellipsis;
	return <Icon className="size-4" />;
}

export type SyncSection = 'changes' | 'history';

export interface SyncPageHost {
	service: () => SyncService | undefined;
	/** The vault folder that holds (or will hold) the repository: '' for the vault itself. */
	repoFolder: () => string;
	openSettings: () => void;
	report: (error: unknown) => void;
}

/** Recommended ignores for a new vault repository: per-device layout files and the trash. */
const recommendedGitignore = (configDir: string) =>
	[`${configDir}/workspace.json`, `${configDir}/workspace-mobile.json`, '.trash/', '.DS_Store', ''].join('\n');

/** The Git sync page: changes (with commit, pull and push) or history. */
export class SyncPresentation extends ReactSurface {
	private message = '';
	constructor(
		context: NativeSurfaceContext,
		private readonly host: SyncPageHost,
		private section: SyncSection,
	) {
		super(context);
	}
	getViewType(): string {
		return 'nand-sync-page';
	}
	getDisplayText(): string {
		return t('workbench.sync');
	}
	getIcon(): string {
		return 'git-branch';
	}
	onOpen(): Promise<void> {
		void super.onOpen();
		const service = this.host.service();
		if (service) this.register(service.subscribe(() => this.rerender()));
		this.register(onLanguageChanged(() => this.rerender()));
		this.rerender();
		void service?.refresh().catch(this.host.report);
		return Promise.resolve();
	}
	setSection(section: SyncSection): void {
		if (section === this.section) return;
		this.section = section;
		this.rerender();
	}
	getState(): Record<string, unknown> {
		return { section: this.section, message: this.message };
	}
	setState(state: Record<string, unknown>): Promise<void> {
		if (typeof state.message === 'string') this.message = state.message;
		this.rerender();
		return Promise.resolve();
	}
	protected renderContent() {
		const service = this.host.service();
		return service ? (
			<SyncPage
				app={this.app}
				service={service}
				snapshot={service.snapshot}
				section={this.section}
				message={this.message}
				setMessage={(value) => {
					this.message = value;
				}}
				host={this.host}
			/>
		) : (
			<EmptyState icon={<GitBranch />} title={t('workbench.sync')} description={t('sync.starting')} />
		);
	}
	onClose(): Promise<void> {
		return super.onClose();
	}
}

interface PageProps {
	app: App;
	service: SyncService;
	snapshot: SyncSnapshot;
	section: SyncSection;
	message: string;
	setMessage: (value: string) => void;
	host: SyncPageHost;
}

export function SyncPage(props: PageProps) {
	const { snapshot, host, service } = props;
	if (snapshot.phase === 'starting')
		return <EmptyState icon={<Loader2 />} title={t('workbench.sync')} description={t('sync.starting')} />;
	if (snapshot.phase === 'no-git')
		return (
			<EmptyState
				icon={<TriangleAlert />}
				title={t('sync.noGit')}
				description={t('sync.noGitHelp')}
				action={<Button onClick={() => host.openSettings()}>{t('sync.openSettings')}</Button>}
			/>
		);
	if (snapshot.phase === 'no-repo') return <NoRepository {...props} />;
	return (
		<div className="mx-auto w-full max-w-4xl space-y-6 p-6">
			<Summary {...props} />
			<CloneRepository app={props.app} service={service} snapshot={snapshot} report={host.report} />
			{props.section === 'history' ? (
				<History service={service} head={snapshot.status?.head ?? null} app={props.app} />
			) : (
				<Changes {...props} />
			)}
		</div>
	);
}

/** The vault is not in a repository: what that means and how to start. */
function NoRepository({ app, service, snapshot, host }: PageProps) {
	const [ignore, setIgnore] = useState(true);
	const init = async () => {
		if (
			!(await confirmAction(app, {
				title: t('sync.initTitle'),
				message: t('sync.initConfirm', { path: snapshot.place?.cwd ?? '' }),
				action: t('sync.init'),
			}))
		)
			return;
		try {
			const folder = host.repoFolder();
			const file = folder ? `${folder}/.gitignore` : '.gitignore';
			if (ignore && !(await app.vault.adapter.exists(file)))
				await app.vault.adapter.write(file, recommendedGitignore(app.vault.configDir));
			await service.init();
			new Notice(t('sync.initDone'));
		} catch (error) {
			host.report(error);
		}
	};
	return (
		<div className="mx-auto w-full max-w-3xl space-y-4 p-6">
			<EmptyState
				icon={<GitBranch />}
				title={t('sync.noRepo')}
				description={
					snapshot.error
						? errorText(snapshot.error.kind)
						: t('sync.noRepoHelp', { path: snapshot.place?.cwd ?? '' })
				}
			/>
			<label className="flex items-center gap-2 text-sm">
				<Checkbox checked={ignore} onCheckedChange={(value) => setIgnore(value === true)} />
				{t('sync.writeGitignore')}
			</label>
			<div className="flex flex-wrap items-center gap-2">
				<Button variant="default" disabled={!!snapshot.running || !snapshot.place} onClick={() => void init()}>
					<GitBranch />
					{t('sync.init')}
				</Button>
				<Button onClick={() => host.openSettings()}>{t('sync.openSettings')}</Button>
			</div>
			<CloneRepository app={app} service={service} snapshot={snapshot} report={host.report} />
		</div>
	);
}

/** Branch, upstream, divergence, the last run and anything that needs setting up first. */
function Summary({ app, service, snapshot }: PageProps) {
	const status = snapshot.status;
	const busy = !!snapshot.running && snapshot.running !== 'refresh';
	const last = snapshot.last;
	const addRemote = async () => {
		const url = await askText(app, t('sync.addRemote'), t('sync.remoteUrl'), '', 'git@github.com:user/vault.git');
		if (url)
			await service
				.addRemote(snapshot.remotes.includes('origin') ? `remote${snapshot.remotes.length + 1}` : 'origin', url)
				.catch((error: unknown) => new Notice(describeError(error)));
	};
	const setIdentity = async () => {
		const name = await askText(app, t('sync.identity'), t('sync.identityName'), snapshot.identity.name);
		if (!name) return;
		const email = await askText(app, t('sync.identity'), t('sync.identityEmail'), snapshot.identity.email);
		if (email) await service.setIdentity(name, email).catch((error: unknown) => new Notice(describeError(error)));
	};
	return (
		<section className="space-y-3 rounded-lg border border-border p-4" aria-live="polite">
			{status && (
				<div className="flex flex-wrap items-center gap-2">
					<span className="font-mono text-sm font-medium">{status.branch ?? t('sync.detached')}</span>
					<span className="text-xs text-muted-foreground">
						{status.upstream ? `→ ${status.upstream}` : t('sync.noUpstream')}
						{status.upstream && !status.upstreamGone ? ` · ↑${status.ahead} ↓${status.behind}` : ''}
						{status.upstreamGone ? ` · ${t('sync.upstreamGone')}` : ''}
					</span>
				</div>
			)}
			<div className={last && !last.ok ? 'text-sm text-destructive' : 'text-sm'}>
				{busy ? t('sync.status.running', { action: t(`sync.action.${snapshot.running!}`) }) : lastRunText(last)}
				{last && !busy && <span className="text-xs text-muted-foreground"> · {moment(last.at).fromNow()}</span>}
			</div>
			{last && !last.ok && !busy && (
				<pre className="overflow-auto whitespace-pre-wrap text-xs">{describeReport(last)}</pre>
			)}
			{snapshot.device.paused && (
				<div className="flex flex-wrap items-center gap-3 rounded-md bg-muted p-3 text-sm">
					{snapshot.device.paused === 'failures' ? t('sync.status.pausedFailures') : t('sync.paused')}
					<Button size="sm" onClick={() => void service.setPaused(false)}>
						{t('sync.resume')}
					</Button>
				</div>
			)}
			{snapshot.error && (
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					{errorText(snapshot.error.kind)} {snapshot.error.detail}
				</div>
			)}
			{snapshot.locked && (
				<div className="flex flex-wrap items-center gap-3 rounded-md bg-muted p-3 text-sm">
					{t('sync.error.locked')}
				</div>
			)}
			{!snapshot.remotes.length && (
				<div className="flex flex-wrap items-center gap-3 rounded-md bg-muted p-3 text-sm">
					{t('sync.noRemote')}
					<Button size="sm" onClick={() => void addRemote()}>
						{t('sync.addRemote')}
					</Button>
				</div>
			)}
			{(!snapshot.identity.name || !snapshot.identity.email) && (
				<div className="flex flex-wrap items-center gap-3 rounded-md bg-muted p-3 text-sm">
					{t('sync.noIdentity')}
					<Button size="sm" onClick={() => void setIdentity()}>
						{t('sync.setIdentity')}
					</Button>
				</div>
			)}
		</section>
	);
}

function describeError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

const codeLabels: Record<ChangeCode, string> = { '.': '', M: 'M', A: 'A', D: 'D', R: 'R', C: 'C', T: 'T', U: 'U' };

type RowKind = 'conflict' | 'staged' | 'changed' | 'untracked';
interface Row {
	kind: RowKind;
	path: string;
	from?: string;
	code: string;
}

/** Commit box, stopped-operation banner and the three file lists. */
function Changes({ app, service, snapshot, message, setMessage, host }: PageProps) {
	const status = snapshot.status;
	const [draft, setDraft] = useState(message);
	const [open, setOpen] = useState<string>('');
	if (!status) return null;
	const busy = !!snapshot.running && snapshot.running !== 'refresh';
	const blocked = !!snapshot.operation || status.conflicted.length > 0;
	const conflicts: Row[] = status.conflicted.map((change) => ({
		kind: 'conflict',
		path: change.path,
		code: `${change.index}${change.worktree}`,
	}));
	const staged: Row[] = status.staged.map((change) => ({
		kind: 'staged',
		path: change.path,
		from: change.from,
		code: codeLabels[change.index],
	}));
	const changed: Row[] = [
		...status.unstaged.map((change: FileChange): Row => ({
			kind: 'changed',
			path: change.path,
			from: change.from,
			code: codeLabels[change.worktree],
		})),
		...status.untracked.map((path): Row => ({ kind: 'untracked', path, code: 'U' })),
	];
	const typed = () => draft.trim() || undefined;
	const after = (promise: Promise<unknown>) =>
		void promise
			.then(() => {
				setDraft('');
				setMessage('');
			})
			.catch(host.report);
	const toVault = (path: string) => snapshot.place?.toVault(path) ?? null;
	const abort = async () => {
		if (
			await confirmAction(app, {
				title: t('sync.abortTitle'),
				message: t('sync.abortConfirm', { operation: t(`sync.operation.${snapshot.operation ?? 'merge'}`) }),
				action: t('sync.abort'),
				danger: true,
			})
		)
			await service.abortOperation();
	};
	return (
		<div className="space-y-4">
			{blocked && (
				<section className="space-y-3 rounded-md bg-destructive/10 p-4 text-sm text-destructive" role="alert">
					<div>
						<strong>
							{snapshot.operation
								? t('sync.operationStopped', { operation: t(`sync.operation.${snapshot.operation}`) })
								: t('sync.conflictsOnly')}
						</strong>
						<p>
							{status.conflicted.length
								? t('sync.conflictHelp', { count: status.conflicted.length })
								: t('sync.continueHelp')}
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						{snapshot.operation && (
							<Button
								variant="default"
								disabled={busy || status.conflicted.length > 0}
								onClick={() => void service.continueOperation().catch(host.report)}
							>
								{t('sync.continue')}
							</Button>
						)}
						{snapshot.operation && (
							<Button
								variant="destructive"
								disabled={busy}
								onClick={() => void abort().catch(host.report)}
							>
								{t('sync.abort')}
							</Button>
						)}
					</div>
				</section>
			)}
			<section className="space-y-3">
				<Textarea
					className="mt-0.5 min-h-14 w-full resize-none appearance-none rounded-md border border-input bg-background shadow-xs px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:border-input disabled:bg-background disabled:text-foreground disabled:shadow-xs dark:bg-input/30 dark:disabled:bg-input/30"
					rows={2}
					value={draft}
					placeholder={t('sync.messagePlaceholder')}
					aria-label={t('sync.message')}
					onChange={(event) => {
						setDraft(event.currentTarget.value);
						setMessage(event.currentTarget.value);
					}}
					onKeyDown={(event) => {
						if (
							event.key === 'Enter' &&
							(event.ctrlKey || event.metaKey) &&
							!event.nativeEvent.isComposing
						) {
							event.preventDefault();
							if (!busy && !blocked) after(service.commitAndSync('all', { message: typed() }));
						}
					}}
				/>
				<div className="flex flex-wrap items-center gap-2">
					<Button
						variant="default"
						disabled={busy || blocked}
						onClick={() => after(service.commitAndSync('all', { message: typed() }))}
					>
						<RefreshCw />
						{t('sync.commitAndSync')}
					</Button>
					<Button
						disabled={busy || blocked}
						onClick={() => after(service.commit('smart', { message: typed() }))}
					>
						<Check />
						{t('sync.commit')}
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								aria-label={t('sync.moreCommit')}
								disabled={busy || blocked}
							>
								<Ellipsis />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							<DropdownMenuItem onSelect={() => after(service.commit('staged', { message: typed() }))}>
								<Check />
								{t('sync.commitStaged')}
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={() => after(service.commit('all', { message: typed() }))}>
								<CheckCheck />
								{t('sync.commitAll')}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onSelect={() => after(service.commitAndSync('staged', { message: typed() }))}
							>
								<RefreshCw />
								{t('sync.commitStagedAndSync')}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onSelect={() => {
									void service.stageAll().catch(host.report);
								}}
							>
								<Plus />
								{t('sync.stageAll')}
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() => {
									void service.unstageAll().catch(host.report);
								}}
							>
								<Minus />
								{t('sync.unstageAll')}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<span className="flex-1" />
					<ActionButton
						label={t('sync.action.pull')}
						disabled={busy || blocked}
						onClick={() => void service.pull().catch(host.report)}
					>
						<ArrowDown />
					</ActionButton>
					<ActionButton
						label={t('sync.action.push')}
						disabled={busy || blocked}
						onClick={() => void service.push().catch(host.report)}
					>
						<ArrowUp />
					</ActionButton>
					<ActionButton
						label={t('sync.action.fetch')}
						disabled={busy}
						onClick={() => void service.fetch().catch(host.report)}
					>
						<CloudDownload />
					</ActionButton>
					<ActionButton
						label={t('sync.refresh')}
						disabled={busy}
						onClick={() => void service.refresh().catch(host.report)}
					>
						<RotateCw />
					</ActionButton>
					<ActionButton
						label={snapshot.device.paused ? t('sync.resume') : t('sync.pause')}
						aria-pressed={!!snapshot.device.paused}
						onClick={() => void service.setPaused(!snapshot.device.paused).catch(host.report)}
					>
						{snapshot.device.paused ? <Play /> : <Pause />}
					</ActionButton>
				</div>
			</section>
			{!conflicts.length && !staged.length && !changed.length && (
				<p className="py-8 text-center text-sm text-muted-foreground">{t('sync.clean')}</p>
			)}
			<FileGroup
				title={t('sync.groupConflicts')}
				rows={conflicts}
				{...{ app, service, open, setOpen, toVault, busy, host }}
			/>
			<FileGroup
				title={t('sync.groupStaged')}
				rows={staged}
				{...{ app, service, open, setOpen, toVault, busy, host }}
				action={{ icon: 'minus', label: t('sync.unstageAll'), run: () => service.unstageAll() }}
			/>
			<FileGroup
				title={t('sync.groupChanges')}
				rows={changed}
				{...{ app, service, open, setOpen, toVault, busy, host }}
				action={{ icon: 'plus', label: t('sync.stageAll'), run: () => service.stageAll() }}
			/>
		</div>
	);
}

interface GroupProps {
	title: string;
	rows: Row[];
	app: App;
	service: SyncService;
	open: string;
	setOpen: (key: string) => void;
	toVault: (path: string) => string | null;
	busy: boolean;
	host: SyncPageHost;
	action?: { icon: string; label: string; run: () => Promise<void> };
}

function FileGroup({ title, rows, action, ...rest }: GroupProps) {
	if (!rows.length) return null;
	return (
		<section className="space-y-2">
			<header className="flex items-center gap-2 text-sm font-medium">
				<h3>{title}</h3>
				<span className="rounded-full bg-muted px-2 text-xs tabular-nums">{rows.length}</span>
				{action && (
					<ActionButton
						label={action.label}
						disabled={rest.busy}
						onClick={() => void action.run().catch(rest.host.report)}
					>
						<SyncActionIcon name={action.icon} />
					</ActionButton>
				)}
			</header>
			<ul className="divide-y divide-border rounded-lg border border-border">
				{rows.map((row) => (
					<FileRow key={`${row.kind}:${row.path}`} row={row} {...rest} />
				))}
			</ul>
		</section>
	);
}

function FileRow({
	row,
	app,
	service,
	open,
	setOpen,
	toVault,
	busy,
	host,
}: Omit<GroupProps, 'title' | 'rows' | 'action'> & { row: Row }) {
	const key = `${row.kind}:${row.path}`;
	const expanded = open === key;
	const vaultPath = toVault(row.path);
	const name = row.path.split('/').pop() ?? row.path;
	const folder = row.path.slice(0, row.path.length - name.length).replace(/\/$/, '');
	const openFile = () => {
		const file = vaultPath ? app.vault.getAbstractFileByPath(vaultPath) : null;
		if (file instanceof TFile) void app.workspace.getLeaf('tab').openFile(file).catch(host.report);
		else new Notice(t('sync.notInVault'));
	};
	const discard = async () => {
		const untracked = row.kind === 'untracked';
		if (
			!(await confirmAction(app, {
				title: t('sync.discardTitle'),
				message: t(untracked ? 'sync.discardUntracked' : 'sync.discardConfirm', { path: row.path }),
				action: t('sync.discard'),
				danger: true,
			}))
		)
			return;
		if (untracked) {
			const file = vaultPath ? app.vault.getAbstractFileByPath(vaultPath) : null;
			if (!(file instanceof TFile)) return void new Notice(t('sync.notInVault'));
			await app.fileManager.trashFile(file);
			await service.refresh();
		} else await service.discard([row.path]);
	};
	const resolve = async () => {
		const file = vaultPath ? app.vault.getAbstractFileByPath(vaultPath) : null;
		if (file instanceof TFile && file.extension === 'md' && hasConflictBlocks(await app.vault.read(file)))
			if (
				!(await confirmAction(app, {
					title: t('sync.resolveTitle'),
					message: t('sync.resolveMarkers', { path: row.path }),
					action: t('sync.markResolved'),
				}))
			)
				return;
		await service.markResolved([row.path]);
	};
	return (
		<li className="min-w-0">
			<div className="flex items-center gap-2 p-2">
				<span className="min-w-6 font-mono text-xs" title={t(`sync.code.${row.kind}`)}>
					{row.code}
				</span>
				<Button
					variant="ghost"
					type="button"
					className="min-w-0 flex-1 whitespace-normal break-all text-left text-sm"
					onClick={openFile}
					title={row.from ? `${row.from} → ${row.path}` : row.path}
				>
					<span>{name}</span>
					{folder && <span className="text-xs text-muted-foreground"> {folder}</span>}
				</Button>
				<span className="flex items-center gap-1">
					{row.kind !== 'untracked' && (
						<ActionButton
							label={t('sync.showDiff')}
							aria-pressed={expanded}
							onClick={() => setOpen(expanded ? '' : key)}
						>
							<FileDiff />
						</ActionButton>
					)}
					{row.kind === 'staged' && (
						<ActionButton
							label={t('sync.unstage')}
							disabled={busy}
							onClick={() => void service.unstage([row.path]).catch(host.report)}
						>
							<Minus />
						</ActionButton>
					)}
					{(row.kind === 'changed' || row.kind === 'untracked') && (
						<ActionButton
							label={t('sync.stage')}
							disabled={busy}
							onClick={() => void service.stage([row.path]).catch(host.report)}
						>
							<Plus />
						</ActionButton>
					)}
					{(row.kind === 'changed' || row.kind === 'untracked') && (
						<ActionButton
							label={t('sync.discard')}
							disabled={busy}
							onClick={() => void discard().catch(host.report)}
						>
							<Undo2 />
						</ActionButton>
					)}
					{row.kind === 'conflict' && (
						<ActionButton
							label={t('sync.markResolved')}
							disabled={busy}
							onClick={() => void resolve().catch(host.report)}
						>
							<Check />
						</ActionButton>
					)}
				</span>
			</div>
			{expanded && <Diff service={service} path={row.path} staged={row.kind === 'staged'} />}
		</li>
	);
}

/** A unified diff, loaded when shown. */
function Diff({
	service,
	path,
	staged,
	commit,
}: {
	service: SyncService;
	path: string;
	staged?: boolean;
	commit?: string;
}) {
	const [text, setText] = useState<string | null>(null);
	useEffect(() => {
		let live = true;
		service.diff(path, { staged, commit }).then(
			(value) => live && setText(value),
			(error: unknown) => live && setText(describeError(error)),
		);
		return () => {
			live = false;
		};
	}, [service, path, staged, commit]);
	if (text === null) return <p className="text-xs text-muted-foreground">{t('sync.loading')}</p>;
	if (!text.trim()) return <p className="text-xs text-muted-foreground">{t('sync.noDiff')}</p>;
	return (
		<pre className="overflow-auto bg-muted/40 p-3 font-mono text-xs">
			{text.split('\n').map((line, index) => (
				<span
					key={index}
					className={
						line.startsWith('@@')
							? 'text-status-info'
							: line.startsWith('+') && !line.startsWith('+++')
								? 'text-status-success'
								: line.startsWith('-') && !line.startsWith('---')
									? 'text-destructive'
									: undefined
					}
				>
					{line}
					{'\n'}
				</span>
			))}
		</pre>
	);
}

const PAGE = 50;

/** Commits, newest first; a commit opens its files, a file its diff. */
function History({ service, head }: { service: SyncService; head: string | null; app: App }) {
	const [commits, setCommits] = useState<Commit[] | null>(null);
	const [more, setMore] = useState(false);
	const [open, setOpen] = useState('');
	const [error, setError] = useState('');
	const load = useCallback(
		(skip: number) =>
			service.log(skip, PAGE).then(
				(page) => {
					setCommits((current) => (skip ? [...(current ?? []), ...page] : page));
					setMore(page.length === PAGE);
				},
				(failure: unknown) => setError(describeError(failure)),
			),
		[service],
	);
	useEffect(() => {
		void load(0);
	}, [head, load]);
	if (error) return <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>;
	if (!commits) return <p className="text-xs text-muted-foreground">{t('sync.loading')}</p>;
	if (!commits.length)
		return <EmptyState icon={<HistoryIcon />} title={t('workbench.history')} description={t('sync.noCommits')} />;
	return (
		<section className="space-y-4">
			<ul className="divide-y divide-border">
				{commits.map((commit) => (
					<li key={commit.hash} className="py-2">
						<Button
							variant="ghost"
							type="button"
							className="grid h-auto min-h-8 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-1.5 px-3 py-0.5 text-left text-xs cursor-pointer hover:bg-accent/40 focus-visible:bg-accent/40"
							aria-expanded={open === commit.hash}
							onClick={() => setOpen(open === commit.hash ? '' : commit.hash)}
						>
							<HistoryIcon className="size-3 shrink-0 text-muted-foreground" />
							<span className="block min-w-0 flex-1 truncate text-foreground">{commit.subject}</span>
							<span className="text-xs text-muted-foreground">
								{commit.short} · {commit.author} · {moment(commit.time * 1000).fromNow()}
							</span>
						</Button>
						{open === commit.hash && <CommitFiles service={service} hash={commit.hash} />}
					</li>
				))}
			</ul>
			{more && <Button onClick={() => void load(commits.length)}>{t('sync.loadMore')}</Button>}
		</section>
	);
}

function CommitFiles({ service, hash }: { service: SyncService; hash: string }) {
	const [files, setFiles] = useState<CommitFile[] | null>(null);
	const [open, setOpen] = useState('');
	useEffect(() => {
		let live = true;
		service.commitFiles(hash).then(
			(value) => live && setFiles(value),
			() => live && setFiles([]),
		);
		return () => {
			live = false;
		};
	}, [hash, service]);
	if (!files) return <p className="text-xs text-muted-foreground">{t('sync.loading')}</p>;
	return (
		<ul className="divide-y divide-border rounded-lg border border-border">
			{files.map((file) => (
				<li key={file.path} className="min-w-0">
					<div className="flex items-center gap-2 p-2">
						<span className="min-w-6 font-mono text-xs">{file.status[0]}</span>
						<Button
							variant="ghost"
							type="button"
							className="min-w-0 flex-1 whitespace-normal break-all text-left text-sm"
							aria-expanded={open === file.path}
							onClick={() => setOpen(open === file.path ? '' : file.path)}
						>
							{file.path}
						</Button>
					</div>
					{open === file.path && <Diff service={service} path={file.path} commit={hash} />}
				</li>
			))}
		</ul>
	);
}
