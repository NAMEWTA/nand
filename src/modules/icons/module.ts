import type { ModuleContext, ModuleInstance } from '../../app/contracts/module';
import type IconicController from './platform/host/controller';
import { registerMessages } from '../../shared/i18n/index';
import { messages } from './i18n';

registerMessages(messages);

/**
 * Icons module (Iconic rules and placement). Each activation creates a controller; its commands, editor
 * hooks, managers and body classes are all released when the module is turned off.
 */
export default function createIconsModule(context: ModuleContext): ModuleInstance {
	let controller: IconicController | undefined;
	return {
		pages: {
			icons: async () => (await import('./ui/workbench-page')).createIconsPage(() => controller),
		},
		async activate() {
			const [{ default: Controller }, { createIconicDialogs }] = await Promise.all([import('./platform/host/controller'), import('./ui/dialog-factory')]);
			const next = new Controller(
				{ app: context.app, manifest: context.manifest, commands: context.commands, editor: context.editor, lifetime: context.lifetime },
				createIconicDialogs,
			);
			await next.onload();
			controller = next;
		},
		async dispose() {
			const current = controller;
			controller = undefined;
			await current?.dispose();
		},
	};
}
