import { Modal } from 'obsidian';
import { render } from 'preact';
import type { BrowserPageState } from '../core/model';
import { onLanguageChanged, t } from '../../../shared/i18n';
import { BrowserPanel } from './BrowserPanel';
import type { BrowserHost } from '../services/page-host';
export class BrowserModal extends Modal {
	private cleanups: Array<() => void> = [];
	constructor(
		private host: BrowserHost,
		public state: BrowserPageState,
		private closed: () => void,
	) {
		super(host.app);
	}
	onOpen(): void {
		this.setTitle(t('browser.title'));
		this.modalEl.addClass('nand-browser-modal');
		this.cleanups.push(
			this.host.registerPresentation(
				this.state.id,
				() => {
					this.modalEl.focus();
					return Promise.resolve();
				},
				() => this.close(),
			),
		);
		this.cleanups.push(
			this.host.subscribe(() => {
				if (!this.host.enabled()) this.close();
			}),
		);
		this.cleanups.push(onLanguageChanged(() => this.paint()));
		this.paint();
	}
	private paint(): void {
		render(
			<BrowserPanel
				host={this.host}
				initial={this.state}
				modal
				changed={(state) => {
					this.state = state;
				}}
				close={() => this.close()}
			/>,
			this.contentEl,
		);
	}
	onClose(): void {
		render(null, this.contentEl);
		for (const off of this.cleanups.splice(0)) off();
		this.closed();
	}
}
