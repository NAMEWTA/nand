import { contentFiles, type ContentFile } from '../../../../host/obsidian/storage/content-files';
import { deviceId as getDeviceId } from '../../../../host/obsidian/storage/device-id';
import { privateVaultStorage } from '../../../../host/obsidian/storage/private-storage';
import type { App } from 'obsidian';
import type { AgentId, AgentSettings } from '../../core/launch/types';
import { t } from '../../../../shared/i18n/index';
import { JsonStore } from '../../../../shared/json-store';
import { accountEnv, historyAccountEnv } from '../desktop/agents/accounts';
import { accountPaths, historyBase, historySource, isSystemAccount } from '../desktop/agents/system-homes';
import { legacyReferences } from '../desktop/agents/legacy-references';
import { AGENT_CATALOG } from '../../core/launch/catalog';
import { readHistoryDetails } from '../desktop/history/details';
import { historyNodeModules } from '../desktop/history/node-modules';
import { absoluteNandPath } from '../../../../host/desktop/nand-paths';
import type { HistoryClient, HistoryClientSource, HistoryPage, NativeSession, NativeSessionSummary, NativeUsage } from '../desktop/server/agent-data-client';
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
/** The provider directories a system account may read; the helper accepts a system session only inside one of them. */
function systemBases(roots: ReadonlyArray<{ systemBase?: string }>): string[] {
	return [...new Set(roots.flatMap(root => root.systemBase ? [root.systemBase] : []))];
}
/** The history sources of system accounts, which the helper must also see named before trusting an indexed row. */
function systemRoots(roots: ReadonlyArray<{ path: string; systemBase?: string }>): string[] {
	return [...new Set(roots.flatMap(root => root.systemBase ? [root.path] : []))];
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
	private accountAliases = new Map<string, string>();
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
	private preparingScope?: { key: string; promise: ReturnType<NativeHistory['loadScanScope']> };
	private pages = new Map<string, SharedRead<HistoryPage>>();
	private reads = new Set<AbortController>();
	private client?: HistoryClient;
	private clientRevision = 0;
	private unsubscribeClient?: () => void;
	private disposed = false;
	constructor(
		private app: App,
		private service: HistoryClientSource,
		private settings: () => AgentSettings,
  private accounts: () => Partial<Record<AgentId,string[]>> = () => ({}),
	) {
		const device = getDeviceId(app);
		this.store = new JsonStore(
			privateVaultStorage(app),
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
	private observeClient(client: HistoryClient): void {
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
		return this.mappedMetadata()[key] ?? {};
	}
	private mappedMetadata(): Record<string, HistoryMetadata> {
		const result = { ...this.metadata };
		for (const [key, metadata] of Object.entries(this.metadata)) {
			let tuple: unknown;
			try { tuple = JSON.parse(key); } catch { continue; }
			if (!Array.isArray(tuple) || tuple.length !== 3 || !tuple.every(value => typeof value === 'string')) continue;
			const replacement = this.accountAliases.get(JSON.stringify([tuple[0], tuple[1]]));
			if (!replacement) continue;
			const mapped = JSON.stringify([tuple[0], replacement, tuple[2]]);
			result[mapped] = { ...metadata, ...result[mapped] };
		}
		return result;
	}
	update(key: string, patch: HistoryMetadata): Promise<void> {
		this.active();
		const result = this.tail.then(async () => {
			await this.loaded;
			const next = { ...this.metadata, [key]: { ...this.meta(key), ...patch } };
			this.metadata = await this.store.commit({ base: this.metadata, value: next });
			this.metadataVersion++;
			this.changed();
		});
		this.tail = result.catch(() => {});
		return result;
	}
	private async scope() {
		const [path, , fs] = await historyNodeModules();
		const adapter = this.app.vault.adapter as unknown as { getBasePath(): string };
		const vault = await fs.realpath(adapter.getBasePath());
		const device = getDeviceId(this.app);
		return { vault, index: path.join(vault, '.nand', 'terminal-agent', device, 'index.sqlite') };
	}

	private scanScope() {
		const settings = structuredClone(this.settings()), accounts = structuredClone(this.accounts()), key = JSON.stringify([settings,accounts]);
		if (this.preparingScope?.key === key) return this.preparingScope.promise;
		const promise = this.loadScanScope(settings,accounts).finally(() => { if (this.preparingScope?.promise === promise) this.preparingScope = undefined; });
		this.preparingScope = { key, promise };
		return promise;
	}
	private async loadScanScope(settings: AgentSettings, accounts: Partial<Record<AgentId,string[]>>) {
		const [path] = await historyNodeModules();
		const scope = await this.scope(), roots = [], warnings: string[] = [], aliases = new Map<string, string>();
		for (const agent of AGENT_CATALOG) for (const name of new Set(['',settings.agents[agent.id].accountId,...(accounts[agent.id] ?? [])])) {
			try {
			const device = getDeviceId(this.app), env = await accountEnv(agent, name, scope.vault, device), system = isSystemAccount(env);
			const paths = accountPaths(env);
			// A managed account's sources are confined to the vault; the system account reads the provider's own directory.
			const source = system ? historySource(agent.id, paths) : await absoluteNandPath(scope.vault, path.relative(scope.vault, historySource(agent.id, paths)).split(path.sep).join('/'));
			const keyEnv = await historyAccountEnv(agent, env, scope.vault, device);
			roots.push({ agentId: agent.id, path: source, accountKey: JSON.stringify(keyEnv), ...(system ? { systemBase: historyBase(agent.id, paths) } : {}) });
			const references = system ? [] : await legacyReferences(scope.vault, device, agent.id);
			for (const reference of references) if (reference.name === keyEnv.NAND_ACCOUNT_NAME && references.filter(row => row.from === reference.from).length === 1)
				aliases.set(JSON.stringify([agent.id, JSON.stringify(reference.env)]), JSON.stringify(keyEnv));
			} catch (error) { warnings.push(agent.title + ': ' + (error instanceof Error ? error.message : String(error))); }
		}
		this.accountAliases = aliases;
		return { ...scope, roots, warnings, scope: 'account' };
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
				return [...scope.warnings, ...result.warnings];
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
	async query(query = '', offset = 0, signal?: AbortSignal, filter = 'all', historyScope: 'account' | 'vault' = 'account'): Promise<HistoryPage> {
		this.active();
		await this.loaded;
		if (signal?.aborted) throw new Error('History request cancelled');
		const scope = await this.scanScope();
		checkCancelled(signal);
		const client = await this.service.historyClient();
		checkCancelled(signal);
		this.observeClient(client);
		const key = JSON.stringify([scope, this.revision, this.clientRevision, query, offset, filter, historyScope]);
		let read = this.pages.get(key);
		if (!read || read.abort.signal.aborted) {
			const metadata = this.mappedMetadata();
			read = this.createRead(async sharedSignal => client.request<HistoryPage>(
				'query', { vault: scope.vault, index: scope.index, query, offset, filter, metadata, scope: historyScope, systemBases: systemBases(scope.roots), systemRoots: systemRoots(scope.roots) }, sharedSignal,
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
		const scope = await this.scope(), systemBase = systemBases((await this.scanScope()).roots);
		checkCancelled(signal);
		return consume(this.createRead(async sharedSignal => {
			const client = await this.service.historyClient();
			checkCancelled(sharedSignal);
			this.active();
			return client.request<NativeSession>('read', { ...scope, key: session.key, scope: 'account', systemBases: systemBase, systemRoots: systemRoots((await this.scanScope()).roots) }, sharedSignal);
		}), signal);
	}
 async details(session: NativeSessionSummary, text: string, signal: AbortSignal) {
  return readHistoryDetails(session,(await this.scope()).vault,getDeviceId(this.app),text,signal);
 }
	async export(session: NativeSessionSummary): Promise<ContentFile> {
		let full: NativeSession;
		try {
			await this.loaded;
			full = await this.read(session);
		} catch (error) {
			throw new Error(t('agent.exportReadFailed', { message: error instanceof Error ? error.message : String(error) }));
		}
		try {
			const files = contentFiles(this.app), folder = '.nand/content/NAND Exports';
			await files.mkdir(folder);
			const agent = session.agentId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32) || 'agent';
			const id = session.sessionId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 96) || 'session';
			const content = `# ${this.meta(session.key).title || session.title}\n\n${full.text}`;
			for (let index = 0; index < 1000; index++) {
				const path = `${folder}/${agent}-${id}${index ? ` (${index + 1})` : ''}.md`;
				if (files.getAbstractFileByPath(path)) continue;
				try { return await files.create(path, content); }
				catch (error) {
					// A simultaneous export can claim this name; Vault.create never overwrites it.
					if (!files.getAbstractFileByPath(path)) throw error;
				}
			}
			throw new Error(t('agent.exportNameUnavailable'));
		} catch (error) {
			throw new Error(t('agent.exportWriteFailed', { message: error instanceof Error ? error.message : String(error) }));
		}
	}
}
