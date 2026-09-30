import type { PtySession } from '../../../platform/desktop/terminal/pty-session';
import { TerminalInstance } from './terminal-instance';
import { HiddenRendererRetention } from './hidden-renderer-retention';

/** One presentation per live session; its owner releases it when the session ends. */
export class TerminalRenderers {
	private entries = new Map<PtySession, Promise<TerminalInstance>>();
	private hiddenRetention = new HiddenRendererRetention(2);
	get(session: PtySession): Promise<TerminalInstance> {
		if (session.isDisposed) return Promise.reject(new Error('Terminal session disposed'));
		let entry = this.entries.get(session);
		if (!entry) {
			const renderer = new TerminalInstance(session, this.hiddenRetention);
			let release = () => {};
			entry = renderer
				.initialize()
				.then(() => {
					if (session.isDisposed) throw new Error('Terminal session disposed');
					return renderer;
				})
				.catch((error) => {
					release();
					this.entries.delete(session);
					renderer.destroy();
					throw error;
				});
			this.entries.set(session, entry);
			release = session.onDispose(() => {
				this.entries.delete(session);
			});
		}
		return entry;
	}
}
