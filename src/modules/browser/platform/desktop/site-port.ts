import type { SiteExchangePort, SnapshotRef } from '../../core/site-exchange';

interface PageAutomation {
	execute(method: string, params: Record<string, unknown>): Promise<unknown>;
}

/**
 * Drive the open guest with the existing snapshot, fill, and click commands.
 * Fill and click carry the revision from the latest snapshot. A later snapshot
 * replaces it, because the guest rejects a stale revision.
 */
export function pageSitePort(page: () => { automation?: PageAutomation } | undefined): SiteExchangePort {
	const automation = () => {
		const current = page()?.automation;
		if (!current) throw new Error('no-page');
		return current;
	};
	let revision: string | undefined;
	return {
		async open(url) {
			await automation().execute('goto', { url });
		},
		async snapshot() {
			let raw: { snapshot?: string; refs?: SnapshotRef[]; revision?: unknown };
			try {
				raw = (await automation().execute('snapshot', {})) as typeof raw;
			} catch (error) {
				revision = undefined;
				throw error;
			}
			revision = typeof raw.revision === 'string' && raw.revision.length > 0 ? raw.revision : undefined;
			return { text: raw.snapshot ?? '', refs: raw.refs ?? [] };
		},
		async fill(ref, value) {
			if (!revision) throw new Error('missing-revision');
			await automation().execute('fill', { element: ref, value, revision });
		},
		async press(ref) {
			try {
				if (ref) {
					if (!revision) throw new Error('missing-revision');
					await automation().execute('click', { element: ref, revision });
				} else await automation().execute('keypress', { key: 'Enter' });
				return 'submitted';
			} catch {
				return 'unknown';
			}
		},
	};
}
