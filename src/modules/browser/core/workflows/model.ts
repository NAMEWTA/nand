import type { BrowserPageTarget } from '../control';
import type { AssistantStep } from '../assistant/model';
import type { BrowserWorkflowAction } from '../../../../shared/automation/types';

export type WorkflowValue = string | number | boolean;
export interface WorkflowVariable { name: string; type: 'text' | 'number' | 'boolean' | 'secret'; required: boolean; default?: WorkflowValue }
export interface WorkflowScope { id: string; profileId: string; origin: string; pathPrefix: string }
/** Resolved afresh from each accessibility snapshot. Stored native element references are never reusable. */
export interface WorkflowLocator { role: string; name: string }
export type WorkflowCondition =
	| { kind: 'url'; equals: string }
	| { kind: 'exists'; element: WorkflowLocator }
	| { kind: 'value' | 'text'; element: WorkflowLocator; equals: string };
export type WorkflowOperation =
	| { operation: 'observe'; args: Record<string, never> }
	| { operation: 'read' | 'click'; args: { element: WorkflowLocator } }
	| { operation: 'fill'; args: { element: WorkflowLocator; value: string } }
	| { operation: 'keypress'; args: { element: WorkflowLocator; key: string } }
	| { operation: 'navigate'; args: { url: string } };
export type WorkflowStep = WorkflowOperation & { id: string; target: string; precondition: WorkflowCondition[]; postcondition: WorkflowCondition[] };
export interface BrowserWorkflowSpec {
	id: string; version: number; title: string; description: string;
	variables: WorkflowVariable[]; targetScope: WorkflowScope[]; steps: WorkflowStep[];
	consequenceClass: 'read-only' | 'page-input' | 'submission'; createdAt: number; updatedAt: number;
	verification?: { runId: string; version: number; at: number; material: string };
}
export interface WorkflowBinding { scopeId: string; target: BrowserPageTarget; url: string; title: string; accountLabel: string }
export interface WorkflowConditionEvidence { condition: WorkflowCondition; matched: boolean; observed?: string }
export interface WorkflowStepEvidence {
	id: string; state: 'pending' | 'precondition' | 'acting' | 'postcondition' | 'succeeded' | 'failed' | 'unknown';
	precondition: WorkflowConditionEvidence[]; postcondition: WorkflowConditionEvidence[];
	startedAt?: number; finishedAt?: number; errorCode?: string;
}
/** Browser-owned step/artifact evidence, linked to the single automations receipt by runId. */
export interface WorkflowExecution {
	runId: string; spec: BrowserWorkflowSpec; bindings: WorkflowBinding[];
	/** Secret values are never copied here, including into events, observations or result text. */
	publicInputs: Record<string, WorkflowValue>; secretNames: string[];
	phase: 'pending' | 'running' | 'confirming' | 'paused' | 'succeeded' | 'failed' | 'cancelled' | 'interrupted';
	steps: WorkflowStepEvidence[]; events: AssistantStep[]; result: string; errorCode?: string;
	createdAt: number; updatedAt: number;
}
export interface WorkflowData { version: 1; workflows: BrowserWorkflowSpec[]; executions: WorkflowExecution[] }
export interface WorkflowReview {
	id: string; spec: BrowserWorkflowSpec; action: BrowserWorkflowAction; bindings: WorkflowBinding[];
	secretNames: string[]; createdAt: number;
}
export const emptyWorkflows = (): WorkflowData => ({ version: 1, workflows: [], executions: [] });
