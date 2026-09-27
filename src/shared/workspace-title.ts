import type { App, WorkspaceLeaf } from 'obsidian';

/** Let the host choose its window's current leaf and format the full title. */
export function refreshLeafTitle(app: App, leaf: WorkspaceLeaf): void {
	(leaf as WorkspaceLeaf & { updateHeader?: () => void }).updateHeader?.();
	const container = leaf.getContainer();
	if (container === app.workspace.rootSplit) {
		(app.workspace as typeof app.workspace & { updateTitle?: () => void }).updateTitle?.();
	} else {
		(container as typeof container & { updateTitle?: () => void }).updateTitle?.();
	}
}
