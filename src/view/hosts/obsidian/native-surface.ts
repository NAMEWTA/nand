import { Component, setIcon, setTooltip, type App, type Menu, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';

/** A real native host supplies capabilities. This is not an ItemView or a fake leaf. */
export interface NativeSurfaceContext {
	app: App;
	leaf: WorkspaceLeaf;
	contentEl: HTMLElement;
	containerEl: HTMLElement;
	embedded?: boolean;
	changed?: () => void;
	addAction?: (icon: string, title: string, callback: (event: MouseEvent) => void) => HTMLElement;
	close: () => void | Promise<void>;
	activate?: () => Promise<void>;
}

/** Native rendering lifetime shared by standalone leaves and workbench pages. */
export abstract class NativeSurface extends Component {
	constructor(readonly context: NativeSurfaceContext) { super(); }
	get app(): App { return this.context.app; }
	get leaf(): WorkspaceLeaf { return this.context.leaf; }
	get contentEl(): HTMLElement { return this.context.contentEl; }
	get containerEl(): HTMLElement { return this.context.containerEl; }
	activate(): Promise<void> { return this.context.activate?.() ?? this.app.workspace.revealLeaf(this.leaf); }
	get embedded(): boolean { return this.context.embedded === true; }
	abstract getViewType(): string;
	abstract getDisplayText(): string;
	abstract getIcon(): string;
	onOpen(): Promise<void> { return Promise.resolve(); }
	onClose(): Promise<void> { return Promise.resolve(); }
	setVisible(visible: boolean): void { if (visible) this.onResize(); }
	onResize(): void { /* A presentation can opt in to native resize notification. */ }
	onPaneMenu(menu: Menu, source = ''): void { void menu; void source; }
	getState(): Record<string, unknown> { return {}; }
	setState(state: Record<string, unknown>, result: ViewStateResult): Promise<void> {
		void state; void result; return Promise.resolve();
	}
	addAction(icon: string, title: string, callback: (event: MouseEvent) => void): HTMLElement {
		if (this.context.addAction) return this.context.addAction(icon, title, callback);
		const button = this.contentEl.createEl('button', { cls: 'nand-ui-icon-btn', attr: { type: 'button', 'aria-label': title } });
		setIcon(button, icon); setTooltip(button, title);
		this.registerDomEvent(button, 'click', callback);
		return button;
	}
}

export interface NativeSurfaceOwner { getNativeSurfaces(): readonly NativeSurface[]; }

/** Enumerate current native owners instead of retaining global active views or roots. */
export function nativeSurfaces(app: App): NativeSurface[] {
	const result: NativeSurface[] = [];
	app.workspace.iterateAllLeaves((leaf) => {
		const owner = leaf.view as typeof leaf.view & Partial<NativeSurfaceOwner>;
		if (typeof owner.getNativeSurfaces === 'function') result.push(...owner.getNativeSurfaces());
	});
	return result;
}
