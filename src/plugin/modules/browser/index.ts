import type { BrowserWorkbenchPort } from './workbench-port';
import { Platform, type App } from 'obsidian';
import {
	BROWSER_VIEW_TYPE,
	BrowserError,
	newPageState,
	type BrowserAgentDeliveryPort,
	type BrowserAutomationPort,
	type BrowserOpenRequest,
	type BrowserPageState,
	type BrowserSettings,
} from '../../../core/browser/model';
import { normalizeBrowserUrl } from '../../../core/browser/url';
import { BrowserBridge } from '../../../platform/desktop/browser/bridge';
import { electronBrowserApi } from '../../../platform/desktop/browser/electron-api';
import { BrowserPage } from '../../../platform/desktop/browser/page';
import { BrowserStore } from '../../../platform/obsidian/browser/store';
import { BrowserModal } from '../../../view/browser/browser-modal';
import { BrowserView } from '../../../view/browser/browser-view';
import type { BrowserHost } from '../../../view/browser/host';

export class BrowserModule implements BrowserHost, BrowserAutomationPort {
	private active = false;
	private listeners = new Set<() => void>();
	private pages = new Map<string, BrowserPage>();
	private presentations = new Map<string, { activate: () => Promise<void>; close: () => void | Promise<void>; state?: () => BrowserPageState }>();
	private workbench?: BrowserWorkbenchPort;
	setWorkbench(port: BrowserWorkbenchPort | undefined): void { this.workbench = port; }
	presentationExists(id: string): boolean { return this.presentations.has(id); }
	private modals = new Set<BrowserModal>();
	private bridge?: BrowserBridge;
	private bridgeReady?: Promise<BrowserBridge>;
	private generation = 0;
	private readonly store: BrowserStore;
	constructor(
		readonly app: App,
		readonly settings: () => BrowserSettings,
		readonly agents: BrowserAgentDeliveryPort,
	) {
		this.store = new BrowserStore(app, () => {
			for (const page of this.pages.values()) page.updatePermissions();
			for (const listener of this.listeners) listener();
		});
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
	async environment(): Promise<Record<string, string>> {
		return this.active && Platform.isDesktopApp ? (await this.ensureBridge()).environment : {};
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
		const page = new BrowserPage({ ...state }, container, `persist:nand-browser-${this.store.vaultId}`, {
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
			const modal = new BrowserModal(this, state, () => this.modals.delete(modal));
			this.modals.add(modal);
			modal.open();
		} else if (this.workbench && request.target !== 'tab') {
			await this.workbench.open(state, ownerWindow);
		} else {
			const leaf = this.app.workspace.getLeaf('tab');
			await leaf.setViewState({ type: BROWSER_VIEW_TYPE, active: true, state: { ...state } });
			await this.app.workspace.revealLeaf(leaf);
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
			for (const state of this.workbench?.list() ?? []) if (!live.some((row) => row.id === state.id)) live.push(state);
			for (const leaf of this.app.workspace.getLeavesOfType(BROWSER_VIEW_TYPE)) {
				const state = leaf.getViewState().state as Partial<BrowserPageState> | undefined;
				if (state?.id && !live.some((row) => row.id === state.id)) live.push(newPageState(state.id, state));
			}
			return { tabs: live };
		}
		if (method === 'tab.create')
			return { page: await this.open({ url: typeof params.url === 'string' ? params.url : '' }) };
		const id = typeof params.page === 'string' ? params.page : '';
		if (!id) throw new BrowserError('browser_page_required');
		if (!this.presentations.has(id)) await this.workbench?.activate(id);
		if (!this.presentations.has(id)) {
			const leaf = this.app.workspace
				.getLeavesOfType(BROWSER_VIEW_TYPE)
				.find((l) => l.getViewState().state?.id === id);
			if (leaf) {
				await this.app.workspace.revealLeaf(leaf);
				if (leaf.view instanceof BrowserView) leaf.view.onResize();
			}
		}
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
		this.workbench = undefined;
		void this.store.shutdown().catch(error => console.error('[NAND browser storage]', error));
	}
}
