import type { BrowserWorkbenchPort } from './page-host';
import { Platform, type App } from 'obsidian';
import {
	BrowserError,
	newPageState,
	type BrowserAgentDeliveryPort,
	type BrowserOpenRequest,
	type BrowserPageState,
	type BrowserSettings,
} from '../core/model';
import { normalizeBrowserUrl } from '../core/url';
import { electronBrowserApi } from '../platform/desktop/electron-api';
import { BrowserPage } from '../platform/desktop/page';
import { BrowserStore } from '../platform/store';
import type { BrowserHost } from './page-host';
import { BrowserProfileStore } from '../platform/profile-store';
import { DEFAULT_PROFILE, profilePartition, type BrowserProfile, type ProfilePage } from '../core/profiles';
import { privateVaultStorage } from '../../../host/obsidian/storage/private-storage';
import { deviceId } from '../../../host/obsidian/storage/device-id';


export class BrowserModule implements BrowserHost {
	private active = false;
	private listeners = new Set<() => void>();
	private pages = new Map<string, BrowserPage>();
	private presentations = new Map<string, { activate: () => Promise<void>; close: () => void | Promise<void>; state?: () => BrowserPageState }>();
	presentationExists(id: string): boolean { return this.presentations.has(id); }
	private modals = new Set<{ close(): void }>();
	private generation = 0;
	private readonly store: BrowserStore;
	private readonly profileStore: BrowserProfileStore;
	readonly ready: Promise<void>;
	private pendingPages = new Map<string, { state: BrowserPageState; done: Promise<void> }>();
	private profileOperations = new Set<Promise<void>>();
	constructor(
		readonly app: App,
		readonly settings: () => BrowserSettings,
		readonly agents: BrowserAgentDeliveryPort,
		/** Opens browser pages as workbench pages (and focus-mode tabs); the workbench owns their placement. */
		private readonly workbench: BrowserWorkbenchPort,
		/** Opens a page in a dialog (the dialog UI loads on first use). */
		private readonly openModal: (state: BrowserPageState, closed: () => void) => Promise<{ close(): void }>,
	) {
		const changed = () => {
			for (const page of this.pages.values()) page.updatePermissions();
			for (const listener of this.listeners) listener();
		};
		this.store = new BrowserStore(app, changed);
		this.profileStore = new BrowserProfileStore(privateVaultStorage(app), `.nand/browser/${deviceId(app)}/profiles.json`, changed);
		this.ready = Promise.all([this.store.ready, this.profileStore.ready]).then(() => undefined);
		void this.ready.catch(() => undefined);
	}
	profiles(): BrowserProfile[] { return this.profileStore.list(); }
	private requireProfile(id: string): BrowserProfile {
		if (!this.active) throw new BrowserError('browser_disabled');
		const profile = this.profileStore.get(id);
		if (profile.state !== 'ready') throw new BrowserError('browser_profile_deleting');
		return profile;
	}
	async createProfile(label: string): Promise<BrowserProfile> {
		if (!this.active) throw new BrowserError('browser_disabled');
		return this.profileStore.create(label);
	}
	async renameProfile(id: string, label: string): Promise<void> {
		this.requireProfile(id);
		await this.profileStore.rename(id, label);
	}
	profilePages(id: string): ProfilePage[] {
		const states = [...this.workbench.list(), ...[...this.pendingPages.values()].map(row => row.state), ...[...this.pages.values()].map(page => page.state)];
		return [...new Map(states.filter(state => (state.profileId ?? DEFAULT_PROFILE) === id).map(state => [state.id, { id: state.id, title: state.title, url: state.url }])).values()];
	}
	removeProfile(id: string, confirmedPageIds: readonly string[]): Promise<void> {
		const operation = this.deleteProfile(id, confirmedPageIds);
		this.profileOperations.add(operation);
		void operation.finally(() => this.profileOperations.delete(operation)).catch(() => undefined);
		return operation;
	}
	private async deleteProfile(id: string, confirmedPageIds: readonly string[]): Promise<void> {
		if (!this.active) throw new BrowserError('browser_disabled');
		const generation = this.generation;
		const ensureActive = () => {
			if (!this.active || generation !== this.generation) throw new BrowserError('browser_disabled');
		};
		if (this.profileStore.get(id).kind === 'default') throw new BrowserError('browser_profile_default');
		const affected = this.profilePages(id).map(page => page.id).sort();
		if (JSON.stringify(affected) !== JSON.stringify([...confirmedPageIds].sort())) throw new BrowserError('browser_profile_pages_changed');
		// Persist deletion intent before touching guests or account storage. Interrupted deletion can be retried.
		await this.profileStore.markDeleting(id);
		ensureActive();
		await Promise.allSettled([...this.pendingPages.values()].filter(page => page.state.profileId === id).map(page => page.done));
		for (const page of this.profilePages(id)) {
			ensureActive();
			await this.presentations.get(page.id)?.close();
			await this.workbench.close(page.id);
		}
		ensureActive();
		const { acquireVaultSession } = await import('../../../host/desktop/browser-session');
		const lease = await acquireVaultSession(this.app, this.app.workspace.containerEl.win, { profile: id, legacyPartition: profilePartition(this.store.vaultId, id) });
		try {
			ensureActive(); await lease.session.clearStorageData();
			ensureActive(); await lease.session.clearCache();
			ensureActive(); await lease.clearRecovery();
		} finally { lease.dispose(); }
		ensureActive();
		await this.profileStore.remove(id);
	}
	permissions(profileId = DEFAULT_PROFILE): Record<string, boolean> {
		return profileId === DEFAULT_PROFILE ? { ...this.store.permissions } : this.profileStore.permissions(profileId);
	}
	async grantPermission(origin: string, permission: string, allowed: boolean, profileId = DEFAULT_PROFILE): Promise<void> {
		this.requireProfile(profileId);
		if (profileId === DEFAULT_PROFILE) await this.store.grant(origin, permission, allowed);
		else await this.profileStore.grant(profileId, origin, permission, allowed);
		for (const page of this.pages.values()) page.updatePermissions();
	}
	enabled(): boolean {
		return this.active;
	}
	history() {
		return this.store.history;
	}
	subscribe(fn: () => void): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}
	setEnabled(value: boolean): void {
		if (value === this.active) return;
		this.active = value;
		if (!value) {
			this.generation++;
			for (const modal of [...this.modals]) modal.close();
			for (const page of this.pages.values()) page.dispose();
			this.pages.clear();
		}
		for (const listener of this.listeners) listener();
	}
	createPage(
		state: BrowserPageState,
		container: HTMLElement,
		changed: (state: BrowserPageState) => void,
	): BrowserPage {
		if (!this.active) throw new BrowserError('browser_disabled');
		if (this.pages.has(state.id)) throw new BrowserError('browser_duplicate_page');
		const profileId = state.profileId ?? DEFAULT_PROFILE;
		this.requireProfile(profileId);
		const page = new BrowserPage({ ...state }, container, async () => {
			const { acquireVaultSession } = await import('../../../host/desktop/browser-session');
			return acquireVaultSession(this.app, container.win, { profile: profileId, legacyPartition: profilePartition(this.store.vaultId, profileId) });
		}, {
			permissions: () => this.permissions(profileId),
			changed,
			visited: (url, title) => this.store.record(url, title),
			open: (url) => {
				void this.openInWindow({ url, profileId }, container.win).catch((error: unknown) => {
					page.state.error = String(error);
					page.emit();
				});
			},
		});
		this.pages.set(state.id, page);
		return page;
	}
	releasePage(id: string): void {
		this.pages.get(id)?.dispose();
		this.pages.delete(id);
	}
	registerPresentation(id: string, activate: () => Promise<void>, close: () => void | Promise<void>, state?: () => BrowserPageState): () => void {
		if (this.presentations.has(id)) throw new BrowserError('browser_duplicate_page');
		const value = { activate, close, state };
		this.presentations.set(id, value);
		return () => {
			if (this.presentations.get(id) === value) this.presentations.delete(id);
		};
	}
	open(request: BrowserOpenRequest): Promise<string> { return this.openInWindow(request); }
	async openInWindow(request: BrowserOpenRequest, ownerWindow?: Window): Promise<string> {
		const url = normalizeBrowserUrl(request.url ?? '', this.settings().searchEngine);
		if (!Platform.isDesktopApp) {
			if (url !== 'about:blank') (ownerWindow ?? this.app.workspace.containerEl.win).open(url, '_blank');
			return '';
		}
		if (!this.active) throw new BrowserError('browser_disabled');
		const profileId = request.profileId ?? DEFAULT_PROFILE;
		this.requireProfile(profileId);
		if (request.reuse) {
			const existing = [...this.pages.values()].find((page) => page.state.url === url && page.profileId === profileId);
			if (existing) {
				await this.activate(existing.state.id);
				return existing.state.id;
			}
		}
		const state = newPageState(crypto.randomUUID(), {
			url, profileId,
			zoom: request.zoom,
			title: request.title,
			scroll: request.scroll,
		});

		let finish!: () => void;
		const generation = this.generation;
		this.pendingPages.set(state.id, { state, done: new Promise<void>(resolve => { finish = resolve; }) });
		try {
			if (request.target === 'modal') {
				let modal: { close(): void } | undefined;
				modal = await this.openModal(state, () => { if (modal) this.modals.delete(modal); });
				if (generation !== this.generation) { modal.close(); throw new BrowserError('browser_disabled'); }
				this.modals.add(modal);
			} else {
				if (request.target === 'tab') await this.workbench.openTab(state, ownerWindow);
				else await this.workbench.open(state, ownerWindow);
			}
			const page = this.pages.get(state.id);
			if (!page) throw new BrowserError('browser_unavailable');
			await page.ready;
			await page.initialLoad;
			if (generation !== this.generation) throw new BrowserError('browser_disabled');
			return state.id;
		} finally { this.pendingPages.delete(state.id); finish(); }
	}

	async activate(id: string): Promise<void> {
		const p = this.presentations.get(id);
		if (!p) throw new BrowserError('browser_tab_not_found');
		await p.activate();
	}
	copyText(text: string): void {
		electronBrowserApi(this.app.workspace.containerEl.win).clipboard.writeText(text);
	}
	copyImage(data: string): void {
		const api = electronBrowserApi(this.app.workspace.containerEl.win);
		api.clipboard.writeImage(api.nativeImage.createFromDataURL(data));
	}
	async saveImage(data: string, context?: string): Promise<string[]> {
		if (!this.active) throw new BrowserError('browser_disabled');
		return (await import('../platform/desktop/image-artifacts')).saveBrowserImage(this.app, data, context);
	}
	async dispose(): Promise<void> {
		this.setEnabled(false);
		this.listeners.clear();
		this.presentations.clear();
		await Promise.allSettled([...this.profileOperations]);
		await Promise.all([this.store.shutdown(), this.profileStore.shutdown()]);
	}
}
