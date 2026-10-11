import type { App } from 'obsidian';
import { homeServices } from '../../services/instances';
import { ownDialog } from '../ui/dialog-scope';

/** A preview is owned by its Home page and is revoked when the target module goes away. */
export function ownAgentPreview(app: App, close: () => void, owner: unknown, signal?: AbortSignal): () => void {
	const release = ownDialog(app, close, owner);
	const unwatch = homeServices.watchAgents?.(() => { if (!homeServices.agents?.().length) close(); });
	signal?.addEventListener('abort', close, { once: true });
	// Availability may have changed between acquiring the port and opening this view.
	if (signal?.aborted || !homeServices.agents?.().length) queueMicrotask(close);
	return () => { release(); unwatch?.(); signal?.removeEventListener('abort', close); };
}
