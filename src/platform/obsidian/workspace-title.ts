import type { App, View, ViewState, WorkspaceLeaf } from 'obsidian';
import { onLanguageChanged, type Language } from '../../shared/i18n';

export interface LeafTitlePair {
	en: string;
	zh: string;
}

/** The other language's default, only when `stored` is exactly one known pair and is not already current. */
export function translatedLeafTitle(
	stored: string | undefined,
	pairs: readonly LeafTitlePair[],
	language: Language,
): string | undefined {
	if (!stored) return undefined;
	const matches = pairs.filter((pair) => stored === pair.en || stored === pair.zh);
	if (matches.length !== 1) return undefined;
	const next = matches[0]![language];
	return next === stored ? undefined : next;
}

export function storedLeafTitle(leaf: WorkspaceLeaf): string | undefined {
	return (leaf.getViewState() as ViewState & { title?: string }).title;
}

/** Deferred views keep the serialized title on the view object. A copy from getViewState() does not. */
export function setDeferredLeafTitle(leaf: WorkspaceLeaf, next: string): boolean {
	const view = leaf.view as View & { title?: string };
	if (!('title' in view)) return false;
	view.title = next;
	return true;
}

/** Rewrite deferred leaves whose stored title is exactly the other language's default. */
export function retitleDeferredLeaves(
	leaves: readonly WorkspaceLeaf[],
	pairs: readonly LeafTitlePair[],
	language: Language,
	refresh: (leaf: WorkspaceLeaf) => void,
): void {
	for (const leaf of leaves) {
		if (!leaf.isDeferred) continue;
		const next = translatedLeafTitle(storedLeafTitle(leaf), pairs, language);
		if (!next || !setDeferredLeafTitle(leaf, next)) continue;
		refresh(leaf);
	}
}

/** Repaint in place and notify the leaf's current host window; ownership stays with the view. */
export function onLeafLanguageChanged(app: App, leaf: WorkspaceLeaf, repaint: () => void): () => void {
	return onLanguageChanged(() => {
		repaint();
		refreshLeafTitle(app, leaf);
	});
}

/** Let the host choose its window's current leaf and format the full title. */
export function refreshLeafTitle(app: App, leaf: WorkspaceLeaf): void {
	// updateHeader updates the tab, but Obsidian retains the ItemView header's initial text.
	const title = leaf.view?.containerEl?.querySelector<HTMLElement>('.view-header-title');
	if (title) title.textContent = leaf.view.getDisplayText();
	(leaf as WorkspaceLeaf & { updateHeader?: () => void }).updateHeader?.();
	const container = leaf.getContainer();
	if (container === app.workspace.rootSplit) {
		(app.workspace as typeof app.workspace & { updateTitle?: () => void }).updateTitle?.();
	} else {
		(container as typeof container & { updateTitle?: () => void }).updateTitle?.();
	}
	app.workspace.requestSaveLayout?.();
}
