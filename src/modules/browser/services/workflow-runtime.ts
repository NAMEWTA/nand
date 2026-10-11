import type { App } from 'obsidian';
import { deviceId } from '../../../host/obsidian/storage/device-id';
import { markdownWorkflowStore } from '../platform/workflow-store';
import { BrowserWorkflows } from './workflows';

export async function createWorkflowRuntime(app: App, folder: string, ports: Omit<ConstructorParameters<typeof BrowserWorkflows>[0], 'store' | 'id' | 'now' | 'after' | 'artifact'>): Promise<BrowserWorkflows> {
	const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(folder)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
	const store = markdownWorkflowStore(app, folder, `.nand/recovery/drafts/browser-workflow-${deviceId(app)}-${hash}`, ports.changed);
	return new BrowserWorkflows({ ...ports, store, artifact: id => `${folder}/流程/运行/${id}.md`, id: () => crypto.randomUUID(), now: () => Date.now(), after: (ms, work) => {
		const win = app.workspace.containerEl.win, timer = win.setTimeout(work, ms); return () => win.clearTimeout(timer);
	} });
}
