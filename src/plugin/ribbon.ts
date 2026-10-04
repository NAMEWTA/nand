import { setTooltip, type Plugin } from 'obsidian';
import { onLanguageChanged, t } from '../shared/i18n/index';

const ribbons: Record<string, [string, string]> = {
	home: ['home', 'main.openHome'],
	globe: ['globe', 'browser.open'],
	'pen-line': ['editor', 'editor.openPanel'],
	'contact-round': ['contacts', 'contacts.open'],
	terminal: ['terminal', 'terminalAgent.commands.openTerminal'],
	'lucide-book-image': ['icons', 'iconic.commands.openRulebook'],
	timer: ['automations', 'automation.title'],
	bell: ['notifications', 'automation.inbox'],
};
/** Ribbon identity is persisted by Obsidian; translated labels must never be its ID. */
export function stableRibbon(
	plugin: Plugin,
	icon: string,
	fallback: string,
	callback: (evt: MouseEvent) => unknown,
	create: (icon: string, id: string, callback: (evt: MouseEvent) => unknown) => HTMLElement,
): HTMLElement {
	const [id, key] = ribbons[icon] ?? [icon, ''];
	const element = create(icon, `ribbon-${id}`, callback);
	const update = () => {
		const label = key ? t(key) : fallback;
		setTooltip(element, label, { placement: 'right' });
		const workspace = plugin.app.workspace as typeof plugin.app.workspace & {
			leftRibbon?: { items?: Array<{ id: string; title: string; buttonEl: HTMLElement }> };
		};
		const item = workspace.leftRibbon?.items?.find((item) => item.buttonEl === element);
		if (item) item.title = label;
	};
	update();
	plugin.register(onLanguageChanged(update));
	return element;
}
