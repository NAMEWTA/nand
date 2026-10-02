import { deviceId as getDeviceId } from '../storage/device-id';
import { Platform, TFolder, type App, type TFile } from 'obsidian';
import type { AgentSettings } from '../../../core/agent-launch/types';
import { t } from '../../../shared/i18n/terminal-accessor';
import { JsonStore } from '../../../shared/json-store';
import { absolutePluginDir, accountConfigDir } from '../../desktop/agents/accounts';
import type { TerminalService } from '../../desktop/terminal/terminal-service';
import type { AgentDataClient, HistoryPage, NativeSession, NativeSessionSummary, NativeUsage } from '../../terminal-server/agent-data-client';
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
interface SharedRead<T> {
	promise: Promise<T>;
	abort: AbortController;
	consumers: number;
	settled: boolean;
}
function checkCancelled(signal?: AbortSignal): void {
	if (signal?.aborted) throw new Error('History request cancelled');
}
function consume<T>(read: SharedRead<T>, signal?: AbortSignal): Promise<T> {
	if (signal?.aborted) {
		if (!read.settled && !read.consumers) read.abort.abort();
		return Promise.reject(new Error('History request cancelled'));
	}
	read.consumers++;
	return new Promise<T>((resolve, reject) => {
		let done = false;
		const finish = () => {
			if (done) return false;
			done = true;
			signal?.removeEventListener('abort', cancel);
			read.consumers--;
			return true;
		};
		const cancel = () => {
			if (!finish()) return;
			if (!read.settled && !read.consumers) read.abort.abort();
			reject(new Error('History request cancelled'));
		};
		signal?.addEventListener('abort', cancel, { once: true });
		void read.promise.then(value => { if (finish()) resolve(value); }, (error: unknown) => { if (finish()) reject(error instanceof Error ? error : new Error(String(error))); });
	});
}
function sharedRead<T>(load: (signal: AbortSignal) => Promise<T>): SharedRead<T> {
	const abort = new AbortController();
	const read: SharedRead<T> = { abort, consumers: 0, settled: false, promise: Promise.resolve().then(() => { checkCancelled(abort.signal); return load(abort.signal); }) };
	void read.promise.then(() => { read.settled = true; }, () => { read.settled = true; });
	return read;
}
export class NativeHistory {
	private metadata: Record<string, HistoryMetadata> = {};
	private store: JsonStore<Record<string, HistoryMetadata>>;
	private loaded: Promise<void>;
	private tail: Promise<void> = Promise.resolve();
	private listeners = new Set<() => void>();
	private indexVersion = 0;
	private scanned = false;
	private metadataVersion = 0;
	private version = 0;
	private scanRead?: { key: string; read: SharedRead<string[]> };
	private pages = new Map<string, SharedRead<HistoryPage>>();
	private reads = new Set<AbortController>();
	private client?: AgentDataClient;
	private clientRevision = 0;
	private unsubscribeClient?: () => void;
	private disposed = false;
	constructor(
		private app: App,
		private service: TerminalService,
		private settings: () => AgentSettings,
		private pluginDir: string,
	) {
		const device = getDeviceId(app);
		this.store = new JsonStore(
			app.vault.adapter,
			`.nand/terminal-agent/${device}/history.json`,
			(v): v is Record<string, HistoryMetadata> => !!v && typeof v === 'object' && !Array.isArray(v),
		);
		this.loaded = this.store.load({}).then((rows) => {
			this.metadata = rows;
			this.metadataVersion++;
			this.changed();
		});
	}
	get revision(): number { return this.version; }
	get indexRevision(): number { return this.indexVersion; }
	get hasScanned(): boolean { return this.scanned; }
	get metadataRevision(): number { return this.metadataVersion; }
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
	private changed(notify = true): void {
		this.version++;
		this.pages.clear();
		if (notify) for (const listener of this.listeners) listener();
	}
	private active(): void {
		if (this.disposed) throw new Error('History service disposed');
	}
	private createRead<T>(load: (signal: AbortSignal) => Promise<T>): SharedRead<T> {
		this.active();
		const read = sharedRead(load);
		this.reads.add(read.abort);
		const clear = () => this.reads.delete(read.abort);
		void read.promise.then(clear, clear);
		return read;
	}
	private observeClient(client: AgentDataClient): void {
		this.active();
		if (this.client === client) return;
		this.unsubscribeClient?.();
		if (this.client) this.changed();
		this.client = client;
		this.clientRevision = client.connectionRevision;
		this.unsubscribeClient = client.subscribeConnection(() => {
			this.clientRevision = client.connectionRevision;
			this.indexVersion = 0;
			this.scanned = false;
			// Closing the final terminal deliberately stops the server. Invalidate
			// cached results now, but publish only a live connection: a subscriber
			// query must not restart a server while its shutdown is in progress.
			this.changed(client.isConnected());
		});
	}
	async dispose(): Promise<void> {
		this.disposed = true;
		this.listeners.clear();
		this.unsubscribeClient?.();
		for (const abort of this.reads) abort.abort();
		this.reads.clear();
		this.pages.clear();
		this.scanRead = undefined;
		await this.tail;
	}
	meta(key: string): HistoryMetadata {
		return this.metadata[key] ?? {};
	}
	update(key: string, patch: HistoryMetadata): Promise<void> {
		this.active();
		const result = this.tail.then(async () => {
			await this.loaded;
			const next = { ...this.metadata, [key]: { ...this.meta(key), ...patch } };
			await this.store.save(next);
			this.metadata = next;
			this.metadataVersion++;
			this.changed();
		});
		this.tail = result.catch(() => {});
		return result;
	}
	private async scope() {
		const [path, , fs] = await nodeModules();
		const adapter = this.app.vault.adapter as unknown as { getBasePath(): string };
		const vault = await fs.realpath(adapter.getBasePath());
		const device = getDeviceId(this.app);
		return { vault, index: path.join(vault, '.nand', 'terminal-agent', device, 'index.sqlite') };
	}

