import { NativeSurface, nativeSurfaces, type NativeSurfaceContext } from '../../../ui/native-surface';
import { Platform, type ViewStateResult } from 'obsidian';
import { render } from 'preact';
import { BROWSER_PAGE_TYPE, newPageState } from '../core/model';
import { normalizeBrowserUrl } from '../core/url';
import { onLeafLanguageChanged, refreshLeafTitle } from '../../../host/obsidian/workspace-title';
import { t } from '../../../shared/i18n';
import { BrowserPanel } from './BrowserPanel';
import type { BrowserHost } from '../services/page-host';

export class BrowserPresentation extends NativeSurface {
	state = newPageState(crypto.randomUUID());
	private opened = false;
	private activated = false;
	private epoch = 0;
	private unregister?: () => void;
	constructor(
		context: NativeSurfaceContext,
		private readonly host: BrowserHost,
	) {
		super(context);
	}
	getViewType(): string {
		return BROWSER_PAGE_TYPE;
	}
	getDisplayText(): string {
		return this.state.title || (this.state.url !== 'about:blank' ? this.state.url : t('browser.title'));
	}
	getIcon(): string {
		return 'globe';
	}
	getState(): Record<string, unknown> {
		return {
			id: this.state.id,
			profileId: this.state.profileId,
			url: this.state.url,
			title: this.state.title,
			zoom: this.state.zoom,
			scroll: this.state.scroll,
		};
	}
	async setState(state: Record<string, unknown>, result: ViewStateResult): Promise<void> {
		if (this.opened) render(null, this.contentEl);
		this.unregister?.(); this.unregister = undefined;
		this.state = newPageState(
			typeof state.id === 'string' && /^[\w-]{1,100}$/.test(state.id) ? state.id : this.state.id,
			state,
		);
		try {
			this.state.url = normalizeBrowserUrl(this.state.url);
		} catch {
			this.state.url = 'about:blank';
			this.state.error = 'browser_invalid_url';
		}

		const occupied = this.host.presentationExists?.(this.state.id) || nativeSurfaces(this.app).some((surface) =>
			surface !== this && surface.getViewType() === BROWSER_PAGE_TYPE && surface.getState().id === this.state.id,
		) || this.app.workspace.getLeavesOfType(BROWSER_PAGE_TYPE).some((leaf) =>
			leaf !== this.leaf && leaf.getViewState().state?.id === this.state.id,
		);
		if (occupied) this.state.id = crypto.randomUUID();
		if (this.opened) this.bindPresentation();
		this.paint();
		await super.setState(state, result);
	}
	onOpen(): Promise<void> {
		this.opened = true;
		this.contentEl.addClass('nand-browser-view');
		this.bindPresentation();
		this.register(this.host.subscribe(() => this.paint()));
		this.register(onLeafLanguageChanged(this.app, this.leaf, () => this.paint()));
		this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.onResize()));
		this.register(
			this.contentEl.onWindowMigrated(() => {
				render(null, this.contentEl);
				this.epoch++;
				this.paint();
			}),
		);
		this.onResize();
		return Promise.resolve();
	}
	private bindPresentation(): void {
		this.unregister?.();
		this.unregister = this.host.registerPresentation(
			this.state.id,
			async () => {
				await this.app.workspace.revealLeaf(this.leaf);
				if (this.context.activate) await this.context.activate();
				this.activated = true;
				this.paint();
			},
			() => this.context.close(),
			() => ({ ...this.state }),
		);
	}
	onResize(): void {
		if (this.contentEl.clientWidth > 0 && this.contentEl.clientHeight > 0) this.activated = true;
		this.paint();
	}
	private paint(): void {
		if (!this.opened) return;
		if (!this.host.enabled() || !Platform.isDesktopApp) {
			render(
				<div class="nand-browser-empty">
					<p>{t(Platform.isDesktopApp ? 'browser.disabled' : 'browser.mobile')}</p>
					{!Platform.isDesktopApp && this.state.url !== 'about:blank' && (
						<a href={this.state.url} target="_blank" rel="noopener noreferrer">
							{t('browser.external')}
						</a>
					)}
				</div>,
				this.contentEl,
			);
			return;
		}
		render(
			<BrowserPanel
				key={`${this.state.id}:${this.epoch}`}
				host={this.host}
				initial={this.state}
				activate={this.activated}
				changed={(next) => {
					const titleChanged = next.title !== this.state.title || next.url !== this.state.url;
					this.state = next;
					if (titleChanged && !this.embedded) refreshLeafTitle(this.app, this.leaf);
					else this.app.workspace.requestSaveLayout();
					// The workbench redraws its tab strip and panel rows from page titles.
					if (titleChanged && this.embedded) this.context.changed?.();
				}}
			/>,
			this.contentEl,
		);
	}
	onClose(): Promise<void> {
		this.opened = false;
		this.unregister?.();
		this.unregister = undefined;
		render(null, this.contentEl);
		return Promise.resolve();
	}
}
