import { Platform, type Plugin } from 'obsidian';
import type { AgentUsage, StatusBarPreferences } from '../../contracts/workbench';
/** Optional host projection. No native status item is registered while the preference is off. */
export function registerUsageMirror(
	plugin: Plugin,
	host: {
		preferences: () => StatusBarPreferences;
		usage: () => AgentUsage | undefined;
		open: (win: Window) => Promise<void>;
		report: (error: unknown) => void;
	},
) {
	let item: HTMLElement | undefined,
		button: HTMLButtonElement | undefined,
		source: AgentUsage | undefined,
		off: (() => void) | undefined;
	const click = () => {
		if (item) void host.open(item.win).catch(host.report);
	};
	const clear = () => {
		off?.();
		off = undefined;
		source = undefined;
		button?.removeEventListener('click', click);
		item?.remove();
		item = undefined;
		button = undefined;
	};
	const refresh = () => {
		if (!Platform.isDesktopApp || !host.preferences().mirrorToObsidian) {
			clear();
			return;
		}
		if (!item) {
			item = plugin.addStatusBarItem();
			item.addClass('nand-usage-mirror');
			button = item.createEl('button', { cls: 'clickable-icon' });
			button.addEventListener('click', click);
		}
		const next = host.usage();
		if (source !== next) {
			off?.();
			source = next;
			off = source?.subscribe(refresh);
		}
		const display = host.preferences().usageDisplay;
		const text = (source?.snapshot().providers ?? [])
			.flatMap((provider) => {
				const window = [...provider.windows].sort((a, b) => b.usedPercent - a.usedPercent)[0];
				return window
					? [
							`${provider.name} ${Math.round(display === 'used' ? window.usedPercent : 100 - window.usedPercent)}% ${window.label}`,
						]
					: [];
			})
			.join(' · ');
		if (button) {
			button.textContent = text;
			button.setAttribute('aria-label', text);
		}
		item.hidden = !text;
	};
	plugin.register(clear);
	return { refresh, dispose: clear };
}
