import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import { NativeSurface } from '../native-surface';
import { ContainerProviders } from './providers';

export abstract class ReactSurface extends NativeSurface {
	private root?: Root;
	private visible = true;
	protected abstract renderContent(): ReactNode;
	override onOpen(): Promise<void> {
		this.contentEl.addClass('nand-ui');
		this.root ??= createRoot(this.contentEl);
		this.rerender();
		return Promise.resolve();
	}
	protected rerender(): void {
		this.root?.render(
			<ContainerProviders container={this.contentEl} visible={this.visible}>
				{this.renderContent()}
			</ContainerProviders>,
		);
	}
	override setVisible(visible: boolean): void {
		super.setVisible(visible);
		this.visible = visible;
		this.rerender();
	}
	override onClose(): Promise<void> {
		this.root?.unmount();
		this.root = undefined;
		this.contentEl.removeClass('nand-ui');
		return Promise.resolve();
	}
}
