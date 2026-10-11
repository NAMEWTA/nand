import type { BrowserModule } from '../services';
import type { BrowserHost } from '../services/page-host';

/** All browser presentations use the same module-owned guest and account lifecycle. */
export function browserHost(module: BrowserModule, ownerWindow: () => Window): BrowserHost {
	return {
		app: module.app, agents: module.agents, enabled: () => module.enabled(), settings: () => module.settings(),
		profiles: () => module.profiles(), history: () => module.history(), permissions: id => module.permissions(id),
		grantPermission: (origin, permission, allowed, id) => module.grantPermission(origin, permission, allowed, id),
		subscribe: listener => module.subscribe(listener),
		createPage: (next, element, changed) => module.createPage(next, element, changed),
		releasePage: id => module.releasePage(id), activate: id => module.activate(id),
		registerPresentation: (id, activate, close, readState) => module.registerPresentation(id, activate, close, readState),
		presentationExists: id => module.presentationExists(id),
		open: request => module.openInWindow(request, ownerWindow()),
		copyText: text => module.copyText(text), copyImage: data => module.copyImage(data),
		saveImage: (data, context) => module.saveImage(data, context),
		peekAssistant: () => module.peekAssistant(), openAssistant: (taskId, win) => module.openAssistant(taskId, win ?? ownerWindow()),
		guidanceChoices: target => module.guidanceChoices(target), saveGuidance: (target, grab, exchangeId) => module.saveGuidance(target, grab, exchangeId, ownerWindow()),
		getUserAdapters: () => module.getUserAdapters(),
		peekWorkflows: () => module.peekWorkflows(), openWorkflows: (id, win) => module.openWorkflows(id, win ?? ownerWindow()),
		peekGrants: () => module.peekGrants(), openAccess: win => module.openAccess(win ?? ownerWindow()),
	};
}
