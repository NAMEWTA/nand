export type WorkspaceCommand =
	| 'newTerminal'
	| 'newAgent'
	| 'newBrowser'
	| 'newMenu'
	| 'close'
	| 'reopen'
	| 'next'
	| 'previous'
	| 'recent'
	| 'splitRight'
	| 'splitDown';
export function workspaceShortcut(event: {
	key: string;
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
	altKey: boolean;
	isComposing?: boolean;
}): WorkspaceCommand | undefined {
	if (event.isComposing) return undefined;
	const key = event.key.toLowerCase(),
		mod = event.ctrlKey || event.metaKey;
	if (event.ctrlKey && !event.altKey && key === 'tab') return 'recent';
	if (!mod) return undefined;
	if (event.altKey) return key === 'n' && !event.shiftKey ? 'newAgent' : undefined;
	if (key === 't') return event.shiftKey ? 'reopen' : 'newTerminal';
	if (key === 'w' && !event.shiftKey) return 'close';
	if (event.shiftKey && key === 'b') return 'newBrowser';
	if (event.shiftKey && key === 'n') return 'newMenu';
	if (event.shiftKey && [']', '}'].includes(key)) return 'next';
	if (event.shiftKey && ['[', '{'].includes(key)) return 'previous';
	if (key === '\\' || key === '|') return event.shiftKey ? 'splitDown' : 'splitRight';
	return undefined;
}
