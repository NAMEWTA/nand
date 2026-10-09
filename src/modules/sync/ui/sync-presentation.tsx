import { moment, Notice, TFile, type App } from 'obsidian';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { onLanguageChanged, t } from '../../../shared/i18n/index';
import { Button } from '../../../ui/primitives/Button';
import { EmptyState } from '../../../ui/primitives/EmptyState';
import { IconButton } from '../../../ui/primitives/IconButton';
import { showMenu } from '../../../ui/primitives/menu';
import { NativeSurface, type NativeSurfaceContext } from '../../../ui/native-surface';
import { hasConflictBlocks } from '../core/conflict-blocks';
import type { Commit, CommitFile } from '../core/repo';
import type { ChangeCode, FileChange } from '../core/status';
import { errorText, lastRunText, describeReport } from '../services/report';
import type { SyncService, SyncSnapshot } from '../services/sync-service';
import { askText, confirmAction } from './dialogs';

export type SyncSection = 'changes' | 'history';

export interface SyncPageHost {
	service: () => SyncService | undefined;
	/** The vault folder that holds (or will hold) the repository: '' for the vault itself. */
	repoFolder: () => string;
	openSettings: () => void;
	report: (error: unknown) => void;
}

/** Recommended ignores for a new vault repository: per-device layout files and the trash. */
const recommendedGitignore = (configDir: string) => [`${configDir}/workspace.json`, `${configDir}/workspace-mobile.json`, '.trash/', '.DS_Store', ''].join('\n');

