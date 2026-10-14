import { BROWSER_HOST } from '../../browser/api';
import { Notice, Platform, type App } from 'obsidian';
import { SessionMaterialService } from './session-material';
import type { ModuleContext } from '../../../app/contracts/module';
import type { WorkbenchTarget } from '../../../app/contracts/workbench';
import { collectReferences } from '../../../host/obsidian/references';
import { t } from '../../../shared/i18n/index';
import { deviceId } from '../../../host/obsidian/storage/device-id';
import type { SettingsHandle } from '../../../shared/settings/store';
import { AGENT_CATALOG, getAgent } from '../core/launch/catalog';
import type { AgentId } from '../core/launch/types';
import { AgentsStore } from './agents-store';
import { launchSettings } from '../core/detection/merge';
import { removeStatusHooks } from '../platform/desktop/hooks/remove-status-hooks';
import { NOTIFICATION_INBOX } from '../../notifications/api';
import { UsageStore } from './usage-store';
import { StatsService } from './stats-service';
import { HistoryStore } from './history-store';
import { AgentUsageSource } from '../core/launch/usage-source';
import type { VaultSession, VaultSessionAgent } from '../core/history/types';
import type { SplitDirection } from '../core/terminal/layout';
import { WorkspaceService } from './workspace-service';
import { createWorkspaceStore } from './workspace-store';
import { privateVaultStorage } from '../../../host/obsidian/storage/private-storage';
import type { ResumeInfo } from '../core/workspace/model';
import type { QuickCommand, ShellChoice, TerminalSettings } from '../core/terminal/settings';
import { openPath, revealPath } from '../platform/desktop/files';
import { resumeArgs } from '../platform/desktop/history/scope';
import { launchArgs } from '../core/launch/flags';
import { accountEnv, absolutePluginDir, restoredAccountReference } from '../platform/desktop/agents/accounts';
import { canonicalVaultCwd } from '../platform/desktop/history/canonical-cwd';
import { checkAccountTranscript } from '../platform/desktop/agents/transcript';
import { accountArgs } from '../platform/desktop/agents/account-args';
import { formatResumeCommand } from '../platform/desktop/history/resume-command';
import { readUsageSnapshots } from '../platform/desktop/agents/usage';
import { AutomationHooks } from '../platform/desktop/hooks/automation-hooks';
import { BinaryError, ensureHelper } from '../platform/desktop/pty/binary';
import { protectedReceipt } from '../../../host/desktop/protected-receipt';
import { terminalEnvironment } from '../platform/desktop/pty/runtime-environment';
import { availableShells, resolveShell, sessionDirectory, type ShellOption } from '../platform/desktop/pty/shells';
import type { NativeSessionSummary } from '../platform/desktop/server/agent-data-client';
import { NativeHistory } from '../platform/history/service';
import { TerminalAutomationRuntime } from './agent-runtime';
import { AGENT_RUN_CONTEXTS } from '../api';
import { PromptRunner, submitInteractivePrompt } from './prompt-runner';
import { launchAgent, resumeAgent, type LaunchHost, type LaunchRequest } from './launch/launcher';
import type { TerminalSession } from './terminal/session';
import { hookActivity, TerminalSessions } from './terminal/sessions';

/** Usage polling interval with backoff after failures (capped at 15 minutes). */
export function usageDelay(refreshSec: number, failures: number): number {
	return Math.min(15 * 60_000, Math.max(15, refreshSec) * 1000 * 2 ** Math.min(failures, 6));
}

/** Text in a CSS color property as `#rrggbb`, or '' when it cannot be resolved. */
function cssColor(element: HTMLElement, property: string): string {
	const value = element.win.getComputedStyle(element).getPropertyValue(property);
	const match = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(value);
	if (!match) return /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : '';
	return (
		'#' +
		match
			.slice(1, 4)
			.map((part) => Number(part).toString(16).padStart(2, '0'))
			.join('')
	);
}

export type Placement = { split: { from: string; direction: SplitDirection } } | { tab: true };

/** Dialogs the controller shows; supplied by the module (the UI code loads on first use). */
export interface ControllerDialogs {
	confirm(app: App, message: string): Promise<boolean>;
}

