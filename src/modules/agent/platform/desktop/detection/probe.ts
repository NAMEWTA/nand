import { AGENT_CATALOG } from '../../../core/launch/catalog';
import type { TerminalSettings } from '../../../core/terminal/settings';
import type { DetectedAgents } from '../../../core/detection/merge';
import { resolveCli } from '../agents/resolver';
export function probeAgents(overrides: TerminalSettings['overrides'], path: string): DetectedAgents {
	return Object.fromEntries(
		AGENT_CATALOG.flatMap((a) => {
			const command = resolveCli(a.detectCommand, overrides[a.id]?.command || '', path);
			return command ? [[a.id, command]] : [];
		}),
	);
}
