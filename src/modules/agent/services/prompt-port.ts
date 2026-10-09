import type { AgentDispatch, AgentPromptRequest, AgentPromptResult, AgentPromptRunner } from '../api';

/** Paste into a new shell or an existing session. Neither path presses Enter. */
export function createAgentDispatch(host: {
	openShell(): Promise<{ id: string; paste(text: string): void } | undefined>;
	paste(sessionId: string, text: string): boolean;
}): AgentDispatch {
	return {
		async start(prompt) {
			const session = await host.openShell();
			if (!session) return { id: '', submitted: false };
			session.paste(prompt);
			return { id: session.id, submitted: false };
		},
		async paste(sessionId, prompt) {
			host.paste(sessionId, prompt);
			return { submitted: false };
		},
	};
}

/** The shared runner. The host reads the real session; this does not invent an answer. */
export function createPromptRunner(host: { run(request: AgentPromptRequest): Promise<AgentPromptResult> }): AgentPromptRunner {
	return { run: (request) => host.run(request) };
}
