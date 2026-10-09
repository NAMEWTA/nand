import type { BrowserWorkbenchPort } from './workbench-port';
import { Platform, type App } from 'obsidian';
import {
	BrowserError,
	newPageState,
	type BrowserAgentDeliveryPort,
	type BrowserAutomationPort,
	type BrowserOpenRequest,
	type BrowserPageState,
	type BrowserSettings,
} from '../core/model';
import { normalizeBrowserUrl } from '../core/url';
import { BrowserBridge } from '../platform/desktop/bridge';
import { electronBrowserApi } from '../platform/desktop/electron-api';
import { BrowserPage } from '../platform/desktop/page';
import { pageSitePort } from '../platform/desktop/site-port';
import { BrowserStore } from '../platform/store';
import type { AgentPromptRunner } from '../../agent/api';
import { AiWorkspace } from './ai-workspace';
import type { BrowserHost } from './page-host';

export class BrowserModule implements BrowserHost, BrowserAutomationPort {
	private active = false;
	private listeners = new Set<() => void>();
	private pages = new Map<string, BrowserPage>();
	private presentations = new Map<string, { activate: () => Promise<void>; close: () => void | Promise<void>; state?: () => BrowserPageState }>();
	presentationExists(id: string): boolean { return this.presentations.has(id); }
	private modals = new Set<{ close(): void }>();
	private bridge?: BrowserBridge;
	private bridgeReady?: Promise<BrowserBridge>;
	private generation = 0;
	private readonly store: BrowserStore;
	readonly workspace: AiWorkspace;
	promptRunner?: () => AgentPromptRunner | undefined;
	constructor(
		readonly app: App,
		readonly settings: () => BrowserSettings,
		readonly agents: BrowserAgentDeliveryPort,
		/** Opens browser pages as workbench pages (and focus-mode tabs); the workbench owns their placement. */
		private readonly workbench: BrowserWorkbenchPort,
		/** Opens a page in a dialog (the dialog UI loads on first use). */
		private readonly openModal: (state: BrowserPageState, closed: () => void) => Promise<{ close(): void }>,
	) {
		this.store = new BrowserStore(app, () => {
			for (const page of this.pages.values()) page.updatePermissions();
			for (const listener of this.listeners) listener();
		});
		this.workspace = new AiWorkspace(pageSitePort(() => this.latestPage()), () => this.promptRunner?.());
	}
	private latestPage(): BrowserPage | undefined {
		return [...this.pages.values()].at(-1);
	}
	permissions(): Record<string, boolean> { return { ...this.store.permissions }; }
	async grantPermission(origin: string, permission: string, allowed: boolean): Promise<void> {
		await this.store.grant(origin, permission, allowed);
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
			this.bridge?.dispose();
			this.bridge = undefined;
			this.bridgeReady = undefined;
			for (const modal of [...this.modals]) modal.close();
			for (const page of this.pages.values()) page.dispose();
			this.pages.clear();
		}
		for (const listener of this.listeners) listener();
	}
	async ensureBridge(): Promise<BrowserBridge> {
		if (!this.active || !Platform.isDesktopApp) throw new BrowserError('browser_disabled');
		if (!this.bridgeReady) {
			const generation = this.generation;
			const bridge = new BrowserBridge(
				this.app.workspace.containerEl.win,
				electronBrowserApi(this.app.workspace.containerEl.win),
				this.store.vaultId,
				this,
			);
			this.bridge = bridge;
			this.bridgeReady = bridge
				.start()
				.then(() => {
					if (generation !== this.generation) {
						bridge.dispose();
						throw new BrowserError('browser_disabled');
					}
					return bridge;
				})
				.catch((error: unknown) => {
					if (this.bridge === bridge) {
						this.bridgeReady = undefined;
						this.bridge = undefined;
					}
					bridge.dispose();
					throw error;
				});
		}
		return this.bridgeReady;
	}
	/** Bridge variables for a new agent terminal; empty (and no bridge started) unless agent access is on. */
	async environment(): Promise<Record<string, string>> {
		return this.active && Platform.isDesktopApp && this.settings().agentAccess ? (await this.ensureBridge()).environment : {};
	}
	async connectionCommand(): Promise<string> {
		const bridge = await this.ensureBridge();
		const quote = (value: string) =>
			`'${Platform.isWin ? value.replace(/'/g, "''") : value.replace(/'/g, "'\\''")}'`;
		const token = quote(bridge.environment.NAND_BROWSER_TOKEN!);
		const environment = Platform.isWin ? `$env:NAND_BROWSER_TOKEN=${token}; ` : `NAND_BROWSER_TOKEN=${token} `;
		return `${environment}node ${quote(bridge.cliPath)} tab list --connection ${quote(bridge.contextPath)}`;
	}
	createPage(
		state: BrowserPageState,
		container: HTMLElement,
		changed: (state: BrowserPageState) => void,
	): BrowserPage {
		if (!this.active) throw new BrowserError('browser_disabled');
		if (this.pages.has(state.id)) throw new BrowserError('browser_duplicate_page');
		const profile = this.workspace.activeProfile();
		const partition = profile.kind === 'isolated' ? profile.partition : `persist:nand-browser-${this.store.vaultId}`;
		const page = new BrowserPage({ ...state }, container, partition, {
			permissions: () => this.store.permissions,
			changed,
			visited: (url, title) => this.store.record(url, title),
			open: (url) => {
				void this.openInWindow({ url }, container.win).catch((error: unknown) => {
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
		if (request.reuse) {
			const existing = [...this.pages.values()].find((page) => page.state.url === url);
			if (existing) {
				await this.activate(existing.state.id);
				return existing.state.id;
			}
		}
		const state = newPageState(crypto.randomUUID(), {
			url,
			zoom: request.zoom,
			title: request.title,
			scroll: request.scroll,
		});
		if (request.target === 'modal') {
			let modal: { close(): void } | undefined;
			modal = await this.openModal(state, () => { if (modal) this.modals.delete(modal); });
			this.modals.add(modal);
		} else {
			if (request.target === 'tab') await this.workbench.openTab(state, ownerWindow);
			else await this.workbench.open(state, ownerWindow);
		}
		const page = this.pages.get(state.id);
		if (!page) throw new BrowserError('browser_unavailable');
		await page.ready;
		await page.initialLoad;
		return state.id;
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
		return (await this.ensureBridge()).writeArtifact(data, context);
	}
	async execute(method: string, params: Record<string, unknown>): Promise<unknown> {
		if (!this.active) throw new BrowserError('browser_disabled');
		if (method === 'tab.list') {
			const live = [...this.pages.values()].map((page) => ({ ...page.state }));
			for (const state of this.workbench.list()) if (!live.some((row) => row.id === state.id)) live.push(state);
			return { tabs: live };
		}
		if (method === 'tab.create')
			return { page: await this.open({ url: typeof params.url === 'string' ? params.url : '' }) };
		const id = typeof params.page === 'string' ? params.page : '';
		if (!id) throw new BrowserError('browser_page_required');
		if (!this.presentations.has(id)) await this.workbench.activate(id);
		if (method === 'tab.close') {
			const presentation = this.presentations.get(id);
			if (!presentation) throw new BrowserError('browser_tab_not_found');
			await presentation.close();
			return { closed: id };
		}
		await this.activate(id);
		if (method === 'tab.switch') return { page: id };
		const page = this.pages.get(id);
		if (!page) throw new BrowserError('browser_tab_not_found');
		await page.ready;
		if (!page.automation) throw new BrowserError('browser_unavailable');
		return page.automation.execute(method, params);
	}
	dispose(): void {
		this.setEnabled(false);
		this.listeners.clear();
		this.presentations.clear();
		void this.store.shutdown().catch(error => console.error('[NAND browser storage]', error));
	}
}
