/** Entry-level ownership of hook commands inside provider settings that users also edit. */

type Row = unknown;
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/**
 * Remove only the commands `owns` recognises. A group keeps its matcher, other commands and other fields; a group is
 * dropped only when removing our commands left it without any command.
 */
export function stripOwnedRows(rows: Row[], owns: (command: string) => boolean): { rows: Row[]; removed: number } {
	let removed = 0;
	const ours = (entry: unknown): boolean => isObject(entry) && typeof entry.command === 'string' && owns(entry.command);
	const kept = rows.flatMap((row): Row[] => {
		if (!isObject(row)) return [row];
		if (!Array.isArray(row.hooks)) {
			if (ours(row)) { removed++; return []; }
			return [row];
		}
		const hooks = row.hooks.filter(entry => !ours(entry));
		const dropped = row.hooks.length - hooks.length;
		if (!dropped) return [row];
		removed += dropped;
		return hooks.length ? [{ ...row, hooks }] : [];
	});
	return { rows: kept, removed };
}

/** Strip our commands from every event; events we emptied (and an emptied `hooks` object) disappear. */
export function stripOwnedHooks(settings: Record<string, unknown>, owns: (command: string) => boolean): { settings: Record<string, unknown>; removed: number } {
	if (!isObject(settings.hooks)) return { settings, removed: 0 };
	const hooks: Record<string, unknown> = { ...settings.hooks };
	let removed = 0;
	for (const [event, rows] of Object.entries(hooks)) {
		if (!Array.isArray(rows)) continue;
		const result = stripOwnedRows(rows, owns);
		if (!result.removed) continue;
		removed += result.removed;
		if (result.rows.length) hooks[event] = result.rows; else delete hooks[event];
	}
	if (!removed) return { settings, removed: 0 };
	// Keep the user's key order; only `hooks` changes in place.
	const next: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(settings)) {
		if (key !== 'hooks') next[key] = value;
		else if (Object.keys(hooks).length) next.hooks = hooks;
	}
	return { settings: next, removed };
}
