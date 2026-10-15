import type { SkillsSectionConfig } from '../board/types';
export function skillGroup(name: string, config: SkillsSectionConfig): string {
	const assigned = config.assignments?.[name];
	if (assigned) return config.groups?.some((group) => group.id === assigned) ? assigned : '_none';
	return (
		config.groups?.find((group) =>
			group.keywords
				?.split(',')
				.some((word) => word.trim() && name.toLowerCase().includes(word.trim().toLowerCase())),
		)?.id ?? '_none'
	);
}
export function retainSkillAssignments(
	config: SkillsSectionConfig,
	groups: NonNullable<SkillsSectionConfig['groups']>,
): Record<string, string> {
	return Object.fromEntries(
		Object.entries(config.assignments ?? {}).map(([name, id]) => [
			name,
			groups.some((group) => group.id === id) ? id : '_none',
		]),
	);
}
