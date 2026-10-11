import type { App } from 'obsidian';
import { assistantRecoveryDirectory } from '../platform/assistant-recovery';
import { markdownAssistantStore } from '../platform/assistant-store';
import { WebAssistant } from './assistant';

/** Kept behind the assistant entry; ordinary page startup does not read assistant documents. */
export async function createAssistantRuntime(app: App, folder: string, ports: Omit<ConstructorParameters<typeof WebAssistant>[0], 'store' | 'id' | 'now' | 'after'>): Promise<WebAssistant> {
	const recovery = await assistantRecoveryDirectory(app, folder);
	const store = markdownAssistantStore(app, folder, recovery, () => ports.changed());
	return new WebAssistant({ ...ports, store, id: () => crypto.randomUUID(), now: () => Date.now(), after: (ms, work) => {
		const win = app.workspace.containerEl.win, timer = win.setTimeout(work, ms); return () => win.clearTimeout(timer);
	} });
}
