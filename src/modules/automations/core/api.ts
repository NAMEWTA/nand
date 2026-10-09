import type {
	AgentRuntimePort,
	AutomationDefinition,
	AutomationRun,
	AutomationSourcePort,
	SourceRef,
} from '../../../shared/automation/types';

/** What the editor opens for: a new definition (optionally from a board or archive source) or an existing one. */
export interface AutomationEditRequest {
	source?: SourceRef;
	title?: string;
	existing?: AutomationDefinition;
}

/** Read and action surface shared by native hosts and any automation panel. */
export interface AutomationsApi {
	readonly executionEnabled: boolean;
	readonly deviceId: string;
	readonly loadError: string;
	readonly definitions: readonly AutomationDefinition[];
	readonly state: { readonly runs: readonly AutomationRun[]; readonly cursors: Readonly<Record<string, number>> };
	readonly sources: AutomationSourcePort;
	agent(): AgentRuntimePort | undefined;
	subscribe(listener: () => void): () => void;
	save(definition: AutomationDefinition): Promise<void>;
	remove(definition: AutomationDefinition): Promise<void>;
	clearHistory(): Promise<void>;
	tick(now?: number): Promise<void>;
	run(
		definition: AutomationDefinition,
		trigger?: 'manual' | 'scheduled',
		at?: number,
		now?: number,
	): Promise<AutomationRun | undefined>;
	stop(run: AutomationRun): Promise<void>;
}
