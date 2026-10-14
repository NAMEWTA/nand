/** Terminal URL clicks share this policy with the browser engine; file references stay local. */
export function terminalWebLinkAction(
	settings: {
		linkTarget: 'nand' | 'system';
		reverseLinkModifier: boolean;
		terminalLinkMenu: boolean;
	},
	event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean },
	source: 'terminal' | 'note' = 'terminal',
): 'nand' | 'system' | 'menu' {
	const modifier = event.ctrlKey || event.metaKey;
	if (source === 'terminal' && settings.terminalLinkMenu && !modifier) return 'menu';
	return settings.reverseLinkModifier && modifier && event.shiftKey
		? settings.linkTarget === 'nand'
			? 'system'
			: 'nand'
		: settings.linkTarget;
}
