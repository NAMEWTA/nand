import type { AgentDispatchRequest } from '../../../../shared/agent-dispatch';

export interface SkillContext {
	source: AgentDispatchRequest['source'];
	variables: Readonly<Record<string, string>>;
	files: readonly string[];
}

/** Callers resolve live files at the trigger. No active-file or vault-wide fallback. */
export function buildSkillContext(value: {
	source: SkillContext['source']; path?: string; title: string; input?: string;
	folder?: string; stage?: string; files?: readonly string[];
}): SkillContext {
	const path = value.path ?? '';
	const files = [...new Set(value.files ?? [])];
	return {
		source: { ...value.source }, files,
		variables: { path, title: value.title, input: value.input ?? '', stage: value.stage ?? '',
			folder: path ? path.slice(0, Math.max(0, path.lastIndexOf('/'))) : value.folder ?? '', paths: files.join('\n') },
	};
}
