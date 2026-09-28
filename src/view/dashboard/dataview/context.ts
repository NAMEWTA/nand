import type { App, HoverParent, TFile } from 'obsidian';
export interface DataviewContext {
	app: App;
	hoverParent: HoverParent | null;
	opener: ((file: TFile, subpath?: string) => void) | null;
}
const contexts = new WeakMap<HTMLElement, DataviewContext>();
export function bindDataviewContext(element: HTMLElement, context: DataviewContext): void {
	contexts.set(element, context);
}
export function getDataviewContext(element: HTMLElement): DataviewContext {
	let current: HTMLElement | null = element;
	while (current) {
		const context = contexts.get(current);
		if (context) return context;
		current = current.parentElement;
	}
	throw new Error('Dataview surface has no owner');
}
