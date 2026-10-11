import { contributionPoint, serviceKey } from '../../app/contracts/module';
import type { AgentRuntimePort, AutomationAction, AutomationActionHandle, AutomationDefinition, AutomationUiPort, BrowserWorkflowAction, RunStatus, SourceRef } from '../../shared/automation/types';
import type { AgentDispatchRequest, AgentDispatchReceipt } from '../../shared/agent-dispatch';

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
/** Journal-backed deliveries; never activate an agent or choose another destination implicitly. */
export interface AutomationInvocations {
	invoke(request: AgentDispatchRequest, options?: { signal?: AbortSignal }): Promise<AgentDispatchReceipt>;
	receipt(invocationId: string): AgentDispatchReceipt | undefined;
}
export const AUTOMATION_INVOCATIONS = serviceKey<AutomationInvocations>('automations', 'invocations');
/** Agent and script execution; provided by the agent module (desktop only). */
export const AUTOMATION_AGENT_RUNTIME = serviceKey<AgentRuntimePort>('agent', 'automation-runtime');

export interface AutomationWorkflowChoice {
	id: string; version: number; title: string; verified: boolean;
	variables: Array<{ name: string; type: 'text' | 'number' | 'boolean' | 'secret'; required: boolean; default?: string | number | boolean }>;
	scope: Array<{ id: string; profileId: string; origin: string; pathPrefix: string }>;
}
/** Browser contributes this while active. Collection never activates an unavailable producer. */
export interface AutomationWorkflowRunner {
	readonly revoked: AbortSignal;
	list(): Promise<AutomationWorkflowChoice[]>;
	pages(): Array<{ pageId: string; profileId: string; title: string; url: string }>;
	/** Reject undeclared/secret values before the owner writes a definition or invocation. */
	validate(action: BrowserWorkflowAction): Promise<void>;
	start(action: BrowserWorkflowAction, context: { runId: string; trigger: 'manual' | 'scheduled'; signal: AbortSignal; authorizationId?: string }): Promise<AutomationActionHandle>;
	open(runId: string): Promise<void>;
}
export interface AutomationWorkflowRequest {
	invocationId: string; title: string; action: BrowserWorkflowAction; source: SourceRef;
}
export interface AutomationWorkflowReceipt {
	invocationId?: string; runId: string; status: RunStatus; errorCode?: string; output?: string;
}
export interface AutomationWorkflowInvocations {
	invoke(request: AutomationWorkflowRequest, options?: { signal?: AbortSignal; authorizationId?: string }): Promise<AutomationWorkflowReceipt>;
	receipt(invocationId: string): AutomationWorkflowReceipt | undefined;
	cancel(runId: string): Promise<void>;
	open(runId: string): Promise<void>;
}
export const AUTOMATION_WORKFLOW_RUNNERS = contributionPoint<AutomationWorkflowRunner>('automations', 'browser-workflows');
export const AUTOMATION_WORKFLOW_INVOCATIONS = serviceKey<AutomationWorkflowInvocations>('automations', 'workflow-invocations');
