import { contributionPoint, serviceKey } from '../../app/contracts/module';
import type { AgentRuntimePort, AutomationAction, AutomationDefinition, AutomationUiPort, SourceRef } from '../../shared/automation/types';

/**
 * A product that keeps automation definitions inside its own documents (board widgets and cards, archive
 * reminders). Contributed to `automations.sources` while the product is active.
 */
export interface AutomationSource {
	/** The source kinds this product owns. */
	readonly kinds: readonly SourceRef['kind'][];
	list(): Promise<AutomationDefinition[]>;
	/** Write the definition back into its document, or remove it (`remove`). */
	save(definition: AutomationDefinition, remove?: boolean): Promise<void>;
	open(source: SourceRef, ownerWindow?: Window): Promise<void>;
	/** Boards only: the "create task" action. */
	readonly createTask?: (action: Extract<AutomationAction, { kind: 'create-task' }>, runId: string) => Promise<void>;
	/** Boards only: cards a "create task" action can target. */
	readonly taskTargets?: () => Promise<Array<{ path: string; cardId: string; title: string }>>;
	/** Boards only: documents a definition can be pinned to as a quick action. */
	readonly pinTargets?: () => string[];
	readonly pin?: (path: string, definition: AutomationDefinition) => Promise<void>;
}

/** Automations as other products see them: quick actions, editing and opening the page. */
export interface AutomationsService extends AutomationUiPort {
	/** Set when definitions or run history could not be read. */
	readonly loadError: string;
	/** Runs that are pending or running. */
	activeRuns(): ReadonlyArray<{ id: string }>;
	subscribe(listener: () => void): () => void;
}

export const AUTOMATION_SOURCES = contributionPoint<AutomationSource>('automations', 'sources');
export const AUTOMATIONS = serviceKey<AutomationsService>('automations', 'ui');
/** Agent and script execution; provided by the agent module (desktop only). */
export const AUTOMATION_AGENT_RUNTIME = serviceKey<AgentRuntimePort>('agent', 'automation-runtime');
