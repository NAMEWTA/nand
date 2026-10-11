import { moment } from 'obsidian';
import type { SettingsHandle } from '../../../shared/settings/store';
import type { SyncSettings } from '../settings';
import type { CloneProgress, CloneResult } from '../core/clone';
import { formatCommitMessage, type CommitMode } from '../core/commit-mode';
import { GitError, needsAttention, type GitErrorKind } from '../core/errors';
import { blocker, commitAndSync, commitStep, pullStep, pushStep, succeeded, type StepResult } from '../core/flow';
import { normalizeDeviceState, EMPTY_DEVICE_STATE, type DeviceSyncState, type GitHost, type GitRunner, type RepoPlace } from '../core/ports';
import { CancelledError, OperationQueue } from '../core/queue';
import { GitRepo, type Commit, type CommitFile, type RepoOperation } from '../core/repo';
import { FAILURE_LIMIT, GIT_WRITE_GRACE } from '../core/schedule';
import type { RepoStatus } from '../core/status';
import { hasEmbeddedCredentials } from '../core/remote-url';

export type SyncAction = 'commit-and-sync' | 'commit' | 'pull' | 'push' | 'fetch' | 'continue' | 'abort' | 'stage' | 'unstage' | 'discard' | 'init' | 'clone' | 'remote' | 'identity' | 'refresh';

export interface RunReport {
	action: SyncAction;
	steps: StepResult[];
	/** Epoch ms when the run finished. */
	at: number;
	auto: boolean;
	ok: boolean;
}

/**
 * - `starting`: looking for git and the repository
 * - `no-git`: no runnable git was found
 * - `no-repo`: git runs, but the vault is not in a repository
 * - `ready`: a repository was found (its status may still have failed to load: `error`)
 */
export type SyncPhase = 'starting' | 'no-git' | 'no-repo' | 'ready';

export interface SyncSnapshot {
	phase: SyncPhase;
	gitVersion: string;
	place?: RepoPlace;
	status?: RepoStatus;
	operation: RepoOperation | null;
	/** Another git process holds `index.lock`. */
	locked: boolean;
	remotes: string[];
	identity: { name: string; email: string };
	/** The action running now. */
	running?: SyncAction;
	last?: RunReport;
	device: DeviceSyncState;
	/** The last status refresh failed. */
	error?: { kind: GitErrorKind; detail: string };
	clone?: { state: 'running'; target: string; progress?: CloneProgress } | CloneResult;
}

export interface SyncDialogs {
	/** Ask before the first push creates the branch on the remote and makes it the upstream. */
	confirmUpstream(remote: string, branch: string): Promise<boolean>;
}

export interface SyncDependencies {
	host: GitHost;
	settings: SettingsHandle<SyncSettings>;
	dialogs: SyncDialogs;
	/** Show a short message; `error` messages respect "show error notices". */
	notify(text: string, error: boolean): void;
	/** Describe a run for a notice. */
	describe(report: RunReport): string;
	now?: () => number;
}

const STATE_FILE = 'nand-sync.json';

/**
 * Git sync for one vault: finds git and the repository, keeps their status, and runs every git operation
 * through one queue so manual actions, timers and file events never touch the repository at the same time.
 */
export class SyncService {
	snapshot: SyncSnapshot = { phase: 'starting', gitVersion: '', operation: null, locked: false, remotes: [], identity: { name: '', email: '' }, device: { ...EMPTY_DEVICE_STATE } };
	private runner?: GitRunner & { dispose(): void };
	private repo?: GitRepo;
	private statePath = '';
	private readonly queue: OperationQueue;
	private readonly listeners = new Set<() => void>();
	private readonly deviceListeners = new Set<() => void>();
	private gitWriteAt = 0;
	private refreshTimer?: number;
	private refreshWin?: Window;
	private closed = false;
	private cloneController?: AbortController;
	private cloning?: Promise<CloneResult>;
	private readonly now: () => number;

