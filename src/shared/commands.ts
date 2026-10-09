/**
 * Command ids without the plugin-id prefix. Obsidian adds `nand:`
 * when the command is registered.
 */
export const NAND_COMMANDS = {
	OPEN_DASHBOARD: 'open-dashboard',
	OPEN_EDITOR_VIEW: 'open-editor-view',
	ADD_COMMENT: 'add-comment-to-selection',
} as const;
