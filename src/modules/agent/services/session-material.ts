import type { AgentSessionsPort } from '../api';
import { formatContextMaterials } from '../core/launch/context-material';
import type { ContextMaterial } from '../core/launch/session-api';
import type { AgentController } from './controller';

const READY_TIMEOUT = 10_000;

/**
 * Paste material into an agent session's input as one block, without pressing Enter. Waits until the
 * CLI is ready for input; fails if the session ends or does not become ready in time.
 */
export async function attachMaterials(controller: AgentController, id: string, materials: readonly ContextMaterial[], signal?: AbortSignal): Promise<void> {
	const session = controller.sessions.get(id);
	if (!session?.agentId || !session.running) throw new Error('browser_agent_unavailable');
	controller.show(id);
	await controller.open({ feature: 'terminal', section: 'running', resourceId: id });
	const win = controller.app.workspace.containerEl.win;
	await new Promise<void>((resolve, reject) => {
		const deadline = Date.now() + READY_TIMEOUT;
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
			if (!session!.running || Date.now() >= deadline) return finish(new Error('browser_agent_not_ready'));
			if (session!.inputReady()) {
				session!.paste(formatContextMaterials(materials));
				finish();
			}
		}
		signal?.addEventListener('abort', cancel, { once: true });
		check();
	});
}

/** `agent.sessions`: only interactive agent sessions, always as an unsent paste. */
export function sessionMaterialPort(controller: AgentController): AgentSessionsPort {
	return {
		list: () => Promise.resolve(controller.sessions.list().filter((session) => session.agentId && session.running && !session.automated).map((session) => ({ id: session.id, title: session.title }))),
		attachMaterial: (sessionId, material) => attachMaterials(controller, sessionId, [{ id: crypto.randomUUID(), kind: 'web', title: material.title, text: material.text, files: material.files }]),
	};
}
