import type { Plugin } from 'obsidian';
import type { SettingsHandle } from '../shared/settings/store';
import { THEME_CLASS_PREFIXES, THEME_VARS, resolveTheme, themeBodyState, type ThemeSettings } from './settings';

/** Applies the global theme to the main window and every popout window, and removes it on unload. */
export class ThemeRuntime {
	private readonly documents = new Set<Document>();

	constructor(private readonly handle: SettingsHandle<ThemeSettings>) {}

	attach(plugin: Plugin): void {
		this.add(document);
		plugin.registerEvent(plugin.app.workspace.on('window-open', (win) => this.add(win.doc)));
		plugin.registerEvent(plugin.app.workspace.on('window-close', (win) => this.documents.delete(win.doc)));
		plugin.register(this.handle.subscribe(() => this.applyAll()));
		plugin.register(() => this.detach());
	}

	private add(doc: Document): void {
		this.documents.add(doc);
		this.apply(doc);
	}

	private applyAll(): void {
		for (const doc of this.documents) this.apply(doc);
	}

	private apply(doc: Document): void {
		const state = themeBodyState(resolveTheme(this.handle.get()));
		clear(doc.body);
		doc.body.addClasses(state.classes);
		doc.body.setCssProps(state.vars);
	}

	private detach(): void {
		for (const doc of this.documents) clear(doc.body);
		this.documents.clear();
	}
}

function clear(body: HTMLElement): void {
	body.removeClasses(Array.from(body.classList).filter((name) => THEME_CLASS_PREFIXES.some((prefix) => name.startsWith(prefix))));
	body.setCssProps(Object.fromEntries(THEME_VARS.map((name) => [name, ''])));
}
