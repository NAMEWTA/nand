import type { DataAdapter } from 'obsidian';
import type { SettingsHandle } from '../../../shared/settings/store';
import { buildAgentPrompt } from '../../../shared/agent-prompt';
import { agentSkillCapability } from '../../../shared/agent-skill-capabilities';
import type { AgentSkills, SkillScan } from '../api';
import { AGENT_IDS } from '../core/launch/defaults';
import { AGENT_CATALOG } from '../core/launch/catalog';
import type { TerminalSettings } from '../core/terminal/settings';
import { mergeSkills } from '../core/skills/registry';
import { scanVaultSkills } from '../platform/skills/vault-skills';

export class AgentSkillDirectory implements AgentSkills {
	private closed = false;
	private pending = new Set<AbortController>();
	constructor(private readonly adapter: Pick<DataAdapter, 'exists' | 'list' | 'read'>, private readonly settings: Pick<SettingsHandle<TerminalSettings>, 'get' | 'update'>, private readonly desktop: boolean,
		private readonly scanDirectories: (paths: readonly string[], signal: AbortSignal) => Promise<SkillScan> = async (paths, signal) => (await import('../platform/desktop/skills/directory-skills')).scanDirectorySkills(paths, signal)) {}
	capability(agentId: string) { return agentSkillCapability(agentId); }
	targets() { return AGENT_CATALOG.map(({ id, title }) => ({ id, title })); }
	async list(agentId: string, signal?: AbortSignal): Promise<SkillScan> {
		this.assertActive(agentId);
		const abort = new AbortController();
		const cancel = () => abort.abort();
		signal?.addEventListener('abort', cancel, { once: true });
		if (signal?.aborted) cancel();
		this.pending.add(abort);
		try {
			const { knownSkills, skillDirectories } = this.settings.get();
			const remembered = (knownSkills[agentId] ?? []).map(name => ({ name, sources: [{ kind: 'remembered' as const, path: agentId }] }));
			const vault = await scanVaultSkills(this.adapter, abort.signal);
			const extra = this.desktop && skillDirectories.length ? await this.scanDirectories([...skillDirectories], abort.signal) : { entries: [], unavailable: [] };
			abort.signal.throwIfAborted();
			return { entries: mergeSkills([...vault.entries, ...extra.entries, ...remembered]), unavailable: [...new Set([...vault.unavailable, ...extra.unavailable])] };
		} finally { this.pending.delete(abort); signal?.removeEventListener('abort', cancel); }
	}
	async remember(agentId: string, name: string): Promise<void> {
		this.assertActive(agentId);
		if (!name) return;
		if (!buildAgentPrompt({ skillName: name, promptTemplate: '' }, {}, this.capability(agentId)).ok) throw new Error('invalid-skill');
		if (this.settings.get().knownSkills[agentId]?.includes(name)) return;
		await this.settings.update(draft => { draft.knownSkills[agentId] = [...(draft.knownSkills[agentId] ?? []), name].slice(-200); });
	}
	async forget(agentId: string, name: string): Promise<void> {
		this.assertActive(agentId);
		await this.settings.update(draft => { draft.knownSkills[agentId] = (draft.knownSkills[agentId] ?? []).filter(value => value !== name); });
	}
	dispose(): void { this.closed = true; for (const abort of this.pending) abort.abort(); this.pending.clear(); }
	private assertActive(agentId: string): void {
		if (this.closed) throw new Error('unavailable');
		if (!AGENT_IDS.some(id => id === agentId)) throw new Error('unsupported');
	}
}