/** The Git sync page: changes (with commit, pull and push) or history. */
export class SyncPresentation extends NativeSurface {
	private message = '';
	constructor(context: NativeSurfaceContext, private readonly host: SyncPageHost, private section: SyncSection) {
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
		this.contentEl.addClass('nand-sync-page');
		const service = this.host.service();
		if (service) this.register(service.subscribe(() => this.draw()));
		this.register(onLanguageChanged(() => this.draw()));
		this.draw();
		void service?.refresh().catch(this.host.report);
		return Promise.resolve();
	}
	setSection(section: SyncSection): void {
		if (section === this.section) return;
		this.section = section;
		this.draw();
	}
	getState(): Record<string, unknown> {
		return { section: this.section, message: this.message };
	}
	setState(state: Record<string, unknown>): Promise<void> {
		if (typeof state.message === 'string') this.message = state.message;
		this.draw();
		return Promise.resolve();
	}
	private draw(): void {
		const service = this.host.service();
		render(
			service ? (
				<SyncPage
					app={this.app}
					service={service}
					snapshot={service.snapshot}
					section={this.section}
					message={this.message}
					setMessage={(value) => { this.message = value; }}
					host={this.host}
				/>
			) : (
				<EmptyState icon="git-branch" title={t('workbench.sync')} description={t('sync.starting')} layout="content" />
			),
			this.contentEl,
		);
	}
	onClose(): Promise<void> {
		render(null, this.contentEl);
		return Promise.resolve();
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

function SyncPage(props: PageProps) {
	const { snapshot, host, service } = props;
	if (snapshot.phase === 'starting') return <EmptyState icon="loader" title={t('workbench.sync')} description={t('sync.starting')} layout="content" />;
	if (snapshot.phase === 'no-git')
		return (
			<EmptyState
				icon="alert-triangle"
				title={t('sync.noGit')}
				description={t('sync.noGitHelp')}
				layout="content"
				action={{ label: t('sync.openSettings'), run: () => host.openSettings() }}
			/>
		);
	if (snapshot.phase === 'no-repo') return <NoRepository {...props} />;
	return (
		<div class="nand-sync-body">
			<Summary {...props} />
			{props.section === 'history' ? <History service={service} head={snapshot.status?.head ?? null} app={props.app} /> : <Changes {...props} />}
		</div>
	);
}

/** The vault is not in a repository: what that means and how to start. */
function NoRepository({ app, service, snapshot, host }: PageProps) {
	const [ignore, setIgnore] = useState(true);
	const init = async () => {
		if (!(await confirmAction(app, { title: t('sync.initTitle'), message: t('sync.initConfirm', { path: snapshot.place?.cwd ?? '' }), action: t('sync.init') }))) return;
		try {
			const folder = host.repoFolder();
			const file = folder ? `${folder}/.gitignore` : '.gitignore';
			if (ignore && !(await app.vault.adapter.exists(file))) await app.vault.adapter.write(file, recommendedGitignore(app.vault.configDir));
			await service.init();
			new Notice(t('sync.initDone'));
		} catch (error) {
			host.report(error);
		}
	};
	return (
		<div class="nand-sync-body nand-sync-setup">
			<EmptyState icon="git-branch" title={t('sync.noRepo')} description={t('sync.noRepoHelp', { path: snapshot.place?.cwd ?? '' })} layout="content" />
			<label class="nand-sync-check">
				<input type="checkbox" checked={ignore} onChange={(event) => setIgnore(event.currentTarget.checked)} />
				{t('sync.writeGitignore')}
			</label>
			<div class="nand-sync-actions">
				<Button variant="primary" icon="git-branch" onClick={() => void init()}>{t('sync.init')}</Button>
				<Button onClick={() => host.openSettings()}>{t('sync.openSettings')}</Button>
			</div>
			<p class="nand-sync-muted">{t('sync.cloneHelp')}</p>
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
		if (url) await service.addRemote(snapshot.remotes.includes('origin') ? `remote${snapshot.remotes.length + 1}` : 'origin', url).catch((error: unknown) => new Notice(describeError(error)));
	};
	const setIdentity = async () => {
		const name = await askText(app, t('sync.identity'), t('sync.identityName'), snapshot.identity.name);
		if (!name) return;
		const email = await askText(app, t('sync.identity'), t('sync.identityEmail'), snapshot.identity.email);
		if (email) await service.setIdentity(name, email).catch((error: unknown) => new Notice(describeError(error)));
	};
	return (
		<section class="nand-sync-summary" aria-live="polite">
			{status && (
				<div class="nand-sync-branch">
					<span class="nand-sync-branch-name">{status.branch ?? t('sync.detached')}</span>
					<span class="nand-sync-muted">
						{status.upstream ? `→ ${status.upstream}` : t('sync.noUpstream')}
						{status.upstream && !status.upstreamGone ? ` · ↑${status.ahead} ↓${status.behind}` : ''}
						{status.upstreamGone ? ` · ${t('sync.upstreamGone')}` : ''}
					</span>
				</div>
			)}
			<div class={`nand-sync-last${last && !last.ok ? ' is-error' : ''}`}>
				{busy ? t('sync.status.running', { action: t(`sync.action.${snapshot.running!}`) }) : lastRunText(last)}
				{last && !busy && <span class="nand-sync-muted"> · {moment(last.at).fromNow()}</span>}
			</div>
			{last && !last.ok && !busy && <pre class="nand-sync-detail">{describeReport(last)}</pre>}
			{snapshot.device.paused && (
				<div class="nand-sync-banner">
					{snapshot.device.paused === 'failures' ? t('sync.status.pausedFailures') : t('sync.paused')}
					<Button size="sm" onClick={() => void service.setPaused(false)}>{t('sync.resume')}</Button>
				</div>
			)}
			{snapshot.error && <div class="nand-sync-banner is-error">{errorText(snapshot.error.kind)} {snapshot.error.detail}</div>}
			{snapshot.locked && <div class="nand-sync-banner">{t('sync.error.locked')}</div>}
			{!snapshot.remotes.length && (
				<div class="nand-sync-banner">
					{t('sync.noRemote')}
					<Button size="sm" onClick={() => void addRemote()}>{t('sync.addRemote')}</Button>
				</div>
			)}
			{(!snapshot.identity.name || !snapshot.identity.email) && (
				<div class="nand-sync-banner">
					{t('sync.noIdentity')}
					<Button size="sm" onClick={() => void setIdentity()}>{t('sync.setIdentity')}</Button>
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
	const conflicts: Row[] = status.conflicted.map((change) => ({ kind: 'conflict', path: change.path, code: `${change.index}${change.worktree}` }));
	const staged: Row[] = status.staged.map((change) => ({ kind: 'staged', path: change.path, from: change.from, code: codeLabels[change.index] }));
	const changed: Row[] = [
		...status.unstaged.map((change: FileChange): Row => ({ kind: 'changed', path: change.path, from: change.from, code: codeLabels[change.worktree] })),
		...status.untracked.map((path): Row => ({ kind: 'untracked', path, code: 'U' })),
	];
	const typed = () => draft.trim() || undefined;
	const after = (promise: Promise<unknown>) => void promise.then(() => { setDraft(''); setMessage(''); }).catch(host.report);
	const toVault = (path: string) => snapshot.place?.toVault(path) ?? null;
	const commitMenu = (event: MouseEvent) =>
		showMenu(event, [
			{ title: t('sync.commitStaged'), icon: 'check', run: () => after(service.commit('staged', { message: typed() })) },
			{ title: t('sync.commitAll'), icon: 'check-check', run: () => after(service.commit('all', { message: typed() })) },
			{ title: t('sync.commitStagedAndSync'), icon: 'refresh-cw', section: true, run: () => after(service.commitAndSync('staged', { message: typed() })) },
			{ title: t('sync.stageAll'), icon: 'plus', section: true, run: () => service.stageAll().catch(host.report) },
			{ title: t('sync.unstageAll'), icon: 'minus', run: () => service.unstageAll().catch(host.report) },
		], host.report);
	const abort = async () => {
		if (await confirmAction(app, { title: t('sync.abortTitle'), message: t('sync.abortConfirm', { operation: t(`sync.operation.${snapshot.operation ?? 'merge'}`) }), action: t('sync.abort'), danger: true }))
			await service.abortOperation();
	};
	return (
		<div class="nand-sync-changes">
			{blocked && (
				<section class="nand-sync-banner is-error nand-sync-conflict" role="alert">
					<div>
						<strong>{snapshot.operation ? t('sync.operationStopped', { operation: t(`sync.operation.${snapshot.operation}`) }) : t('sync.conflictsOnly')}</strong>
						<p>{status.conflicted.length ? t('sync.conflictHelp', { count: status.conflicted.length }) : t('sync.continueHelp')}</p>
					</div>
					<div class="nand-sync-actions">
						{snapshot.operation && <Button variant="primary" disabled={busy || status.conflicted.length > 0} onClick={() => void service.continueOperation().catch(host.report)}>{t('sync.continue')}</Button>}
						{snapshot.operation && <Button variant="danger" disabled={busy} onClick={() => void abort().catch(host.report)}>{t('sync.abort')}</Button>}
					</div>
				</section>
			)}
			<section class="nand-sync-commit">
				<textarea
					class="nand-sync-message"
					rows={2}
					value={draft}
					placeholder={t('sync.messagePlaceholder')}
					aria-label={t('sync.message')}
					onInput={(event) => { setDraft(event.currentTarget.value); setMessage(event.currentTarget.value); }}
					onKeyDown={(event) => {
						if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) {
							event.preventDefault();
							if (!busy && !blocked) after(service.commitAndSync('all', { message: typed() }));
						}
					}}
				/>
				<div class="nand-sync-actions">
					<Button variant="primary" icon="refresh-cw" disabled={busy || blocked} onClick={() => after(service.commitAndSync('all', { message: typed() }))}>{t('sync.commitAndSync')}</Button>
					<Button icon="check" disabled={busy || blocked} onClick={() => after(service.commit('smart', { message: typed() }))}>{t('sync.commit')}</Button>
					<IconButton icon="more-horizontal" label={t('sync.moreCommit')} disabled={busy || blocked} onClick={(event) => commitMenu(event)} />
					<span class="nand-sync-spacer" />
					<IconButton icon="arrow-down" label={t('sync.action.pull')} disabled={busy || blocked} onClick={() => void service.pull().catch(host.report)} />
					<IconButton icon="arrow-up" label={t('sync.action.push')} disabled={busy || blocked} onClick={() => void service.push().catch(host.report)} />
					<IconButton icon="download-cloud" label={t('sync.action.fetch')} disabled={busy} onClick={() => void service.fetch().catch(host.report)} />
					<IconButton icon="rotate-cw" label={t('sync.refresh')} disabled={busy} onClick={() => void service.refresh().catch(host.report)} />
					<IconButton
						icon={snapshot.device.paused ? 'play' : 'pause'}
						label={snapshot.device.paused ? t('sync.resume') : t('sync.pause')}
						pressed={!!snapshot.device.paused}
						onClick={() => void service.setPaused(!snapshot.device.paused).catch(host.report)}
					/>
				</div>
			</section>
			{!conflicts.length && !staged.length && !changed.length && <p class="nand-sync-muted nand-sync-clean">{t('sync.clean')}</p>}
			<FileGroup title={t('sync.groupConflicts')} rows={conflicts} {...{ app, service, open, setOpen, toVault, busy, host }} />
			<FileGroup title={t('sync.groupStaged')} rows={staged} {...{ app, service, open, setOpen, toVault, busy, host }} action={{ icon: 'minus', label: t('sync.unstageAll'), run: () => service.unstageAll() }} />
			<FileGroup title={t('sync.groupChanges')} rows={changed} {...{ app, service, open, setOpen, toVault, busy, host }} action={{ icon: 'plus', label: t('sync.stageAll'), run: () => service.stageAll() }} />
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
		<section class="nand-sync-group">
			<header class="nand-sync-group-header">
				<h3>{title}</h3>
				<span class="nand-sync-count">{rows.length}</span>
				{action && <IconButton icon={action.icon} size="sm" label={action.label} disabled={rest.busy} onClick={() => void action.run().catch(rest.host.report)} />}
			</header>
			<ul class="nand-sync-files">
				{rows.map((row) => <FileRow key={`${row.kind}:${row.path}`} row={row} {...rest} />)}
			</ul>
		</section>
	);
}

function FileRow({ row, app, service, open, setOpen, toVault, busy, host }: Omit<GroupProps, 'title' | 'rows' | 'action'> & { row: Row }) {
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
		if (!(await confirmAction(app, { title: t('sync.discardTitle'), message: t(untracked ? 'sync.discardUntracked' : 'sync.discardConfirm', { path: row.path }), action: t('sync.discard'), danger: true }))) return;
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
			if (!(await confirmAction(app, { title: t('sync.resolveTitle'), message: t('sync.resolveMarkers', { path: row.path }), action: t('sync.markResolved') }))) return;
		await service.markResolved([row.path]);
	};
	return (
		<li class={`nand-sync-file is-${row.kind}`}>
			<div class="nand-sync-file-row">
				<span class={`nand-sync-code is-${row.code.trim() || 'M'}`} title={t(`sync.code.${row.kind}`)}>{row.code}</span>
				<button type="button" class="nand-sync-file-name" onClick={openFile} title={row.from ? `${row.from} → ${row.path}` : row.path}>
					<span>{name}</span>
					{folder && <span class="nand-sync-muted"> {folder}</span>}
				</button>
				<span class="nand-sync-file-actions">
					{row.kind !== 'untracked' && <IconButton icon="file-diff" size="sm" label={t('sync.showDiff')} pressed={expanded} onClick={() => setOpen(expanded ? '' : key)} />}
					{row.kind === 'staged' && <IconButton icon="minus" size="sm" label={t('sync.unstage')} disabled={busy} onClick={() => void service.unstage([row.path]).catch(host.report)} />}
					{(row.kind === 'changed' || row.kind === 'untracked') && <IconButton icon="plus" size="sm" label={t('sync.stage')} disabled={busy} onClick={() => void service.stage([row.path]).catch(host.report)} />}
					{(row.kind === 'changed' || row.kind === 'untracked') && <IconButton icon="undo-2" size="sm" label={t('sync.discard')} disabled={busy} onClick={() => void discard().catch(host.report)} />}
					{row.kind === 'conflict' && <IconButton icon="check" size="sm" label={t('sync.markResolved')} disabled={busy} onClick={() => void resolve().catch(host.report)} />}
				</span>
			</div>
			{expanded && <Diff load={() => service.diff(row.path, { staged: row.kind === 'staged' })} />}
		</li>
	);
}

/** A unified diff, loaded when shown. */
function Diff({ load }: { load: () => Promise<string> }) {
	const [text, setText] = useState<string | null>(null);
	useEffect(() => {
		let live = true;
		load().then((value) => live && setText(value), (error: unknown) => live && setText(describeError(error)));
		return () => { live = false; };
	}, []);
	if (text === null) return <p class="nand-sync-muted">{t('sync.loading')}</p>;
	if (!text.trim()) return <p class="nand-sync-muted">{t('sync.noDiff')}</p>;
	return (
		<pre class="nand-sync-diff">
			{text.split('\n').map((line, index) => (
				<span key={index} class={line.startsWith('@@') ? 'is-hunk' : line.startsWith('+') && !line.startsWith('+++') ? 'is-add' : line.startsWith('-') && !line.startsWith('---') ? 'is-del' : undefined}>
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
	const load = (skip: number) =>
		service.log(skip, PAGE).then(
			(page) => {
				setCommits((current) => (skip ? [...(current ?? []), ...page] : page));
				setMore(page.length === PAGE);
			},
			(failure: unknown) => setError(describeError(failure)),
		);
	useEffect(() => { void load(0); }, [head]);
	if (error) return <div class="nand-sync-banner is-error">{error}</div>;
	if (!commits) return <p class="nand-sync-muted">{t('sync.loading')}</p>;
	if (!commits.length) return <EmptyState icon="history" title={t('workbench.history')} description={t('sync.noCommits')} layout="content" />;
	return (
		<section class="nand-sync-history">
			<ul class="nand-sync-commits">
				{commits.map((commit) => (
					<li key={commit.hash} class="nand-sync-commit-item">
						<button type="button" class="nand-sync-commit-row" aria-expanded={open === commit.hash} onClick={() => setOpen(open === commit.hash ? '' : commit.hash)}>
							<span class="nand-sync-commit-subject">{commit.subject}</span>
							<span class="nand-sync-muted">{commit.short} · {commit.author} · {moment(commit.time * 1000).fromNow()}</span>
						</button>
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
		service.commitFiles(hash).then((value) => live && setFiles(value), () => live && setFiles([]));
		return () => { live = false; };
	}, [hash]);
	if (!files) return <p class="nand-sync-muted">{t('sync.loading')}</p>;
	return (
		<ul class="nand-sync-files">
			{files.map((file) => (
				<li key={file.path} class="nand-sync-file">
					<div class="nand-sync-file-row">
						<span class={`nand-sync-code is-${file.status[0] ?? 'M'}`}>{file.status[0]}</span>
						<button type="button" class="nand-sync-file-name" aria-expanded={open === file.path} onClick={() => setOpen(open === file.path ? '' : file.path)}>{file.path}</button>
					</div>
					{open === file.path && <Diff load={() => service.diff(file.path, { commit: hash })} />}
				</li>
			))}
		</ul>
	);
}
