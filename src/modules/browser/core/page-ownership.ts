import type { BrowserPageTarget } from './control';
import { BrowserError } from './model';

export interface PageOwner { kind: 'workspace' | 'assistant' | 'workflow' | 'external' | 'control'; id: string }
export interface PageLease { readonly signal: AbortSignal; admit(): void; release(): void }
interface HeldPage { target: BrowserPageTarget; owner: PageOwner; lease: PageLease; revoke(): void }
const key = (target: BrowserPageTarget): string => target.profileId + ':' + target.pageId;

/** Shares mutation admission between native task sessions, typed control and the local bridge. */
export class PageOwnership {
	private readonly held = new Map<string, Set<HeldPage>>();
	claim(target: BrowserPageTarget, owner: PageOwner, signal: AbortSignal, revoked: () => void = () => {}): PageLease {
		if (signal.aborted) throw new BrowserError('browser_workspace_paused');
		const id = key(target), entries = this.held.get(id) ?? new Set<HeldPage>();
		// Ordinary control calls retain their existing serial queue. A task excludes that whole queue.
		if ([...entries].some(entry => entry.target.generation !== target.generation || entry.owner.kind !== 'control' || owner.kind !== 'control'))
			throw new BrowserError('browser_workspace_busy');
		const abort = new AbortController(); let released = false;
		const release = () => {
			if (released) return; released = true;
			signal.removeEventListener('abort', release);
			entries.delete(entry); if (!entries.size && this.held.get(id) === entries) this.held.delete(id);
			abort.abort();
		};
		const lease: PageLease = { signal: abort.signal, release, admit: () => {
			if (released || signal.aborted || !entries.has(entry)) throw new BrowserError('browser_workspace_paused');
		} };
		const entry: HeldPage = { target: Object.freeze({ ...target }), owner: Object.freeze({ ...owner }), lease,
			revoke: () => { if (released) return; release(); revoked(); } };
		entries.add(entry); this.held.set(id, entries); signal.addEventListener('abort', release, { once: true }); return lease;
	}
	owner(target: BrowserPageTarget): PageOwner | undefined {
		const entry = this.held.get(key(target))?.values().next().value;
		return entry?.target.generation === target.generation ? { ...entry.owner } : undefined;
	}
	revoke(target: BrowserPageTarget): void {
		for (const entry of [...this.held.get(key(target)) ?? []]) if (entry.target.generation === target.generation) entry.revoke();
	}
	clear(): void { for (const entries of [...this.held.values()]) for (const entry of [...entries]) entry.revoke(); }
}
