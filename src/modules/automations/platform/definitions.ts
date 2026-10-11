import type { App } from 'obsidian';
import {
	automationDocuments,
	type AutomationDefinitionsRepository,
	type DefinitionCollection,
} from '../core/documents';
import type { AutomationDefinition } from '../../../shared/automation/types';
import { DurableState } from '../../../shared/storage/durable-state';
import { MarkdownCollectionStorage } from '../../../host/obsidian/storage/document-collection';

export class MarkdownAutomationDefinitions implements AutomationDefinitionsRepository {
	private storage: MarkdownCollectionStorage<DefinitionCollection>;
	private repository: DurableState<DefinitionCollection>;
	constructor(app: App) {
		this.storage = new MarkdownCollectionStorage(app, automationDocuments, 'domain/automations.json');
		this.repository = new DurableState(
			this.storage,
			'domain/automations.json',
			() => automationDocuments.empty(),
			(value) => value as DefinitionCollection,
			() => undefined,
		);
	}
	/** Re-read the collection and propagate unreadable documents instead of publishing stale definitions. */
	async list(): Promise<AutomationDefinition[]> {
		await this.repository.sync(true);
		return structuredClone(this.repository.value.definitions);
	}
	async save(definition: AutomationDefinition): Promise<void> {
		await this.repository.sync(true);
		const definitions = this.repository.value.definitions.filter((row) => row.id !== definition.id);
		this.repository.value = { definitions: [...definitions, definition] };
		this.repository.save();
		await this.repository.flush();
	}
	async remove(definition: AutomationDefinition): Promise<void> {
		await this.repository.sync(true);
		this.repository.value = {
			definitions: this.repository.value.definitions.filter((row) => row.id !== definition.id),
		};
		this.repository.save();
		await this.repository.flush();
	}
	async shutdown(): Promise<void> {
		try {
			await this.repository.shutdown();
		} finally {
			this.storage.dispose();
		}
	}
}