	constructor(private readonly deps: SyncDependencies) {
		this.now = deps.now ?? (() => Date.now());
		this.queue = new OperationQueue(() => {
			this.snapshot = { ...this.snapshot, running: this.queue.running as SyncAction | undefined };
			this.emit();
		});
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
	/** Pause, resume and automatic-run bookkeeping changed. */
	onDeviceChange(listener: () => void): () => void {
		this.deviceListeners.add(listener);
		return () => this.deviceListeners.delete(listener);
	}
	private emit(): void {
		for (const listener of [...this.listeners]) listener();
	}

	get ready(): boolean {
		return this.snapshot.phase === 'ready' && !!this.repo;
	}
	/** A git operation is running or finished moments ago; vault events now come from git, not from editing. */
	get writingFiles(): boolean {
		return this.queue.busy || this.now() - this.gitWriteAt < GIT_WRITE_GRACE;
	}

	/** Find git and the repository again (after start, init or a change of git path or repository folder). */
	connect(): Promise<void> {
		return this.queue.enqueue('connect', 'refresh', () => this.locate());
	}

	private async locate(): Promise<void> {
		this.runner?.dispose();
		this.runner = undefined;
		this.repo = undefined;
		this.statePath = '';
		this.snapshot = { ...this.snapshot, phase: 'starting', place: undefined, status: undefined, operation: null, locked: false, remotes: [], identity: { name: '', email: '' }, device: { ...EMPTY_DEVICE_STATE }, last: undefined, error: undefined };
		this.emit();
		const settings = this.deps.settings.get();
		const found = await this.deps.host.locate(settings.gitPath);
		if (this.closed) return;
		if (!found) {
			this.snapshot = { ...this.snapshot, phase: 'no-git', gitVersion: '', place: undefined, status: undefined, error: undefined };
			return this.emit();
		}
		let place: RepoPlace;
		try { place = await this.deps.host.place(found.binary, settings.repoSubPath); }
		catch (error) {
			this.snapshot = { ...this.snapshot, phase: 'no-repo', gitVersion: found.version, place: undefined, status: undefined, error: errorOf(error) };
			return this.emit();
		}
		if (this.closed) return;
		this.runner = this.deps.host.runner(found.binary, place.cwd);
		if (!place.root) {
			this.snapshot = { ...this.snapshot, phase: 'no-repo', gitVersion: found.version, place, status: undefined, error: undefined };
			return this.emit();
		}
		this.repo = new GitRepo(this.runner, place.scope ?? '.');
		try {
			const relative = (await this.repo.git(['rev-parse', '--git-path', STATE_FILE])).stdout.trim();
			this.statePath = this.deps.host.resolve(place.cwd, relative);
			const device = normalizeDeviceState(await this.deps.host.readJson(this.statePath));
			this.snapshot = { ...this.snapshot, phase: 'ready', gitVersion: found.version, place, device };
		} catch (error) {
			this.snapshot = { ...this.snapshot, phase: 'ready', gitVersion: found.version, place, error: errorOf(error) };
		}
		await this.load();
		for (const listener of [...this.deviceListeners]) listener();
	}

	/** Reload status, stopped operation, lock, remotes and author. */
	private async load(): Promise<void> {
		const repo = this.repo;
		if (!repo) return this.emit();
		try {
			const [status, state, remotes, name, email] = await Promise.all([repo.status(), repo.state(), repo.remotes(), repo.config('user.name'), repo.config('user.email')]);
			this.snapshot = { ...this.snapshot, status, operation: state.operation, locked: state.locked, remotes, identity: { name, email }, error: undefined };
		} catch (error) {
			this.snapshot = { ...this.snapshot, error: errorOf(error) };
		}
		this.emit();
	}

	refresh(): Promise<void> {
		if (!this.ready) return this.connect();
		return this.queue.enqueue('refresh', 'refresh', () => this.load()).catch(ignoreCancel);
	}
	/** Refresh after vault edits settle; skipped while a git operation is the one changing files. */
	refreshSoon(win: Window): void {
		if (!this.ready || this.closed) return;
		this.refreshWin = win;
		win.clearTimeout(this.refreshTimer);
		this.refreshTimer = win.setTimeout(() => {
			if (!this.queue.busy) void this.refresh();
		}, 1500);
	}

	/** Queue a git action; afterwards the status is reloaded and files written now are attributed to git. */
	private run<T>(action: SyncAction, work: (repo: GitRepo) => Promise<T>, key: string = action): Promise<T> {
		return this.queue.enqueue(key, action, async () => {
			const repo = this.repo;
			if (!repo) throw new GitError(this.snapshot.phase === 'no-git' ? 'missing-git' : 'not-repo');
			try {
				return await work(repo);
			} finally {
				this.gitWriteAt = this.now();
				await this.load();
			}
		});
	}

	private message(template: string, files: readonly string[], typed?: string): string {
		if (typed?.trim()) return typed.trim();
		const settings = this.deps.settings.get();
		return formatCommitMessage(template, { date: moment().format(settings.commitDateFormat || 'YYYY-MM-DD HH:mm:ss'), hostname: this.deps.host.hostname(), files }, settings.listChangedFilesInMessageBody);
	}
	private confirmUpstream = (remote: string, branch: string) => this.deps.dialogs.confirmUpstream(remote, branch);

	/** Commit (all changes, or only staged ones) and then pull and push as configured. */
	commitAndSync(mode: 'all' | 'staged', options: { auto?: boolean; message?: string } = {}): Promise<RunReport> {
		const auto = !!options.auto;
		return this.run('commit-and-sync', async (repo) => {
			const settings = this.deps.settings.get();
			const steps = await commitAndSync(repo, {
				mode: auto ? (settings.autoCommitOnlyStaged ? 'staged' : 'all') : mode,
				autoStageOnEmptyIndex: settings.autoStageOnEmptyIndex,
				message: (files) => this.message(auto ? settings.autoCommitMessage : settings.commitMessage, files, options.message),
				pull: settings.pullBeforePush,
				push: !settings.disablePush,
				method: settings.syncMethod,
				squash: settings.squashCommitsBeforePush,
				confirmUpstream: auto ? undefined : this.confirmUpstream,
			});
			return this.finish('commit-and-sync', steps, auto);
		});
	}

	commit(mode: CommitMode, options: { auto?: boolean; message?: string } = {}): Promise<RunReport> {
		const auto = !!options.auto;
		return this.run('commit', async (repo) => {
			const settings = this.deps.settings.get();
			const status = await repo.status();
			const { operation } = await repo.state();
			const stop = blocker(status, operation);
			const step: StepResult = stop
				? { step: 'commit', state: 'failed', error: { kind: stop, detail: operation ?? '' } }
				: await commitStep(repo, status, {
						mode: auto ? (settings.autoCommitOnlyStaged ? 'staged' : 'all') : mode,
						autoStageOnEmptyIndex: settings.autoStageOnEmptyIndex,
						message: (files) => this.message(auto ? settings.autoCommitMessage : settings.commitMessage, files, options.message),
					});
			return this.finish('commit', [step], auto);
		});
	}

	pull(options: { auto?: boolean } = {}): Promise<RunReport> {
		return this.run('pull', async (repo) => this.finish('pull', [await pullStep(repo, this.deps.settings.get().syncMethod)], !!options.auto));
	}

	push(options: { auto?: boolean } = {}): Promise<RunReport> {
		const auto = !!options.auto;
		return this.run('push', async (repo) =>
			this.finish('push', [await pushStep(repo, { squash: this.deps.settings.get().squashCommitsBeforePush, confirmUpstream: auto ? undefined : this.confirmUpstream })], auto),
		);
	}

	fetch(): Promise<RunReport> {
		return this.run('fetch', async (repo) => {
			try {
				await repo.fetch();
				return this.finish('fetch', [{ step: 'pull', state: 'nothing' }], false, true);
			} catch (error) {
				return this.finish('fetch', [{ step: 'pull', state: 'failed', error: errorOf(error) }], false);
			}
		});
	}

	/**
	 * Record a run: last result, automatic bookkeeping and the notice. Manual runs always report (a run with no
	 * changes only while "show no-changes notices" is on, unless `always`); automatic runs report only failures.
	 */
	private async finish(action: SyncAction, steps: StepResult[], auto: boolean, always = false): Promise<RunReport> {
		const report: RunReport = { action, steps, at: this.now(), auto, ok: succeeded(steps) };
		this.snapshot = { ...this.snapshot, last: report };
		const device = { ...this.snapshot.device };
		if (auto) {
			if (action === 'commit-and-sync' || action === 'commit') device.lastCommit = report.at;
			if (action === 'pull') device.lastPull = report.at;
			if (action === 'push') device.lastPush = report.at;
		}
		const failure = steps.find((step) => step.error)?.error;
		if (report.ok) {
			device.failures = 0;
			// A successful run means whatever stopped automatic sync was fixed.
			if (!auto && device.paused === 'failures') device.paused = '';
		} else if (auto && failure && needsAttention(failure.kind)) {
			device.failures += 1;
			if (device.failures >= FAILURE_LIMIT && !device.paused) device.paused = 'failures';
		}
		await this.saveDevice(device);
		const settings = this.deps.settings.get();
		const nothing = steps.every((step) => step.state === 'nothing' || step.state === 'skipped');
		if (!report.ok) {
			if (!auto || settings.showErrorNotices) this.deps.notify(this.deps.describe(report), true);
		} else if (!auto && (always || !nothing || settings.showNoChangesNotice)) this.deps.notify(this.deps.describe(report), false);
		return report;
	}

	private async saveDevice(device: DeviceSyncState): Promise<void> {
		const changed = JSON.stringify(device) !== JSON.stringify(this.snapshot.device);
		this.snapshot = { ...this.snapshot, device };
		if (!changed) return;
		if (this.statePath) await this.deps.host.writeJson(this.statePath, device).catch(() => undefined);
		for (const listener of [...this.deviceListeners]) listener();
	}

	/** Stop or restart automatic sync on this device. */
	async setPaused(paused: boolean): Promise<void> {
		await this.saveDevice({ ...this.snapshot.device, paused: paused ? 'manual' : '', failures: 0 });
		this.emit();
	}

	stage(paths: readonly string[]): Promise<void> {
		return this.run('stage', (repo) => repo.stage(paths), `stage:${paths.join('\0')}`);
	}
	stageAll(): Promise<void> {
		return this.run('stage', (repo) => repo.stageAll(), 'stage-all');
	}
	unstage(paths: readonly string[]): Promise<void> {
		return this.run('unstage', (repo) => repo.unstage(paths), `unstage:${paths.join('\0')}`);
	}
	unstageAll(): Promise<void> {
		return this.run('unstage', (repo) => repo.unstageAll(), 'unstage-all');
	}
	/** Throw away unstaged edits of tracked files (the caller asked first). */
	discard(paths: readonly string[]): Promise<void> {
		return this.run('discard', (repo) => repo.discard(paths), `discard:${paths.join('\0')}`);
	}
	/** Stage resolved conflict files. */
	markResolved(paths: readonly string[]): Promise<void> {
		return this.run('stage', (repo) => repo.stage(paths), `resolve:${paths.join('\0')}`);
	}

	/** Finish the stopped merge or rebase; refused while conflicts remain. */
	continueOperation(): Promise<RunReport> {
		return this.run('continue', async (repo) => {
			const { operation } = await repo.state();
			const status = await repo.status();
			if (!operation) return this.finish('continue', [{ step: 'pull', state: 'nothing' }], false, true);
			if (status.conflicted.length) return this.finish('continue', [{ step: 'pull', state: 'conflict', count: status.conflicted.length }], false);
			try {
				await repo.continueOperation(operation);
				// A rebase may stop again on the next commit.
				const next = await repo.state();
				const left = (await repo.status()).conflicted.length;
				return this.finish('continue', [next.operation && left ? { step: 'pull', state: 'conflict', count: left } : { step: 'pull', state: 'done' }], false);
			} catch (error) {
				return this.finish('continue', [{ step: 'pull', state: 'failed', error: errorOf(error) }], false);
			}
		});
	}

	/** Go back to before the stopped merge or rebase (the caller asked first). */
	abortOperation(): Promise<RunReport> {
		return this.run('abort', async (repo) => {
			const { operation } = await repo.state();
			if (!operation) return this.finish('abort', [{ step: 'pull', state: 'nothing' }], false, true);
			try {
				await repo.abortOperation(operation);
				return this.finish('abort', [{ step: 'pull', state: 'done' }], false);
			} catch (error) {
				return this.finish('abort', [{ step: 'pull', state: 'failed', error: errorOf(error) }], false);
			}
		});
	}

	/** Create a repository in the vault (or the configured folder), then connect to it. */
	init(): Promise<void> {
		return this.queue.enqueue('init', 'init', async () => {
			const runner = this.runner;
			if (!runner) throw new GitError(this.snapshot.error?.kind ?? 'missing-git');
			await new GitRepo(runner).git(['init']);
			await this.locate();
		});
	}

	/** Clone outside this vault. State belongs to the service so navigating away does not lose it. */
	clone(target: string, source: string): Promise<CloneResult> {
		if (this.cloning) return this.cloning;
		const controller = new AbortController();
		this.cloneController = controller;
		const run = this.queue.enqueue('clone', 'clone', async (): Promise<CloneResult> => {
			this.snapshot = { ...this.snapshot, clone: { state: 'running', target } };
			this.emit();
			let result: CloneResult;
			try {
				const found = await this.deps.host.locate(this.deps.settings.get().gitPath);
				if (!found) throw new GitError('missing-git');
				result = await this.deps.host.clone(found.binary, target, source, {
					signal: controller.signal,
					onProgress: (progress) => {
						this.snapshot = { ...this.snapshot, clone: { state: 'running', target, progress } };
						this.emit();
					},
				});
			} catch (error) {
				const failure = errorOf(error);
				result = { state: failure.kind === 'cancelled' ? 'cancelled' : 'failed', target, error: failure };
			}
			this.snapshot = { ...this.snapshot, clone: result };
			this.emit();
			return result;
		});
		this.cloning = run.finally(() => { this.cloneController = undefined; this.cloning = undefined; });
		return this.cloning;
	}

	cancelClone(): void {
		this.cloneController?.abort();
	}

	addRemote(name: string, url: string): Promise<void> {
		return this.run('remote', async (repo) => {
			if (!url.trim() || /[\0\r\n]/.test(url) || hasEmbeddedCredentials(url)) throw new GitError('invalid-remote-url');
			await repo.git(['remote', 'add', '--', name, url]);
		});
	}

	setIdentity(name: string, email: string): Promise<void> {
		return this.run('identity', async (repo) => {
			await repo.setConfig('user.name', name);
			await repo.setConfig('user.email', email);
		});
	}

	/** Read-only queries; they do not wait for the queue. */
	log(skip: number, count = 50): Promise<Commit[]> {
		return this.repo ? this.repo.log(skip, count) : Promise.resolve([]);
	}
	commitFiles(hash: string): Promise<CommitFile[]> {
		return this.repo ? this.repo.commitFiles(hash) : Promise.resolve([]);
	}
	diff(path: string, source: { staged?: boolean; commit?: string } = {}): Promise<string> {
		return this.repo ? this.repo.diff(path, source) : Promise.resolve('');
	}

	/** Stop timers and git processes. Waiting work is cancelled; the running command is killed. */
	async dispose(): Promise<void> {
		this.closed = true;
		this.cancelClone();
		this.refreshWin?.clearTimeout(this.refreshTimer);
		this.runner?.dispose();
		await this.queue.close();
		this.listeners.clear();
		this.deviceListeners.clear();
	}
}

export function errorOf(error: unknown): { kind: GitErrorKind; detail: string } {
	if (error instanceof GitError) return { kind: error.kind, detail: error.detail };
	if (error instanceof CancelledError) return { kind: 'cancelled', detail: '' };
	return { kind: 'unknown', detail: error instanceof Error ? error.message : String(error) };
}

function ignoreCancel(error: unknown): void {
	if (!(error instanceof CancelledError) && !(error instanceof GitError && error.kind === 'cancelled')) throw error;
}
