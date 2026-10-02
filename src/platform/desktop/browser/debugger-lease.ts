// Lease ownership adapted from Orca electron-debugger-lease.ts, d74388f (MIT).
import { BrowserError } from '../../../core/browser/model';
import type { GuestContents } from './electron-api';
const leases = new WeakMap<GuestContents, { owners: Set<symbol>; attached: boolean }>();
export function acquireDebugger(guest: GuestContents): () => void {
	if (guest.isDestroyed()) throw new BrowserError('browser_page_closed');
	let state = leases.get(guest);
	if (!state) {
		state = { owners: new Set(), attached: false };
		leases.set(guest, state);
	}
	if (!guest.debugger.isAttached()) {
		try {
			guest.debugger.attach('1.3');
			state.attached = true;
		} catch {
			throw new BrowserError('browser_debugger_unavailable');
		}
	}
	const owner = Symbol();
	state.owners.add(owner);
	return () => {
		if (!state.owners.delete(owner) || state.owners.size) return;
		leases.delete(guest);
		try {
			if (state.attached && guest.debugger.isAttached()) guest.debugger.detach();
		} catch {
			/* Destroyed guest. */
		}
	};
}
