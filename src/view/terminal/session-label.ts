export function shortSessionId(id: string, ids: readonly string[]): string {
	let length = Math.min(8, id.length);
	while (length < id.length && ids.some(other => other !== id && other.slice(0, length) === id.slice(0, length))) length++;
	return `#${id.slice(0, length)}`;
}

const visibleLabels = new WeakMap<object, string>();

/** Once a live session needs a longer prefix, closing peers must not rename it. */
export function sessionLabel(session: { id: string }, sessions: readonly { id: string }[]): string {
	const next = shortSessionId(session.id, sessions.map(item => item.id));
	const previous = visibleLabels.get(session);
	const label = previous && previous.length > next.length ? previous : next;
	visibleLabels.set(session, label);
	return label;
}
