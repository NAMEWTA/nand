import { TERMINAL_VIEW_TYPE } from './view-type';
import { t } from '../../shared/i18n/terminal-accessor';
import { ItemView, type WorkspaceLeaf, type ViewStateResult } from 'obsidian';
import type { TerminalService } from '../../platform/desktop/terminal/terminal-service';
import type { TerminalViewHost } from './host';
import { TerminalSurface } from './terminal-surface';
export { TERMINAL_VIEW_TYPE } from './view-type';
export type { TerminalAttachOptions } from './terminal-surface';
/** A real native view; its presentation is also used by the unified workbench. */
export class TerminalView extends ItemView {
 readonly surface: TerminalSurface;
 constructor(leaf: WorkspaceLeaf, service: TerminalService | null, host: TerminalViewHost) {
  super(leaf);
  this.surface = this.addChild(new TerminalSurface({ app: this.app, leaf, contentEl: this.contentEl, containerEl: this.contentEl, close: () => this.leaf.detach() }, service, host));
 }
 getNativeSurfaces(): readonly TerminalSurface[] { return this.surface ? [this.surface] : []; }
 copyWorkbenchStateFrom(view: TerminalView): void { this.surface.copyWorkbenchStateFrom(view.surface); }
 onOpen(): Promise<void> { return this.surface.onOpen(); }
 onClose(): Promise<void> { return this.surface.onClose(); }
 getState(): Record<string, unknown> { return this.surface?.getState() ?? {}; }
 async setState(state: Record<string, unknown>, result: ViewStateResult): Promise<void> { await this.surface.setState(state, result); await super.setState(state, result); }

	getViewType(): string { return TERMINAL_VIEW_TYPE; }

	getDisplayText(): string { return this.surface?.getDisplayText() ?? t('terminal.defaultTitle'); }

	getIcon(): string { return 'terminal'; }
	onPaneMenu(...args: Parameters<TerminalSurface['onPaneMenu']>): ReturnType<TerminalSurface['onPaneMenu']> { return this.surface.onPaneMenu(...args); }
	showSearch(...args: Parameters<TerminalSurface['showSearch']>): ReturnType<TerminalSurface['showSearch']> { return this.surface.showSearch(...args); }
	hideSearch(...args: Parameters<TerminalSurface['hideSearch']>): ReturnType<TerminalSurface['hideSearch']> { return this.surface.hideSearch(...args); }
	releaseTerminalInstance(...args: Parameters<TerminalSurface['releaseTerminalInstance']>): ReturnType<TerminalSurface['releaseTerminalInstance']> { return this.surface.releaseTerminalInstance(...args); }
	adoptTerminalInstance(...args: Parameters<TerminalSurface['adoptTerminalInstance']>): ReturnType<TerminalSurface['adoptTerminalInstance']> { return this.surface.adoptTerminalInstance(...args); }
	setTerminalService(...args: Parameters<TerminalSurface['setTerminalService']>): ReturnType<TerminalSurface['setTerminalService']> { return this.surface.setTerminalService(...args); }
	handleHostWindowChanged(...args: Parameters<TerminalSurface['handleHostWindowChanged']>): ReturnType<TerminalSurface['handleHostWindowChanged']> { return this.surface.handleHostWindowChanged(...args); }
	selectPtySession(...args: Parameters<TerminalSurface['selectPtySession']>): ReturnType<TerminalSurface['selectPtySession']> { return this.surface.selectPtySession(...args); }
	selectSession(...args: Parameters<TerminalSurface['selectSession']>): ReturnType<TerminalSurface['selectSession']> { return this.surface.selectSession(...args); }
	newSession(...args: Parameters<TerminalSurface['newSession']>): ReturnType<TerminalSurface['newSession']> { return this.surface.newSession(...args); }
	splitTerminal(...args: Parameters<TerminalSurface['splitTerminal']>): ReturnType<TerminalSurface['splitTerminal']> { return this.surface.splitTerminal(...args); }
	refreshAppearance(...args: Parameters<TerminalSurface['refreshAppearance']>): ReturnType<TerminalSurface['refreshAppearance']> { return this.surface.refreshAppearance(...args); }
	getTerminalInstance(...args: Parameters<TerminalSurface['getTerminalInstance']>): ReturnType<TerminalSurface['getTerminalInstance']> { return this.surface.getTerminalInstance(...args); }
	isInitializing(...args: Parameters<TerminalSurface['isInitializing']>): ReturnType<TerminalSurface['isInitializing']> { return this.surface.isInitializing(...args); }
	waitForTerminalInstance(...args: Parameters<TerminalSurface['waitForTerminalInstance']>): ReturnType<TerminalSurface['waitForTerminalInstance']> { return this.surface.waitForTerminalInstance(...args); }
}
