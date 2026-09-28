import { Platform, type App } from 'obsidian';
import type { AgentSettings } from '../../../core/agent-launch/types';
import { t } from '../../../shared/i18n/terminal-accessor';
import { JsonStore } from '../../../shared/json-store';
import { absolutePluginDir, accountConfigDir } from '../../desktop/agents/accounts';
import type { TerminalService } from '../../desktop/terminal/terminal-service';
import type { HistoryPage, NativeSession } from '../../terminal-server/agent-data-client';
async function nodeModules() {
	if (!Platform.isDesktop) throw new Error(t('workbench.sessionMissing'));
	return Promise.resolve([
		window.require('node:path') as typeof import('node:path'),
		window.require('node:os') as typeof import('node:os'),
		window.require('node:fs/promises') as typeof import('node:fs/promises'),
		window.require('node:process') as typeof import('node:process'),
	] as const);
}
export interface HistoryMetadata {
	title?: string;
	tags?: string[];
	favorite?: boolean;
	archived?: boolean;
}
export class NativeHistory {
	private metadata: Record<string, HistoryMetadata> = {};
	private store: JsonStore<Record<string, HistoryMetadata>>;
	private loaded: Promise<void>;
	private tail: Promise<void> = Promise.resolve();
	constructor(
		private app: App,
		private service: TerminalService,
		private settings: () => AgentSettings,
		private pluginDir: string,
	) {
		const device = String(app.loadLocalStorage('nand.automation.device') || 'local');
		this.store = new JsonStore(
			app.vault.adapter,
			`.nand/terminal-agent/${device}/history.json`,
			(v): v is Record<string, HistoryMetadata> => !!v && typeof v === 'object' && !Array.isArray(v),
		);
		this.loaded = this.store.load({}).then((rows) => {
			this.metadata = rows;
		});
	}
	meta(key: string): HistoryMetadata {
		return this.metadata[key] ?? {};
	}
	update(key: string, patch: HistoryMetadata): Promise<void> {
		const result = this.tail.then(async () => {
			await this.loaded;
			const next = { ...this.metadata, [key]: { ...this.meta(key), ...patch } };
			await this.store.save(next);
			this.metadata = next;
		});
		this.tail = result.catch(() => {});
		return result;
	}
	private async scope() {
		const [path, , fs] = await nodeModules();
		const adapter = this.app.vault.adapter as unknown as { getBasePath(): string };
		const vault = await fs.realpath(adapter.getBasePath());
		const device = String(this.app.loadLocalStorage('nand.automation.device') || 'local');
		return { vault, index: path.join(vault, '.nand', 'terminal-agent', device, 'index.sqlite') };
	}

	async scan(signal?: AbortSignal): Promise<string[]> {
		const [path, os, , process] = await nodeModules();
		const scope = await this.scope(),
			home = os.homedir(),
			settings = this.settings();
		const dir = absolutePluginDir(scope.vault, this.pluginDir);
		const claude =
			accountConfigDir('claude', settings.agents['claude-code'].accountId, dir) ||
			process.env.CLAUDE_CONFIG_DIR ||
			path.join(home, '.claude');
		const codex =
			accountConfigDir('codex', settings.agents.codex.accountId, dir) ||
			process.env.CODEX_HOME ||
			path.join(home, '.codex');
		const gemini = path.join(process.env.GEMINI_CLI_HOME || home, '.gemini');
		const pi = process.env.PI_CODING_AGENT_DIR || path.join(home, '.pi', 'agent');
		const grok = process.env.GROK_HOME || path.join(home, '.grok');
		const openCode = path.join(process.env.XDG_DATA_HOME || path.join(home, '.local', 'share'), 'opencode');
		const roots = [
			{
				agentId: 'claude-code',
				path: path.join(claude, 'projects'),
				accountKey: JSON.stringify({ CLAUDE_CONFIG_DIR: claude }),
			},
			{ agentId: 'codex', path: path.join(codex, 'sessions'), accountKey: JSON.stringify({ CODEX_HOME: codex }) },
			{ agentId: 'gemini', path: path.join(gemini, 'tmp'), accountKey: '{}' },
			{ agentId: 'pi', path: path.join(pi, 'sessions'), accountKey: JSON.stringify({ PI_CODING_AGENT_DIR: pi }) },
			{ agentId: 'grok', path: path.join(grok, 'sessions'), accountKey: JSON.stringify({ GROK_HOME: grok }) },
			{ agentId: 'opencode', path: path.join(openCode, 'opencode.db'), accountKey: '{}' },
		];
		const client = await this.service.historyClient();
		const result = await client.request<{ warnings: string[] }>('scan', { ...scope, roots }, signal);
		return result.warnings;
	}
	async query(query = '', offset = 0, signal?: AbortSignal, filter = 'all'): Promise<HistoryPage> {
		await this.loaded;
		return (await this.service.historyClient()).request(
			'query',
			{ ...(await this.scope()), query, offset, filter, metadata: this.metadata },
			signal,
		);
	}
	async read(session: NativeSession, signal?: AbortSignal): Promise<NativeSession> {
		return (await this.service.historyClient()).request(
			'read',
			{ ...(await this.scope()), key: session.key },
			signal,
		);
	}
	async export(session: NativeSession): Promise<string> {
		const full = await this.read(session);
		const folder = '.nand/terminal-agent/exports';
		if (!(await this.app.vault.adapter.exists(folder))) await this.app.vault.adapter.mkdir(folder);
		const file = `${folder}/${session.agentId}-${session.sessionId.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}.md`;
		await this.app.vault.adapter.write(file, `# ${this.meta(session.key).title || session.title}\n\n${full.text}`);
		return file;
	}
}