/**
 * The agent module's runtime: terminal sessions and their tab layout, launching shells, agents and
 * presets, native history, usage, automation and the commands. One instance per module activation.
 */
export class AgentController {
	readonly sessions: TerminalSessions;
	readonly workspace: WorkspaceService;
	readonly usage: AgentUsageSource;
 readonly agents: AgentsStore;
 readonly usageStore: UsageStore;
 readonly stats: StatsService;
 readonly historyStore: HistoryStore;
	readonly runtime: TerminalAutomationRuntime;
	readonly prompts: PromptRunner;
	readonly materials: SessionMaterialService;
	private historyService?: NativeHistory;
	/** First page of this vault's native history, for the side panel and preview lookups. */
	private historyRows: NativeSessionSummary[] = [];
	private historyLoad?: Promise<void>;
	historyState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
	historyError = '';
	private readonly hooks: AutomationHooks;
	private readonly listeners = new Set<() => void>();
	private shellOptions?: ShellOption[];
	private colors = { foreground: '#d4d4d4', background: '#1e1e1e', cursor: '#d4d4d4' };
	private colorsReadAt = 0;
	private installing?: Promise<string>;
 private lastActivity = new Map<string,string>();
 private lastHooks = true;

	constructor(
		private readonly context: ModuleContext,
		readonly settings: SettingsHandle<TerminalSettings>,
		private readonly dialogs: ControllerDialogs,
	) {
		const app = context.app;
		const win = app.workspace.containerEl.win;
  this.agents = new AgentsStore(settings);
  context.lifetime.register(this.agents.store.subscribe(() => this.changed()));
  const detect = () => { void this.agents.refresh(); };
  const idle = win.requestIdleCallback?.(detect, { timeout: 2000 });
  const fallback = idle === undefined ? win.setTimeout(detect, 0) : undefined;
  context.lifetime.register(() => { if (idle !== undefined) win.cancelIdleCallback(idle); if (fallback !== undefined) win.clearTimeout(fallback); });
		this.hooks = new AutomationHooks(win, () => ({ vault: this.vaultPath() ?? '', device: deviceId(app) }));
		this.sessions = new TerminalSessions({
			app,
			version: context.manifest.version,
			platform: Platform.isWin ? 'win32' : Platform.isMacOS ? 'darwin' : 'linux',
			environment: () => terminalEnvironment(this.vaultPath() ?? '', deviceId(app)),
			settings: () => this.settings.get(),
			colors: () => this.themeColors(),
			binary: () => this.binary(),
			agentHooks: (agentId, env, activity) =>
				this.hooks.prepare(agentId, env, (event) => {
					const next = hookActivity(event.event);
					if (next) activity(next, event.data);
				}),
		});
		this.workspace = new WorkspaceService(
			createWorkspaceStore(privateVaultStorage(app), deviceId(app), win, report),
			this.sessions,
			{
				shell: async (options) => {
					const settings = this.settings.get(),
						shell = resolveShell(options.shell ?? settings.shell, settings);
					return this.sessions.create({
						kind: 'shell',
						file: shell.file,
						args: shell.args,
						title: shell.title,
						cwd: options.cwd ?? sessionDirectory(this.vaultPath(), settings.startInVault),
						env: {},
					});
				},
				agent: async (id, options) => {
					let session: TerminalSession | undefined;
					await launchAgent(
						this.captureLaunchHost(async (request) => {
							session = await this.sessions.create({ ...request, kind: 'agent', hooks: this.settings.get().statusHooks });
							if (options.prompt) void this.typeWhenReady(session, options.prompt);
						}),
						id,
						options,
					);
					return session;
				},
				resume: (info, title) => this.restoreSession(info, title),
				account: (id) => this.settings.get().agents.agents[id].accountId,
				report,
			},
            () => context.services.peek(BROWSER_HOST),
		);
		context.lifetime.register(context.services.watch(BROWSER_HOST, () => this.changed()));
		context.lifetime.register(this.workspace.store.subscribe(() => this.changed()));
		const idleTimer = win.setInterval(() => this.workspace.refreshStates(), 60_000);
		context.lifetime.register(() => win.clearInterval(idleTimer));
		context.lifetime.register(this.sessions.subscribe(() => {
   const settings = this.settings.get();
   for(const session of this.sessions.list()) {
    const previous=this.lastActivity.get(session.id);this.lastActivity.set(session.id,session.activity);
    if(session.agentId && settings.generatedTitles && session.generatedTitle) session.setGeneratedTitle(session.generatedTitle);
    if(session.agentId && previous && previous!==session.activity && ['done','waiting','permission'].includes(session.activity) && settings.notifications && !win.document.hasFocus()) {
     const inbox=context.services.peek(NOTIFICATION_INBOX);
     if(inbox?.available('system')) void inbox.send({id:`agent:${session.id}:${session.activityAt}`,title:session.title,body:t(`agent.activity.${session.activity}`),channels:['system']}).catch(report);
    }
   }
   this.changed();
  }));
		this.usage = new AgentUsageSource({
			read: () =>
				readUsageSnapshots(this.usageAgents(), {
					settings: this.agentSettings(),
					vault: this.vaultPath() ?? '',
					device: deviceId(app),
				}),
			active: () => true,
			delay: (failures) => usageDelay(this.settings.get().usageRefreshSec, failures),
			now: () => Date.now(),
			schedule: (callback, delay) => win.setTimeout(callback, delay),
			cancel: (timer) => win.clearTimeout(timer),
		});
		this.usage.setPinned(this.usagePinned());
		context.lifetime.register(this.usage.subscribe(() => this.changed()));
  let usageAccounts = JSON.stringify(AGENT_CATALOG.map(a => this.settings.get().agents.agents[a.id].accountId));
		context.lifetime.register(
			this.settings.subscribe(() => {
				this.usage.setPinned(this.usagePinned());
    const accounts = JSON.stringify(AGENT_CATALOG.map(a => this.settings.get().agents.agents[a.id].accountId));
    this.usage.invalidate(accounts !== usageAccounts); usageAccounts = accounts;
    if(this.lastHooks && !this.settings.get().statusHooks) {
     this.sessions.clearStatusHooks();
     // A live automation owns its completion hooks independently of interactive status display.
     // Do not remove its provider configuration while it is executing.
     void Promise.all(AGENT_CATALOG.filter(agent => !this.sessions.list().some(session => session.automated && session.running && session.agentId === agent.id)).flatMap(agent => [...new Set(['',this.settings.get().agents.agents[agent.id].accountId,...(this.settings.get().accounts[agent.id]??[])])].map(async name => removeStatusHooks(agent.id, await accountEnv(agent,name,this.vaultPath()??'',deviceId(app)))))).catch(report);
    }
    this.lastHooks=this.settings.get().statusHooks;
				for (const session of this.sessions.list()) session.setScrollback(this.settings.get().scrollback);
				this.changed();
			}),
		);
		this.runtime = new TerminalAutomationRuntime({
			app,
			pluginDir: context.manifest.dir ?? '',
			agentSettings: () => this.agentSettings(),
			history: () => this.history(),
			create: (request) => this.sessions.create(request),
			remove: (id) => this.sessions.remove(id),
			open: async (id) => {
				this.show(id);
				await this.open({ feature: 'terminal', section: 'running', resourceId: id });
			},
			shell: (kind) =>
				resolveShell(
					kind === 'powershell' ? (Platform.isWin ? 'powershell' : 'pwsh') : 'bash',
					this.settings.get(),
				),
		});
		this.prompts = new PromptRunner(
			this.runtime,
			() => this.vaultPath() ?? '',
			async () => (await context.contributions.collect(AGENT_RUN_CONTEXTS)).map((item) => item.value),
			win,
		);
		this.materials = new SessionMaterialService(this);
  this.usageStore = new UsageStore(this, win);
  this.stats = new StatsService(privateVaultStorage(app), deviceId(app), win, this.sessions, report);
  this.historyStore = new HistoryStore(() => this.history(), () => this.vaultPath() ?? '');

	}

