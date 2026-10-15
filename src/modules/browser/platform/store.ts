import type { App } from 'obsidian';
import type { BrowserHistoryEntry } from '../core/model';
import { recordHistory } from '../core/url';
import { DurableState } from '../../../shared/storage/durable-state';
import { deviceId, vaultIdentity } from '../../../host/obsidian/storage/device-id';
import { privateVaultStorage } from '../../../host/obsidian/storage/private-storage';
interface BrowserData {
	history: BrowserHistoryEntry[];
	permissions: Record<string, boolean>;
}
export class BrowserStore {
	readonly vaultId: string;
	readonly ready: Promise<void>;
	private repository: DurableState<BrowserData>;
	constructor(app: App, changed: () => void = () => undefined) {
		const identity = vaultIdentity(app);
		this.vaultId = identity.legacyBrowserVaultId ?? identity.vaultId;
		this.repository = new DurableState(
			privateVaultStorage(app),
			`.nand/browser/${deviceId(app)}/state.json`,
			() => ({ history: [], permissions: {} }),
			(value) => {
				const data = value as BrowserData;
				if (!data || !Array.isArray(data.history) || !data.permissions || typeof data.permissions !== 'object')
					throw new Error('Invalid browser state');
				return data;
			},
			changed,
		);
		this.ready = this.repository.sync(true);
		void this.ready.catch(() => undefined);
	}
	get history(): BrowserHistoryEntry[] {
		return this.repository.value.history;
	}
	get permissions(): Record<string, boolean> {
		return this.repository.value.permissions;
	}
	record(url: string, title: string): void {
		if (url === 'about:blank') return;
		// Native title/navigation events repeat while a Document migration recreates
		// the same page. This is still the same visit, including its transient blank
		// title; do not queue another disk write while the source window closes.
		const latest = this.history[0];
		if (latest?.url === url && (!title || latest.title === title)) return;
		this.repository.value = {
			...this.repository.value,
			history: recordHistory(this.history, { url, title, visitedAt: Date.now() }),
		};
		this.repository.save();
	}
	async grant(origin: string, permission: string, allowed: boolean): Promise<void> {
		await this.ready;
		this.repository.value = {
			...this.repository.value,
			permissions: { ...this.permissions, [origin + '|' + permission]: allowed },
		};
		this.repository.save();
		await this.repository.flush();
	}
	async removeProfilePermissions(id: string): Promise<void> {
		await this.ready;
		this.repository.value = {
			...this.repository.value,
			permissions: Object.fromEntries(
				Object.entries(this.permissions).filter(([key]) => !key.startsWith(id + '|')),
			),
		};
		this.repository.save();
		await this.repository.flush();
	}
	clearHistory(): void {
		this.repository.value = { ...this.repository.value, history: [] };
		this.repository.save();
	}
	shutdown(): Promise<void> {
		return this.repository.shutdown();
	}
}
