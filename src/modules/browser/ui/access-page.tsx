import { Platform } from 'obsidian';
import { render } from 'preact';
import type { PageCreate } from '../../../app/contracts/workbench-host';
import type { WorkbenchTarget } from '../../../app/contracts/workbench';
import { onLeafLanguageChanged } from '../../../host/obsidian/workspace-title';
import { t } from '../../../shared/i18n';
import { NativeSurface, type NativeSurfaceContext } from '../../../ui/native-surface';
import { BrowserError } from '../core/model';
import { browserError } from '../core/text';
import type { BrowserModule } from '../services';
import type { BrowserGrants } from '../services/grants';
import { BrowserAccess } from './BrowserAccess';

class AccessPresentation extends NativeSurface {
	private opened = false;
	private grants?: BrowserGrants;
	private failure: unknown;
	constructor(context: NativeSurfaceContext, private readonly module: BrowserModule) { super(context); }
	getViewType(): string { return 'nand-browser-access'; }
	getDisplayText(): string { return t('browser.access.title'); }
	getIcon(): string { return 'key-round'; }
	getState(): Record<string, unknown> { return {}; }
	getTarget(): WorkbenchTarget { return { feature: 'browser', section: 'access' }; }
	onOpen(): Promise<void> {
		this.opened = true; this.contentEl.addClass('nand-browser-workspace-view');
		this.register(onLeafLanguageChanged(this.app, this.leaf, () => this.paint()));
		this.register(this.module.subscribe(() => { this.paint(); this.context.changed?.(); }));
		this.paint(); if (Platform.isDesktopApp) void this.initialize(); return Promise.resolve();
	}
	private async initialize(): Promise<void> {
		try { const grants = await this.module.getGrants(); if (this.opened) this.grants = grants; }
		catch (error) { this.failure = error; } this.paint();
	}
	private paint(): void {
		if (!this.opened) return;
		if (!this.grants) { render(<div class="nand-browser-workspace"><p role={this.failure ? 'alert' : 'status'}>{!Platform.isDesktopApp ? t('browser.mobile') : this.failure ? browserError(this.failure) : t('browser.workspace.loading')}</p></div>, this.contentEl); return; }
		render(<BrowserAccess module={this.module} grants={this.grants} />, this.contentEl);
	}
	onClose(): Promise<void> { this.opened = false; render(null, this.contentEl); return Promise.resolve(); }
}
export const createAccessPage = (module: BrowserModule): PageCreate => async (context, _target, _state, signal) => {
	if (signal.aborted) throw new BrowserError('browser_disabled'); const surface = new AccessPresentation(context, module);
	return { surface, getTarget: () => surface.getTarget(), restore: async () => {}, navigate: async () => {} };
};
