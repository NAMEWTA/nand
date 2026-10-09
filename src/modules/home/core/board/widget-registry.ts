export interface WidgetKind {
	key: string;
	titleKey: string;
	icon: string;
	defaultSize: { w: number; h: number };
	minSize: { w: number; h: number };
	multiple?: boolean;
}

export interface WidgetBundle {
	kinds: readonly WidgetKind[];
}

const kind = (key: string, icon: string, w: number, h: number): WidgetKind => ({
	key,
	titleKey: `home.widget.${key}`,
	icon,
	defaultSize: { w, h },
	minSize: { w: Math.min(2, w), h: Math.min(2, h) },
});

/** Built-in widgets share one contribution bundle with external providers. */
export const builtinHomeWidgets: WidgetBundle = {
	kinds: [
		kind('calendar', 'calendar', 4, 6),
		kind('lunar', 'moon', 3, 4),
		kind('anniversary', 'cake', 3, 3),
		kind('countdown', 'timer', 3, 3),
		kind('habit', 'check-circle', 4, 5),
		kind('expense', 'wallet', 4, 5),
		kind('pomodoro', 'timer-reset', 3, 4),
		kind('reading', 'book-open', 4, 5),
		kind('weather', 'cloud-sun', 3, 3),
		kind('music', 'music', 4, 3),
		kind('album', 'image', 4, 4),
		kind('year-progress', 'calendar-range', 4, 2),
		kind('quick-actions', 'zap', 4, 3),
		kind('library', 'library', 6, 8),
		kind('weread', 'book', 6, 6),
		kind('dataview', 'table', 6, 6),
		kind('web', 'globe', 6, 6),
	],
};

export interface IndexedWidgets {
	byKey: ReadonlyMap<string, { module: string; kind: WidgetKind }>;
	errors: readonly string[];
}

/** Index `(provider, kind)`. A repeated kind is reported and does not replace the first. */
export function indexWidgetProviders(bundles: readonly { module: string; bundle: WidgetBundle }[]): IndexedWidgets {
	const byKey = new Map<string, { module: string; kind: WidgetKind }>();
	const errors: string[] = [];
	for (const item of bundles) {
		for (const entry of item.bundle.kinds) {
			if (byKey.has(entry.key)) errors.push(`duplicate widget ${entry.key}`);
			else byKey.set(entry.key, { module: item.module, kind: entry });
		}
	}
	return { byKey, errors };
}

export type MemberMount = 'mount' | 'disabled' | 'unknown';

export function memberMount(member: { kind: string; provider: string }, index: IndexedWidgets, enabled: ReadonlySet<string>): MemberMount {
	const found = index.byKey.get(member.kind);
	if (!found || found.module !== member.provider) return 'unknown';
	return enabled.has(member.provider) ? 'mount' : 'disabled';
}

/** Unknown and disabled providers stay on the board. Normalize does not delete them. */
export function normalizeMembers<T extends { id: string; kind: string; provider: string }>(members: readonly T[], index: IndexedWidgets): T[] {
	const seen = new Set<string>();
	const kept: T[] = [];
	for (const member of members) {
		if (seen.has(member.id)) continue;
		seen.add(member.id);
		const registered = index.byKey.get(member.kind);
		// A kind owned by another provider stays on this board. Normalize never deletes it.
		kept.push(registered && registered.module !== member.provider ? { ...member } : member);
	}
	return kept;
}

/** Removing a member from one board does not delete the shared instance record. */
export function removeBoardMember<T extends { id: string }>(members: readonly T[], instances: Readonly<Record<string, unknown>>, id: string): { members: T[]; instances: Readonly<Record<string, unknown>> } {
	return { members: members.filter((member) => member.id !== id), instances };
}
