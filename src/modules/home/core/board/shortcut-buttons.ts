/**
 * One button of the Shortcuts widget: open a note, run a command, run a saved automation, start an agent with a prompt
 * or run one of the agent module's saved terminal quick commands (`quick`, by id).
 */
export type ShortcutType = 'file' | 'command' | 'automation' | 'agent' | 'quick';
export const SHORTCUT_TYPES: readonly ShortcutType[] = ['file', 'command', 'automation', 'quick', 'agent'];

export interface ShortcutButton {
	id: string;
	label: string;
	/** Lucide icon name. */
	icon: string;
	type: ShortcutType;
	/** Note path, command id, automation action id or quick command id; unused for `agent`. */
	target: string;
	/** `agent` only: the agent to start and the prompt it receives. */
	agentId?: string;
	prompt?: string;
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** Keep well-formed buttons in order; entries with a missing id, an unknown type or a repeated id are dropped. */
export function readShortcutButtons(value: unknown): ShortcutButton[] {
	if (!Array.isArray(value)) return [];
	const seen = new Set<string>(),
		result: ShortcutButton[] = [];
	for (const item of value) {
		if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
		const row = item as Record<string, unknown>,
			id = text(row.id).trim(),
			type = SHORTCUT_TYPES.find((candidate) => candidate === row.type);
		if (!id || !type || seen.has(id)) continue;
		seen.add(id);
		result.push({
			id,
			label: text(row.label),
			icon: text(row.icon) || 'zap',
			type,
			target: text(row.target),
			...(type === 'agent' ? { agentId: text(row.agentId), prompt: text(row.prompt) } : {}),
		});
	}
	return result;
}

/** Whether a button has what it needs to run. */
export function shortcutRunnable(button: ShortcutButton): boolean {
	return button.type === 'agent' ? !!button.agentId?.trim() && !!button.prompt?.trim() : !!button.target.trim();
}

export type ShortcutLayout = 'icons' | 'grid' | 'rows';

/** Icons only in a narrow tile, a grid of labelled buttons by default, and a row list with hotkeys when there is room. */
export function shortcutLayout(box: { width: number; height: number }): ShortcutLayout {
	if (box.width < 170) return 'icons';
	return box.width >= 280 && box.height >= 150 ? 'rows' : 'grid';
}

/** An Obsidian hotkey as the key names `ShortcutKeyCombo` renders. */
export function hotkeyKeys(hotkey: { modifiers: readonly string[]; key: string }): string[] {
	const order = ['Mod', 'Ctrl', 'Meta', 'Alt', 'Shift'],
		modifiers = order.filter((name) => hotkey.modifiers.includes(name));
	return [...modifiers, hotkey.key.length === 1 ? hotkey.key.toUpperCase() : hotkey.key];
}
