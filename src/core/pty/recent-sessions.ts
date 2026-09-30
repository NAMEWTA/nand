/**
 * MRU ordering adapted from Orca v1.4.217 recent-tab-switching.ts.
 * Copyright (c) 2026 Lovecast Inc. MIT; see docs/third-party/orca-LICENSE.txt.
 */
export function orderRecentSessions<T extends { id: string }>(
	sessions: readonly T[],
	recentIds: readonly string[],
	activeId?: string,
): T[] {
	const byId = new Map(sessions.map((session) => [session.id, session]));
	const ordered: T[] = [];
	const seen = new Set<string>();
	const append = (id: string) => {
		const session = byId.get(id);
		if (session && !seen.has(id)) {
			ordered.push(session);
			seen.add(id);
		}
	};
	if (activeId) append(activeId);
	for (let index = recentIds.length - 1; index >= 0; index--) append(recentIds[index]!);
	for (const session of sessions) append(session.id);
	return ordered;
}
