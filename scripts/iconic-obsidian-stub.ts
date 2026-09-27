import { El } from './mini-dom';
Object.assign(globalThis, { createDiv: () => new El('div') });
// Extra Obsidian runtime exports for the port's contract tests. UI behavior is
// exercised in the desktop app; these classes only permit module evaluation.
export * from './obsidian-stub';
export class BaseComponent {}
export class ValueComponent<T> extends BaseComponent {}
export class ButtonComponent extends BaseComponent {}
export class ExtraButtonComponent extends BaseComponent {}
export class ColorComponent extends BaseComponent {}
export class TextComponent extends BaseComponent {}
export class SearchComponent extends TextComponent {}
export class DropdownComponent extends BaseComponent {}
export class AbstractInputSuggest<T> {}
export class EditorSuggest<T> {}
export class SuggestModal<T> {}
export class Plugin {}
export class View {}
export class WorkspaceLeaf {}
export class WorkspaceRoot {}
export class WorkspaceFloating {}
export class TAbstractFile {}
export class MenuItem {}
export class SettingGroup {}
export const getIconIds = () => ['lucide-file', 'lucide-folder', 'lucide-star'];
export const prepareFuzzySearch = (_query: string) => (_text: string) => null;
export const setTooltip = (..._args: unknown[]) => {};
export const displayTooltip = (..._args: unknown[]) => {};
export const requireApiVersion = (_version: string) => true;
export class Component {
	private cleanups: Array<() => void> = [];
	load() {}
	register(fn: () => void) {
		this.cleanups.push(fn);
	}
	registerEvent(ref: { off: () => void }) {
		this.register(() => ref.off());
	}
	registerDomEvent(target: EventTarget, name: string, callback: EventListener) {
		target.addEventListener(name, callback);
		this.register(() => target.removeEventListener(name, callback));
	}
	unload() {
		for (const cleanup of this.cleanups.splice(0).reverse()) cleanup();
	}
}
