import type { AgentSessionApi } from '../../core/agent-launch/session-api';
import { formatContextMaterials } from '../../core/agent-launch/context-material';
import type { TerminalAgentController } from '../modules/terminal';

export async function agentSessions(host: TerminalAgentController): Promise<AgentSessionApi> {
	const service = await host.getTerminalService();
	const win = host.app.workspace.containerEl.win;
	return {
		snapshot: () =>
			service
				.getAllTerminals()
				.flatMap((session) =>
					session.agentId
						? [
								{
									id: session.id,
									agent: session.agentId,
									title: session.getTitle(),
									cwd: session.getCwd(),
									status: session.nativeStatus,
								},
							]
						: [],
				),
		subscribe: (listener) => service.subscribe(listener),
		start: (id) => host.launchAgent(id),
		resume: (session) => host.resumeSession(session),
		stop: (id) => service.destroyTerminal(id),
		open: (id) => host.openAutomationTerminal(id),
		async attach(id, materials, signal) {
			const session = service.getTerminal(id);
			if (!session?.agentId || session.isDisposed) throw new Error('browser_agent_unavailable');
			await host.openAutomationTerminal(id);
			await new Promise<void>((resolve, reject) => {
				const deadline = Date.now() + 10000;
				const timer = win.setInterval(check, 50);
				const cancel = () => finish(new Error('Context attachment cancelled'));
				function finish(error?: Error) {
					win.clearInterval(timer);
					signal?.removeEventListener('abort', cancel);
					if (error) reject(error);
					else resolve();
				}
				function check() {
					if (signal?.aborted) return cancel();
					if (session!.isDisposed || Date.now() >= deadline)
						return finish(new Error('browser_agent_not_ready'));
					if (session!.acceptsContext) {
						session!.pasteContext(formatContextMaterials(materials));
						finish();
					}
				}
				signal?.addEventListener('abort', cancel, { once: true });
				check();
			});
		},
	};
}
