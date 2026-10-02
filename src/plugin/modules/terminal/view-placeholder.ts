import type { WorkspaceLeaf } from 'obsidian';
import { TerminalView } from '../../../view/terminal/terminal-view';
import type { TerminalAgentController } from './controller';
import { renderEmptyState } from '../../../view/primitives/empty-state';
import { t as sharedT } from '../../../shared/i18n';
import { t } from '../../../shared/i18n/terminal-accessor';
import { errorLog } from '../../../platform/desktop/logger';
/**
 * Terminal view placeholder
 * Used to lazy-load the terminal view and avoid loading xterm.js at startup
 */
export class TerminalViewPlaceholder extends TerminalView {
	private plugin: TerminalAgentController;
	private initialized = false;
	private initializing = false;
	private disposed = false;

	constructor(leaf: WorkspaceLeaf, plugin: TerminalAgentController) {
		// Inject TerminalService lazily to avoid loading xterm.js at startup
		super(leaf, null, plugin);
		this.plugin = plugin;
	}

	async onOpen() {
		if (this.disposed) return;
		if (!this.plugin.isActive()) {
			this.contentEl.empty();
			renderEmptyState(this.contentEl, {
				icon: 'terminal',
				title: sharedT('modules.terminal'),
				description: sharedT('modules.terminalOff'),
				action: { label: sharedT('modules.openHome'), run: () => this.plugin.openHome() },
			});
			return;
		}
		if (this.initialized || this.initializing) return;
		this.initializing = true;
		const pendingTerminal = this.plugin.consumePendingRestoredTerminal(this.leaf);

		// Show the loading message
		this.contentEl.empty();
		this.contentEl.createDiv({
			text: t('terminal.loading'),
			cls: 'terminal-loading',
		});

		try {
			// Get the real TerminalService
			const terminalService = await this.plugin.getTerminalService();
			if (this.disposed) return;

			this.setTerminalService(terminalService);

			// Clear the placeholder content and initialize the terminal view
			this.contentEl.empty();
			await super.onOpen();
			if (this.disposed) return;
			if (pendingTerminal) {
				this.adoptTerminalInstance(pendingTerminal);
			}
			this.initialized = true;
		} catch (error) {
			if (this.disposed) return;
			errorLog('[TerminalViewPlaceholder] Failed to initialize:', error);
			this.contentEl.empty();
			this.contentEl.createDiv({
				text: t('terminal.initFailed', { message: error instanceof Error ? error.message : String(error) }),
				cls: 'terminal-error',
			});
		} finally {
			this.initializing = false;
		}
	}

	async onClose() {
		this.disposed = true;
		await super.onClose();
	}
}
