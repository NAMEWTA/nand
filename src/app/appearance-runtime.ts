import type { Plugin } from 'obsidian';
import type { SettingsHandle } from '../shared/settings/store';
import { applyAppearance, clearAppearance, type NandAppearance } from '../ui/appearance';

/** Puts NAND's palette and font on the body of the main window and every popout window; removes them on unload. */
export class AppearanceRuntime {
	private readonly documents = new Set<Document>();

	constructor(private readonly handle: Pick<SettingsHandle<NandAppearance>, 'get' | 'subscribe'>) {}

	attach(plugin: Plugin): void {
		this.add(document);
		// Popout windows that already exist (the plugin was just enabled) never fire `window-open`; their leaves know them.
		plugin.app.workspace.iterateAllLeaves((leaf) => this.add(leaf.view.containerEl.ownerDocument));
		plugin.registerEvent(plugin.app.workspace.on('window-open', (win) => this.add(win.doc)));
		plugin.registerEvent(plugin.app.workspace.on('window-close', (win) => this.documents.delete(win.doc)));
		plugin.register(this.handle.subscribe(() => this.applyAll()));
		plugin.register(() => this.detach());
	}

	private add(doc: Document): void {
		this.documents.add(doc);
		this.apply(doc);
	}

	private apply(doc: Document): void {
		const { font, palette } = this.handle.get();
		applyAppearance(doc, { font, palette });
	}

	private applyAll(): void {
		for (const doc of this.documents) this.apply(doc);
	}

	private detach(): void {
		for (const doc of this.documents) clearAppearance(doc);
		this.documents.clear();
	}
}
