import type { AgentDispatch, AgentDispatchRequest, AgentDispatchReceipt, AgentDirectoryEntry } from '../api';
import type { AutomationInvocations } from '../../automations/api';

/** Bounds delivery waiting without claiming to cancel a runtime task already accepted by automations. */
export function createAgentDispatch(host: {
	agents(): readonly AgentDirectoryEntry[];
	invocations(): AutomationInvocations | undefined;
	cwd(): string;
	clock: Pick<Window, 'setTimeout' | 'clearTimeout'>;
}): AgentDispatch & { dispose(): void } {
	let closed = false;
	const waits = new Set<() => void>();
	return {
		dispatch(input, options = {}) {
			const request: AgentDispatchRequest = structuredClone(input);
			if (request.destination.kind === 'fresh' && !request.destination.cwd) request.destination.cwd = host.cwd();
			const fail = (errorCode: string, delivery: 'rejected' | 'timeout' = 'rejected'): AgentDispatchReceipt => ({ invocationId: request.invocationId, delivery, errorCode });
			if (closed || options.signal?.aborted) return Promise.resolve(fail('cancelled'));
			const agent = host.agents().find(item => item.id === request.agentId);
			if (!agent) return Promise.resolve(fail('unsupported'));
			if (!agent.enabled) return Promise.resolve(fail('agentDisabled'));
			if (request.destination.kind === 'fresh' && !agent.installed) return Promise.resolve(fail('cliMissing'));
			const invocations = host.invocations();
			if (!invocations) return Promise.resolve(fail('moduleOff'));
			return new Promise(resolve => {
				let settled = false;
				const abort = new AbortController();
				const cancel = () => { abort.abort(); finish(fail('cancelled')); };
				const timer = host.clock.setTimeout(() => { abort.abort('timeout'); finish(invocations.receipt(request.invocationId) ?? fail('timeout', 'timeout')); }, 10_000);
				const finish = (receipt: AgentDispatchReceipt) => {
					if (settled) return;
					settled = true; host.clock.clearTimeout(timer); waits.delete(cancel);
					options.signal?.removeEventListener('abort', cancel); resolve(receipt);
				};
				waits.add(cancel); options.signal?.addEventListener('abort', cancel, { once: true });
				void Promise.resolve().then(() => {
					if (settled || closed || options.signal?.aborted) { if (!settled) cancel(); return; }
					return invocations.invoke(request, { signal: abort.signal });
				}).then(receipt => { if (receipt) finish(receipt); }, (error: unknown) => {
					const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : 'operationFailed';
					finish(fail(code));
				});
			});
		},
		dispose() { closed = true; for (const cancel of [...waits]) cancel(); },
	};
}