	private async scanScope() {
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
		return { ...scope, roots };
	}
	async scan(signal?: AbortSignal): Promise<string[]> {
		this.active();
		if (signal?.aborted) throw new Error('History request cancelled');
		const scope = await this.scanScope();
		checkCancelled(signal);
		const key = JSON.stringify(scope);
		if (!this.scanRead || this.scanRead.key !== key || this.scanRead.read.abort.signal.aborted) {
			const read = this.createRead(async sharedSignal => {
				const client = await this.service.historyClient();
				checkCancelled(sharedSignal);
				this.observeClient(client);
				const result = await client.request<{ warnings: string[]; revision: number }>('scan', scope, sharedSignal);
				this.indexVersion = result.revision;
				this.scanned = true;
				this.changed();
				return result.warnings;
			});
			this.scanRead = { key, read };
			const clear = () => { if (this.scanRead?.read === read) this.scanRead = undefined; };
			void read.promise.then(clear, clear);
		}
		return consume(this.scanRead.read, signal);
	}
	refresh(signal?: AbortSignal): Promise<string[]> {
		// Explicit refresh always enumerates every configured root. A concurrent
		// leaf shares that same scan instead of launching another traversal.
		return this.scan(signal);
	}
	async query(query = '', offset = 0, signal?: AbortSignal, filter = 'all'): Promise<HistoryPage> {
		this.active();
		await this.loaded;
		if (signal?.aborted) throw new Error('History request cancelled');
		const scope = await this.scanScope();
		checkCancelled(signal);
		const client = await this.service.historyClient();
		checkCancelled(signal);
		this.observeClient(client);
		const key = JSON.stringify([scope, this.revision, this.clientRevision, query, offset, filter]);
		let read = this.pages.get(key);
		if (!read || read.abort.signal.aborted) {
			const metadata = this.metadata;
			read = this.createRead(async sharedSignal => client.request<HistoryPage>(
				'query', { vault: scope.vault, index: scope.index, query, offset, filter, metadata }, sharedSignal,
			));
			this.pages.set(key, read);
			const current = read;
			void read.promise.catch(() => { if (this.pages.get(key) === current) this.pages.delete(key); });
			if (this.pages.size > 32) {
				const oldest: unknown = this.pages.keys().next().value;
				if (typeof oldest === 'string') this.pages.delete(oldest);
			}
		}
		return consume(read, signal);
	}
	async usage(signal?: AbortSignal): Promise<NativeUsage> {
		return (await this.query('', 0, signal, 'all')).usage;
	}
	async read(session: NativeSessionSummary, signal?: AbortSignal): Promise<NativeSession> {
		this.active();
		const scope = await this.scope();
		checkCancelled(signal);
		return consume(this.createRead(async sharedSignal => {
			const client = await this.service.historyClient();
			checkCancelled(sharedSignal);
			this.active();
			return client.request<NativeSession>('read', { ...scope, key: session.key }, sharedSignal);
		}), signal);
	}
	async export(session: NativeSessionSummary): Promise<TFile> {
		let full: NativeSession;
		try {
			await this.loaded;
			full = await this.read(session);
		} catch (error) {
			throw new Error(t('workbench.exportReadFailed', { message: error instanceof Error ? error.message : String(error) }));
		}
		try {
			const vault = this.app.vault, folder = 'NAND Exports';
			if (!vault.getAbstractFileByPath(folder)) {
				try { await vault.createFolder(folder); }
				catch (error) { if (!(vault.getAbstractFileByPath(folder) instanceof TFolder)) throw error; }
			}
			if (!(vault.getAbstractFileByPath(folder) instanceof TFolder)) throw new Error(t('workbench.exportFolderConflict'));
			const agent = session.agentId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32) || 'agent';
			const id = session.sessionId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 96) || 'session';
			const content = `# ${this.meta(session.key).title || session.title}\n\n${full.text}`;
			for (let index = 0; index < 1000; index++) {
				const path = `${folder}/${agent}-${id}${index ? ` (${index + 1})` : ''}.md`;
				if (vault.getAbstractFileByPath(path)) continue;
				try { return await vault.create(path, content); }
				catch (error) {
					// A simultaneous export can claim this name; Vault.create never overwrites it.
					if (!vault.getAbstractFileByPath(path)) throw error;
				}
			}
			throw new Error(t('workbench.exportNameUnavailable'));
		} catch (error) {
			throw new Error(t('workbench.exportWriteFailed', { message: error instanceof Error ? error.message : String(error) }));
		}
	}
}
