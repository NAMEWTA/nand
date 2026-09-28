import type { App, WorkspaceLeaf } from 'obsidian';
import { onLanguageChanged } from '../../shared/i18n';

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
}
