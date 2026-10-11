import type { AgentRunContextLease, AgentRunContextProvider } from '../../agent/api';
import { BrowserError } from '../core/model';
import { ScopedBrowserGrant, type ScopedBrowserConnection, type ScopedBrowserGrantDefinition, type ScopedBrowserPort } from '../core/scoped-grant';

interface RunContextPorts {
	id(): string;
	now(): number;
	connect(port: ScopedBrowserPort, signal: AbortSignal, expiresAt: number): Promise<ScopedBrowserConnection>;
}
interface PendingRun {
	grant: ScopedBrowserGrant;
	port: ScopedBrowserPort;
	abort: AbortController;
	claimed: boolean;
	dispose(): void;
	connection?: ScopedBrowserConnection;
	unwatchRun?: () => void;
}

/** One opaque handle is redeemable by one owner run. Credentials never enter task or prompt data. */
export class ScopedBrowserRuns implements AgentRunContextProvider {
	readonly id = 'browser';
	private readonly pending = new Map<string, PendingRun>();
	private readonly issued = new Set<string>();
	private closed = false;
	constructor(private readonly ports: RunContextPorts) {}
	create(definition: ScopedBrowserGrantDefinition, executor: (grant: ScopedBrowserGrant) => ScopedBrowserPort): { handle: string; grant: ScopedBrowserGrant; dispose(): void } {
		if (this.closed) throw new BrowserError('browser_disabled');
		const grant = new ScopedBrowserGrant(definition, () => this.ports.now()), handle = this.ports.id(), abort = new AbortController();
		if (!handle || this.issued.has(handle)) throw new BrowserError('browser_scoped_grant_invalid');
		this.issued.add(handle);
		const dispose = () => {
			if (abort.signal.aborted) return;
			if (this.pending.get(handle) === entry) this.pending.delete(handle);
			entry.unwatchRun?.(); entry.unwatchRun = undefined;
			grant.revoke(); abort.abort(); entry.connection?.dispose(); entry.connection = undefined;
		};
		const entry: PendingRun = { grant, port: executor(grant), abort, claimed: false, dispose };
		this.pending.set(handle, entry); return { handle, grant, dispose };
	}
	async resolve(handle: string, run: { runId: string; cwd: string; signal: AbortSignal }): Promise<AgentRunContextLease | undefined> {
		const entry = this.pending.get(handle);
		if (this.closed || !entry || entry.claimed || !run.runId || run.signal.aborted) return undefined;
		// Claim before any await: a repeated handle, even with the same run id, cannot mint another token.
		entry.claimed = true;
		const stop = () => entry.dispose(); run.signal.addEventListener('abort', stop, { once: true });
		entry.unwatchRun = () => run.signal.removeEventListener('abort', stop);
		try {
			entry.grant.assertActive();
			const connection = await this.ports.connect(entry.port, entry.abort.signal, entry.grant.inspect().expiresAt);
			if (this.closed || entry.abort.signal.aborted || run.signal.aborted) { connection.dispose(); entry.dispose(); return undefined; }
			entry.connection = connection; entry.grant.assertActive();
			return { env: connection.environment, dispose: () => entry.dispose() };
		} catch (error) { entry.dispose(); throw error; }
		finally { if (!entry.connection) { entry.unwatchRun?.(); entry.unwatchRun = undefined; } }
	}
	dispose(): void {
		this.closed = true; for (const entry of [...this.pending.values()]) entry.dispose();
	}
}
