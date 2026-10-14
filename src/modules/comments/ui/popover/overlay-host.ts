import { createOverlayChannel } from '../../services/overlay';
import type { CommentsEnv } from '../env';

/** The editor owns a light channel; React is loaded only when a window needs an overlay. */
export class CommentsOverlays {
	private readonly entries = new Map<Document, { channel: ReturnType<typeof createOverlayChannel>; dispose(): void }>();
	constructor(private readonly env: CommentsEnv) {}
	get(doc: Document) {
		let entry = this.entries.get(doc);
		if (entry) return entry.channel;
		const channel = createOverlayChannel();
		let dead = false, loading = false;
		let unmount: (() => void) | undefined;
		const mount = () => {
			if (dead || loading || unmount || !channel.state.getState().request) return;
			loading = true;
			void import('./CommentsOverlay').then(({ mountCommentsOverlay }) => {
				if (!dead && this.env.alive()) unmount = mountCommentsOverlay(doc, channel, this.env);
				loading = false;
			});
		};
		const off = channel.state.subscribe(mount);
		const close = () => { this.entries.get(doc)?.dispose(); this.entries.delete(doc); };
		doc.defaultView?.addEventListener('unload', close);
		const refresh = () => channel.refresh();
		doc.addEventListener('scroll', refresh, true); doc.defaultView?.addEventListener('resize', refresh);
		entry = { channel, dispose() {
			dead = true; off(); channel.dispose(); unmount?.();
			doc.defaultView?.removeEventListener('unload', close); doc.removeEventListener('scroll', refresh, true); doc.defaultView?.removeEventListener('resize', refresh);
		} };
		this.entries.set(doc, entry); return channel;
	}
	dispose() { for (const entry of this.entries.values()) entry.dispose(); this.entries.clear(); }
}
