import type { AutomationsApi } from '../core/api';
import type { AutomationDefinition } from '../../../shared/automation/types';
import type { AutomationEditRequest } from '../core/api';
import type { TaskTarget } from './editor';
export interface AutomationViewHost {
	service: AutomationsApi;
	edit(definition?: AutomationDefinition): void;
	readonly pin?: (definition: AutomationDefinition) => Promise<void>;
	inbox(): void;
	retry(): Promise<void>;
	/** The pending edit request for the inline editor (taken once when the page navigates to `focusId: 'edit'`). */
	takeEdit?(): AutomationEditRequest | undefined;
	/** Cards a "create task" action can target. */
	taskTargets?(): Promise<TaskTarget[]>;
	/** Default working directory for agent and script actions (the vault folder on desktop). */
	readonly cwd?: string;
}
export interface AutomationPanelState {
	selected: string;
	search: string;
	filter: string;
	agentFilter: string;
}
export interface AutomationPanelActions {
	clearHistory(): void;
	remove(definition: AutomationDefinition): void;
	run(operation: () => Promise<unknown>): void;
}
