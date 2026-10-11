import type { App, EventRef } from 'obsidian';
import type { ShellAccess } from '../../../app/contracts/module';
import { AutomationError } from '../../../shared/automation/errors';
import type { AutomationSource } from '../../automations/api';
import type { DashboardSettings } from '../core/board/types/index';
import { DashboardAutomationSource } from '../platform/board/automation';

/** Board cards, countdowns and anniversaries as an automation source (`automations.sources`). */
export function dashboardAutomationSource(options: {
	app: App;
	settings: () => DashboardSettings;
	deviceId: string;
	saveSettings: () => Promise<void>;
	shell: ShellAccess;
	/** Registers vault listeners for the contributing module's lifetime. */
	registerEvent: (ref: EventRef) => void;
}): AutomationSource {
	const { app, settings, shell } = options;
	const boards = new DashboardAutomationSource(app, settings, options.deviceId, options.saveSettings, () => true);
	const invalidate = (file: { path: string }) => boards.invalidate(file.path);
	options.registerEvent(app.vault.on('modify', invalidate));
	options.registerEvent(app.vault.on('create', invalidate));
	options.registerEvent(app.vault.on('delete', invalidate));
	options.registerEvent(app.vault.on('rename', (file, old) => { boards.invalidate(old); invalidate(file); }));
	return {
		kinds: ['dashboard', 'widget'],
		list: () => boards.list(),
		save: (definition, remove) => boards.save(definition, remove),
		open: async (source, ownerWindow) => {
			if (source.kind === 'dashboard' && source.id.startsWith('pipeline:')) {
				const file = await boards.resolvePipelineSource(source);
				await app.workspace.openLinkText(file.path, '', false);
				return;
			}
			if (source.kind === 'widget') {
				const file = boards.resolveWidgetSource(source);
				await shell.open({ feature: 'dashboard', resourceId: file.path, focusId: source.id }, ownerWindow);
				return;
			}
			const file = app.vault.getFileByPath(source.path);
			if (!file) throw new AutomationError('sourceMissing');
			await shell.open({ feature: 'dashboard', resourceId: file.path }, ownerWindow);
		},
		createTask: (action, runId) => boards.createTask(action, runId),
		taskTargets: () => boards.targets(),
		pinTargets: () => [...new Set([settings().dashboardFile, ...settings().workspaceFiles])],
		pin: (path, definition) => boards.pinAction(path, definition),
	};
}
