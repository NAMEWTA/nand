import type { SkillShortcut } from './types/model';

/** Invalid declarations stay in the source document until the user explicitly edits skills. */
export function readSkillShortcuts(value: unknown): SkillShortcut[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const result: SkillShortcut[] = [];
	const seen = new Set<string>();
	for (const item of value) {
		if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
		const row = item as Record<string, unknown>;
		if (typeof row.id !== 'string' || !row.id.trim() || seen.has(row.id) || typeof row.agentId !== 'string' || !row.agentId.trim()) continue;
		if (typeof row.label !== 'string' || typeof row.skillName !== 'string' || typeof row.promptTemplate !== 'string') continue;
		const target = row.destination;
		if (!target || typeof target !== 'object' || Array.isArray(target)) continue;
		const dest = target as Record<string, unknown>;
		if (dest.kind !== 'fresh' && dest.kind !== 'existing') continue;
		if (dest.kind === 'existing' && typeof dest.sessionId !== 'string') continue;
		seen.add(row.id);
		result.push({ id: row.id, label: row.label, agentId: row.agentId, skillName: row.skillName, promptTemplate: row.promptTemplate,
			...(typeof row.icon === 'string' ? { icon: row.icon } : {}), ...(typeof row.inputPlaceholder === 'string' ? { inputPlaceholder: row.inputPlaceholder } : {}),
			directSend: row.directSend === true, destination: dest.kind === 'existing' ? { kind: 'existing', sessionId: dest.sessionId as string } : { kind: 'fresh', cwd: typeof dest.cwd === 'string' ? dest.cwd : '' } });
	}
	return result;
}
