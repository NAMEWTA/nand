import { BrowserError } from '../core/model';
import type { PageLease } from '../core/page-ownership';
import type { ProviderFactory, ProviderSession } from '../core/providers/contracts';
import type { BrowserPageTarget } from '../core/control';

/** Every production provider session holds the same page lease used by control and bridge mutations. */
export function ownedProviders(providers: ProviderFactory, claim: (target: BrowserPageTarget, taskId: string, signal: AbortSignal) => PageLease): ProviderFactory {
	return { connect: async (binding, taskId, signal) => {
		if (!binding.page) throw new BrowserError('browser_stale_target');
		const lease = claim(binding.page, taskId, signal); let session: ProviderSession | undefined;
		try {
			session = await providers.connect(binding, taskId, lease.signal); lease.admit();
			const native = session;
			const scoped = (signal: AbortSignal) => { lease.admit(); return AbortSignal.any([lease.signal, signal]); };
			return { target: native.target, inspect: signal => native.inspect(scoped(signal)),
				newConversation: signal => native.newConversation(scoped(signal)),
				stage: (prompt, before, signal) => native.stage(prompt, before, scoped(signal)),
				commit: (prompt, before, signal) => native.commit(prompt, before, scoped(signal)),
				capture: (message, signal) => native.capture(message, scoped(signal)),
				reveal: native.reveal ? (message, signal) => native.reveal!(message, scoped(signal)) : undefined,
				rollback: (prompt, signal) => native.rollback(prompt, scoped(signal)),
				dispose: () => { try { native.dispose(); } finally { lease.release(); } } };
		} catch (error) { try { session?.dispose(); } finally { lease.release(); } throw error; }
	} };
}
