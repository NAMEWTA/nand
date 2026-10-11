import type { App, TFile } from 'obsidian';
import { AutomationError } from '../../../../shared/automation/errors';
import { isDefinition } from '../../../../shared/automation/metadata';
import type { AutomationDefinition, SourceRef } from '../../../../shared/automation/types';
import type { PipelineConfig } from '../../core/pipeline/model';
import { pipelineDue } from '../../core/pipeline/due';
import { pipelineIncludes } from '../../core/pipeline/rules';
import { PipelineVault } from './vault';

export interface PipelineScope { boardPath: string; config: PipelineConfig }
interface Binding extends PipelineScope { notePath: string }

/** Contributes note reminders to Home's existing source; no timer or execution loop. */
export class PipelineAutomationSource {
	private bindings = new Map<string, Binding>();
	private readonly vault: PipelineVault;
	constructor(private readonly app: App) { this.vault = new PipelineVault(app); }
	async list(scopes: readonly PipelineScope[]): Promise<AutomationDefinition[]> {
		const definitions = new Map<string, AutomationDefinition>(), bindings = new Map<string, Binding>(), duplicates = new Set<string>();
		for (const scope of scopes) for (const candidate of this.vault.scan(scope.config)) {
			if (!isDefinition(candidate.frontmatter.nandAutomation)) continue;
			const { note } = await this.vault.read(candidate.path);
			if (!pipelineIncludes(scope.config, note)) continue;
			const definition = note.frontmatter.nandAutomation, due = pipelineDue(note.frontmatter.due);
			if (!isDefinition(definition) || !definition.id.startsWith('pipeline:') || !due || note.frontmatter.remind !== true) continue;
			const previous = bindings.get(definition.id);
			if (previous) { if (previous.notePath !== note.path) duplicates.add(definition.id); continue; }
			bindings.set(definition.id, { ...scope, notePath: note.path });
			definitions.set(definition.id, { ...definition, source: { kind: 'dashboard', path: scope.boardPath, id: definition.id },
				schedule: { kind: 'once', at: due.at }, revision: definition.schedule.kind === 'once' && definition.schedule.at === due.at ? definition.revision : due.at });
		}
		for (const id of duplicates) { bindings.delete(id); definitions.delete(id); }
		this.bindings = bindings;
		return [...definitions.values()];
	}
	resolve(source: SourceRef): TFile {
		const binding = this.bindings.get(source.id);
		const file = binding?.boardPath === source.path ? this.app.vault.getFileByPath(binding.notePath) : null;
		if (!file) throw new AutomationError('sourceMissing');
		return file;
	}
	async save(definition: AutomationDefinition, remove: boolean): Promise<void> {
		const source = definition.source, binding = source ? this.bindings.get(source.id) : undefined;
		if (!source || !binding || source.path !== binding.boardPath) throw new AutomationError('sourceMissing');
		const { note } = await this.vault.read(binding.notePath);
		if (!isDefinition(note.frontmatter.nandAutomation) || note.frontmatter.nandAutomation.id !== source.id) throw new AutomationError('sourceMissing');
		if (definition.schedule.kind !== 'once') throw new AutomationError('invalid');
		const date = new Date(definition.schedule.at), pad = (value: number) => String(value).padStart(2, '0');
		const due = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
		await this.vault.updateFields(binding.config, binding.notePath, {
			due, remind: remove ? undefined : true, nandAutomation: remove ? undefined : { ...definition, source: undefined },
		}, source.id);
	}
}
