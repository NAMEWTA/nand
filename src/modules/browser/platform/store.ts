import type { App } from 'obsidian';
import type { BrowserHistoryEntry } from '../core/model';
import { recordHistory } from '../core/url';
import { DurableState } from '../../../shared/storage/durable-state';
import { deviceId } from '../../../host/obsidian/storage/device-id';
import { privateStorageIfDesktop } from '../../../host/private-storage';
import type { TextStorage } from '../../../shared/storage/ports';
interface BrowserData { history: BrowserHistoryEntry[]; permissions: Record<string, boolean> }
export class BrowserStore {
	readonly vaultId: string;
	readonly ready: Promise<void>;
	private repository: DurableState<BrowserData>;
	constructor(app: App, changed: () => void = () => undefined) {
		const saved: unknown = app.loadLocalStorage('nand.browser.vault-id');
		this.vaultId = typeof saved === 'string' && /^[a-z\d-]{36}$/.test(saved) ? saved : crypto.randomUUID();
		app.saveLocalStorage('nand.browser.vault-id', this.vaultId);
		const adapter = app.vault.adapter as unknown as TextStorage & { getBasePath?: () => string };
		const root = typeof adapter.getBasePath === 'function' ? adapter.getBasePath() : '';
		this.repository = new DurableState(privateStorageIfDesktop(adapter, root), `.nand/browser/${deviceId(app)}/state.json`,
			() => ({ history: [], permissions: {} }), value => {
				const data = value as BrowserData;
				if (!data || !Array.isArray(data.history) || !data.permissions || typeof data.permissions !== 'object') throw new Error('Invalid browser state');
				return data;
			}, changed);
		this.ready = this.repository.load();
	}
	get history(): BrowserHistoryEntry[] { return this.repository.value.history; }
	get permissions(): Record<string, boolean> { return this.repository.value.permissions; }
	record(url: string, title: string): void {
		this.repository.value = { ...this.repository.value, history: recordHistory(this.history, { url, title, visitedAt: Date.now() }) };
		this.repository.save();
	}
	async grant(origin: string, permission: string, allowed: boolean): Promise<void> {
		await this.ready;
		this.repository.value = { ...this.repository.value, permissions: { ...this.permissions, [origin + '|' + permission]: allowed } };
		this.repository.save();
		await this.repository.flush();
	}
	shutdown(): Promise<void> { return this.repository.shutdown(); }
}
