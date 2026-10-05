import { BROWSER_VIEW_TYPE } from '../../core/browser/model';
import { t } from '../../shared/i18n';
import { ItemView, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
import type { BrowserPageState } from '../../core/browser/model';
import type { BrowserHost } from './host';
import { BrowserPresentation } from './browser-presentation';

/** Original native browser type; the same presentation also runs inside a workbench. */
export class BrowserView extends ItemView {
 readonly surface: BrowserPresentation;
 constructor(leaf: WorkspaceLeaf, host: BrowserHost) {
  super(leaf);
  this.surface = this.addChild(new BrowserPresentation({ app: this.app, leaf, contentEl: this.contentEl, containerEl: this.contentEl, close: () => this.leaf.detach() }, host));
 }
 get state(): BrowserPageState { return this.surface.state; }
 set state(value: BrowserPageState) { this.surface.state = value; }
 getNativeSurfaces(): readonly BrowserPresentation[] { return this.surface ? [this.surface] : []; }

	getViewType(): string { return BROWSER_VIEW_TYPE; }

	getDisplayText(): string { return this.surface?.getDisplayText() ?? t('browser.title'); }

	getIcon(): string { return 'globe'; }
 getState(): Record<string, unknown> { return this.surface?.getState() ?? {}; }
 async setState(state: Record<string, unknown>, result: ViewStateResult): Promise<void> {
  await this.surface.setState(state, result); await super.setState(state, result);
 }
 onOpen(): Promise<void> { return this.surface.onOpen(); }
 onClose(): Promise<void> { return this.surface.onClose(); }
 onResize(): void { this.surface.onResize(); }
}