 agentSettings() { return launchSettings(this.settings.get(), this.agents.store.getState().detected); }

 get app(): App {
		return this.context.app;
	}

	private changed(): void {
		for (const listener of [...this.listeners]) listener();
		this.context.shell.refresh();
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	vaultPath(): string | undefined {
		const adapter = this.app.vault.adapter as { getBasePath?: () => string };
		return typeof adapter.getBasePath === 'function' ? adapter.getBasePath() : undefined;
	}

	pluginDir(): string {
		return absolutePluginDir(this.vaultPath() ?? '', this.context.manifest.dir ?? '');
	}

	configureBrowser() { return this.context.shell.open({feature:'settings',section:'browser'}); }
	browserHost() { return this.context.services.peek(BROWSER_HOST); }
	history(): NativeHistory {
		if (!this.historyService) {
			this.historyService = new NativeHistory(this.app, this.sessions, () => this.agentSettings(), () => this.settings.get().accounts);
			this.context.lifetime.register(this.historyService.subscribe(() => this.changed()));
		}
		return this.historyService;
	}

	/** Cached first page of history (loads it the first time). Never starts a session. */
	recentHistory(): readonly NativeSessionSummary[] {
		if (this.historyState === 'idle') void this.refreshHistory(false);
		return this.historyRows;
	}

	findHistory(key: string): NativeSessionSummary | undefined {
		return this.historyRows.find((row) => row.key === key);
	}

	/** Re-read native history (`scan` re-enumerates the CLI folders first). */
	refreshHistory(scan = true): Promise<void> {
		if (this.historyLoad) return this.historyLoad;
		this.historyState = 'loading';
		this.changed();
		this.historyLoad = (async () => {
			try {
				const history = this.history();
				if (scan || !history.hasScanned) await history.scan();
				const page = await history.query('', 0, undefined, 'all');
				this.historyRows = page.rows;
				this.historyState = 'ready';
				this.historyError = '';
			} catch (error) {
				this.historyState = 'error';
				this.historyError = error instanceof Error ? error.message : String(error);
			} finally {
				this.historyLoad = undefined;
				this.changed();
			}
		})();
		return this.historyLoad;
	}

	/** Agents turned on in settings, in catalog order. */
	enabledAgents(): Array<{ id: AgentId; title: string }> {
		const agents = this.agentSettings().agents;
		return AGENT_CATALOG.filter((agent) => agents[agent.id]?.enabled).map((agent) => ({
			id: agent.id,
			title: agent.title,
		}));
	}

	usageAgents(): AgentId[] {
		const { agents } = this.agentSettings();
		return AGENT_CATALOG.filter(
			(agent) =>
				agent.usage !== 'none' && agents[agent.id]?.enabled !== false && agents[agent.id]?.showUsage !== false,
		).map((agent) => agent.id);
	}

	usagePinned(): boolean {
		return this.settings.get().agents.showUsageInStatusBar && this.usageAgents().length > 0;
	}

	shells(): ShellOption[] {
		this.shellOptions ??= availableShells();
		return this.shellOptions;
	}

	/** Theme colors for color queries, read from the workspace at most once a second. */
	private themeColors() {
		const settings = this.settings.get();
		const now = Date.now();
		if (now - this.colorsReadAt > 1000) {
			this.colorsReadAt = now;
			const body = this.app.workspace.containerEl.doc.body;
			this.colors = {
				foreground: cssColor(body, 'color') || this.colors.foreground,
				background:
					cssColor(this.app.workspace.containerEl, 'background-color') ||
					cssColor(body, 'background-color') ||
					this.colors.background,
				cursor: cssColor(body, 'caret-color') || cssColor(body, 'color') || this.colors.cursor,
			};
		}
		return {
			foreground: settings.useObsidianTheme
				? this.colors.foreground
				: settings.foreground || this.colors.foreground,
			background: settings.useObsidianTheme
				? this.colors.background
				: settings.background || this.colors.background,
			cursor: this.colors.cursor,
		};
	}

	/** Locate, download or verify the native helper, with notices for slow steps and failures. */
	private binary(): Promise<string> {
		this.installing ??= (async () => {
			let notice: Notice | undefined;
			try {
				return await ensureHelper({
					receipt: protectedReceipt(this.app.workspace.containerEl.win),
					vault: this.vaultPath() ?? '',
					device: deviceId(this.app),
					version: this.context.manifest.version,
					offline: this.settings.get().offline,
					progress: (state) => {
						notice?.hide();
						notice = new Notice(
							t(state === 'downloading' ? 'agent.helper.downloading' : 'agent.helper.verifying'),
							0,
						);
					},
				});
			} catch (error) {
				const message =
					error instanceof BinaryError
						? t(
								error.code === 'http' && error.detail?.status === 404
									? 'agent.helper.unpublished'
									: `agent.helper.${error.code}`,
								{
									status: error.detail?.status ?? 0,
									version: this.context.manifest.version,
								},
							)
						: error instanceof Error
							? error.message
							: String(error);
				if (error instanceof BinaryError) console.warn('[NAND terminal helper]', error.code, error.detail);
				new Notice(t('agent.helper.failed', { message }), 10_000);
				throw error;
			} finally {
				notice?.hide();
			}
		})().finally(() => {
			this.installing = undefined;
		});
		return this.installing;
	}

	/** Install or verify the helper and start it; resolves to its version. */
	async checkHelper(): Promise<string> {
		return (await this.sessions.ensureHelper()).version;
	}

	/** Show the agent page (in the main window's workbench by default). */
	async open(target: WorkbenchTarget = { feature: 'terminal', section: 'running' }): Promise<void> {
		await this.context.shell.open(target, this.app.workspace.getMostRecentLeaf()?.view.containerEl.win);
	}

	/** Put a session on screen: its tab becomes active (a new tab when it has none). */
	show(id: string): void {
		const session = this.sessions.get(id);
		if (session) {
			this.workspace.attach(session);
			this.workspace.focusSession(id);
		}
	}

	private place(session: TerminalSession, _placement: Placement): void {
		this.workspace.attach(session);
	}

	/** Start a session from a launch request and show it. */
	async start(
		request: LaunchRequest & { kind?: 'shell' | 'agent' | 'preset'; input?: string },
		placement: Placement = { tab: true },
	): Promise<TerminalSession> {
		const session = await this.sessions.create({
			kind: request.kind ?? (request.agentId ? 'agent' : 'shell'),
			title: request.title,
			file: request.file,
			args: request.args,
			cwd: request.cwd,
			env: request.env,
			agentId: request.agentId,
			hooks: !!request.agentId && this.settings.get().statusHooks,
		});
		this.place(session, placement);
		await this.open({ feature: 'terminal', section: 'running', resourceId: session.id });
		if (request.input) void this.typeWhenReady(session, request.input);
		return session;
	}

	/** Agents require input readiness; plain shells retain the existing five-second fallback. */
	private async typeWhenReady(session: TerminalSession, text: string): Promise<void> {
		if (!await submitInteractivePrompt(session, text, this.app.workspace.containerEl.win, !!session.agentId) && session.running)
			report(t('agent.quick.notReady'));
	}

	private launchHost(placement: Placement): LaunchHost {
		return {
			app: this.app,
			getVaultPath: () => this.vaultPath(),
			getAgentSettings: () => this.agentSettings(),
			saveAgentSettings: (agents) =>
				this.settings.update((draft) => {
					draft.agents.yoloAcknowledgedAgents = agents.yoloAcknowledgedAgents;
				}),
			start: async (request) => {
				await this.start(request, placement);
			},
		};
	}

	async newShell(choice?: ShellChoice, placement: Placement = { tab: true }): Promise<TerminalSession | undefined> {
		if ('split' in placement) {
			await this.workspace.splitPane(placement.split.from, placement.split.direction);
			return this.target();
		}
		const id = await this.workspace.newTerminal({ shell: choice });
		await this.open();
		return id ? this.sessions.get(id) : undefined;
	}

	async newAgent(agentId: AgentId, _placement: Placement = { tab: true }): Promise<void> {
		await this.workspace.newAgent(agentId);
		await this.open();
	}

 async runQuickCommand(command: QuickCommand, groupId?: string): Promise<void> {
  const cwd = sessionDirectory(this.vaultPath(), true, command.cwd);
  if (command.type === 'agent') {
   const agentId = command.agentId ?? this.agents.list()[0]?.id;
   if (!agentId) return;
   const id = await this.workspace.newAgent(agentId, { cwd, groupId });
   const session = id ? this.sessions.get(id) : undefined;
   if (!session) return;
   await this.typeWhenReady(session, command.content);
  } else {
   const id = await this.workspace.newTerminal({ cwd, groupId });
   const session = id ? this.sessions.get(id) : undefined;
   if (session) await this.typeWhenReady(session, command.content);
  }
  await this.settings.update(draft => { draft.lastQuickCommand = command.id; });
 }

 async addAccount(id: AgentId, name: string) {
  await accountEnv(getAgent(id), name, this.vaultPath() ?? '', deviceId(this.app));
  await this.settings.update(d => { d.accounts[id] = [...new Set([...(d.accounts[id] ?? []), name])]; });
 }
 async selectAccount(id: AgentId, name: string) {
  await this.settings.update(d => { d.agents.agents[id].accountId = name; });
  void this.historyStore.refresh();
 }
 async removeAccount(id: AgentId, name: string) {
  if (!await this.confirm(t('agent.manage.removeAccount', { name }))) return;
  await this.settings.update(d => { d.accounts[id] = (d.accounts[id] ?? []).filter(n => n !== name); if (d.agents.agents[id].accountId === name) d.agents.agents[id].accountId = ''; });
 }

 async resumeCommand(row: NativeSessionSummary): Promise<string> {
  const id = row.agentId as AgentId, settings = this.agentSettings();
  const vault = this.vaultPath() ?? '', cwd = await canonicalVaultCwd(vault, row.cwd);
  const saved: unknown = JSON.parse(row.accountKey);
  if (!saved || typeof saved !== 'object' || Array.isArray(saved) || Object.values(saved).some(value => typeof value !== 'string')) throw new Error(t('agent.accountScopeMismatch'));
  const { env, transcriptPath } = await restoredAccountReference(getAgent(id), saved as Record<string,string>, vault, deviceId(this.app), row.transcriptPath);
  await checkAccountTranscript(vault, env, transcriptPath);
  return formatResumeCommand({file:settings.agents[id].cliPath || getAgent(id).detectCommand, args:resumeArgs(id, id === 'pi' ? transcriptPath! : row.sessionId, accountArgs(id,launchArgs(settings,id),env)), env:{...settings.agents[id].env,...env}, cwd}, Platform.isWin);
 }
 async openHistoryPath(row: NativeSessionSummary, kind: 'log' | 'reveal' | 'cwd') {
  if(kind==='reveal') await revealPath(row.transcriptPath); else await openPath(kind==='cwd'?row.cwd:row.transcriptPath);
 }
 async resumeAt(row: NativeSessionSummary, groupId?: string, split?: 'right' | 'down') {
  const before = new Set(Object.keys(this.workspace.store.getState().tabs));
  await this.resume(row);
  const tab = Object.values(this.workspace.store.getState().tabs).find(tab=>!before.has(tab.id));
  if(tab && groupId) this.workspace.move(tab.id,split?{split,ofGroupId:groupId}:{groupId,index:Number.MAX_SAFE_INTEGER});
 }

	/** Resume a conversation from native history in its CLI. */
	async resume(row: NativeSessionSummary): Promise<void> {
		let env: Record<string, string> = {};
		try {
			const parsed: unknown = JSON.parse(row.accountKey || '{}');
			if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
				env = Object.fromEntries(
					Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
				);
		} catch {
			env = {};
		}
		const session: VaultSession = {
			agentId: row.agentId as VaultSessionAgent,
			title: this.history().meta(row.key).title || row.title,
			cwd: row.cwd,
			sessionId: row.sessionId,
			transcriptPath: row.transcriptPath || undefined,
			modifiedAtMs: row.modifiedAtMs,
			env,
		};
		await resumeAgent(this.launchHost({ tab: true }), session);
	}

	/** Split a pane with a new session of the default shell. */
	async splitSession(id: string, direction: SplitDirection): Promise<void> {
		await this.workspace.splitPane(id, direction);
	}
	async closeSession(id: string, confirmRunning = true): Promise<void> {
		await this.workspace.closePane(id, (message) =>
			confirmRunning ? this.confirm(message) : Promise.resolve(true),
		);
	}
	async closeTab(tabId: string): Promise<void> {
		await this.workspace.close(tabId, (message) => this.confirm(message));
	}
	private confirm(message: string): Promise<boolean> {
		return this.dialogs.confirm(this.app, message);
	}
	target(): TerminalSession | undefined {
		const tab = this.workspace.active;
		const focused = tab?.kind === 'terminal' ? this.sessions.get(tab.focusedSessionId) : undefined;
		return focused?.running ? focused : this.sessions.focused;
	}

	private captureLaunchHost(start: (request: LaunchRequest) => Promise<void>): LaunchHost {
		return { ...this.launchHost({ tab: true }), start };
	}
	private async restoreSession(info: ResumeInfo, title: string): Promise<TerminalSession | undefined> {
		if (!info.agentId || !info.nativeSessionId) throw new Error(t('agent.sessionMissing'));
		const vault = this.vaultPath();
		if (!vault) throw new Error(t('agent.vaultMissing'));
		const env = await accountEnv(getAgent(info.agentId), info.accountId ?? '', vault, deviceId(this.app), false);
		let transcriptPath = info.transcriptPath;
		if (!transcriptPath) {
			const history = this.history();
			await history.scan();
			const page = await history.query(info.nativeSessionId, 0, undefined, 'all');
			transcriptPath = page.rows.find(
				(row) => row.sessionId === info.nativeSessionId && row.cwd === info.cwd,
			)?.transcriptPath;
		}
		if (!transcriptPath) throw new Error(t('agent.sessionMissing'));
		let result: TerminalSession | undefined;
		await resumeAgent(
			this.captureLaunchHost(async (request) => {
				result = await this.sessions.create({ ...request, kind: 'agent', hooks: this.settings.get().statusHooks });
			}),
			{
				agentId: info.agentId,
				sessionId: info.nativeSessionId,
				cwd: info.cwd,
				title,
				transcriptPath,
				modifiedAtMs: 0,
				env,
			},
		);
		return result;
	}

	/** Paste into one session and do not press Enter. */
	pasteInto(id: string, text: string): boolean {
		const session = this.sessions.get(id);
		if (!session) return false;
		session.paste(text);
		this.show(id);
		return true;
	}

	/** Paste text into the target session (no Enter). */
	send(text: string): boolean {
		const session = this.target();
		if (!session) {
			new Notice(t('agent.noTerminal'));
			return false;
		}
		session.paste(text);
		this.show(session.id);
		return true;
	}

	/** Palette commands (removed with the module). */
	registerCommands(): void {
		const add = this.context.commands.add.bind(this.context.commands);
		for (const action of [
			'newAgent',
			'newBrowser',
			'newMenu',
			'close',
			'reopen',
			'next',
			'previous',
			'recent',
			'splitRight',
			'splitDown',
		] as const) {
			const nameKey = `agent.workspace.cmd.${action}`;
			add({
				id: `workspace-${action}`,
				name: t(nameKey),
				nameKey,
				callback: () => {
					void (async () => {
						await this.open();
						const tab = this.workspace.active;
						if (action === 'newAgent') {
							const agent = this.agents.list()[0];
							if (agent) await this.workspace.newAgent(agent.id);
						} else if (action === 'newBrowser') this.workspace.newBrowser();
						else if (action === 'newMenu') this.workspace.requestMenu();
						else if (action === 'close' && tab && !tab.pinned) await this.closeTab(tab.id);
						else if (action === 'reopen') this.workspace.reopen();
						else if (action === 'next' || action === 'previous')
							this.workspace.next(action === 'next' ? 1 : -1);
						else if (action === 'recent') this.workspace.recent();
						else if (tab && (action === 'splitRight' || action === 'splitDown')) {
							const group = this.workspace.group(tab.id);
							if (group)
								this.workspace.move(tab.id, {
									split: action === 'splitRight' ? 'right' : 'down',
									ofGroupId: group.id,
								});
						}
					})().catch(report);
				},
			});
		}
  for (const [id, section, nameKey] of [['agent-board','board','agent.workspace.nav.board'],['agent-history','history','agent.history'],['agent-jump','jump','agent.jump.title']] as const) add({id,name:t(nameKey),nameKey,callback:()=>{void this.open({feature:'terminal',section});}});
  add({id:'agent-refresh-usage',name:t('shell.refreshUsage'),nameKey:'shell.refreshUsage',callback:()=>{void this.usageStore.refresh().catch(report);}});
		add({
			id: 'terminal-new',
			name: t('agent.cmd.newShell'),
			nameKey: 'agent.cmd.newShell',
			callback: () => {
				void this.newShell().catch(report);
			},
		});
		for (const agent of AGENT_CATALOG) {
			add({
				id: `terminal-new-${agent.id}`,
				name: t('agent.cmd.newAgent', { title: agent.title }),
				checkCallback: (checking) => {
					if (!this.settings.get().enabled[agent.id]) return false;
					if (!checking) void this.newAgent(agent.id).catch(report);
					return true;
				},
			});
		}
		add({
			id: 'terminal-switch',
			name: t('agent.cmd.switch'),
			nameKey: 'agent.cmd.switch',
			callback: () => {
				void this.open().then(() => this.workspace.requestMenu());
			},
		});
		const sendCommand = (
			id: string,
			nameKey: string,
			read: () => string | null | Promise<string | null>,
			missingKey: string,
		) =>
			add({
				id,
				name: t(nameKey),
				nameKey,
				callback: () => {
					void Promise.resolve(read()).then((text) => {
						if (!text) new Notice(t(missingKey));
						else this.send(text);
					});
				},
			});
		sendCommand(
			'terminal-send-selection',
			'agent.cmd.sendSelection',
			() => this.app.workspace.activeEditor?.editor?.getSelection() || null,
			'agent.noSelection',
		);
		sendCommand(
			'terminal-send-note',
			'agent.cmd.sendNote',
			async () => {
				const file = this.app.workspace.getActiveFile();
				if (!file) return null;
				const editor = this.app.workspace.activeEditor;
				return editor?.file === file && editor.editor
					? editor.editor.getValue()
					: this.app.vault.cachedRead(file);
			},
			'agent.noNote',
		);
		sendCommand(
			'terminal-send-path',
			'agent.cmd.sendPath',
			() => {
				const file = this.app.workspace.getActiveFile();
				const vault = this.vaultPath();
				return file && vault
					? `${vault}${Platform.isWin ? '\\' : '/'}${Platform.isWin ? file.path.replace(/\//g, '\\') : file.path}`
					: null;
			},
			'agent.noNote',
		);
		sendCommand(
			'terminal-insert-reference',
			'agent.cmd.insertReference',
			() => {
				const text = collectReferences(this.app, 'absolute');
				return text ? `${text.split('\n').filter(Boolean).join(' ')} ` : null;
			},
			'agent.noReference',
		);
		add({
			id: 'terminal-usage',
			name: t('agent.cmd.usage'),
			nameKey: 'agent.cmd.usage',
			callback: () => {
				void this.open({ feature: 'terminal', section: 'usage' });
			},
		});
		add({
			id: 'terminal-settings',
			name: t('agent.cmd.settings'),
			nameKey: 'agent.cmd.settings',
			callback: () => {
				void this.context.shell.open({ feature: 'settings', section: 'terminal' });
			},
		});
	}

	/** Statuses for the workbench status bar (interactive sessions only). */
	status(): Array<{ id: string; status: 'running' | 'waiting'; automated: boolean }> {
		return Object.values(this.workspace.store.getState().tabs).flatMap((tab) =>
			tab.kind === 'terminal' && tab.agentId && ['working', 'waiting', 'permission'].includes(tab.state)
				? [
						{
							id: tab.focusedSessionId,
							status: tab.state === 'working' ? ('running' as const) : ('waiting' as const),
							automated: false,
						},
					]
				: [],
		);
	}

	agentTitle(id: AgentId): string {
		return getAgent(id).title;
	}

	async dispose(): Promise<void> {
		this.agents.dispose();
  this.usageStore.dispose();
  this.historyStore.dispose();
  await this.stats.dispose();
		await this.workspace.dispose();
		this.materials.dispose();
		await this.prompts.dispose();
		this.runtime.dispose();
		this.hooks.dispose();
		this.usage.dispose();
		this.sessions.dispose();
		this.listeners.clear();
		await this.historyService?.dispose();
	}
}

function report(error: unknown): void {
	new Notice(error instanceof Error ? error.message : String(error));
}
