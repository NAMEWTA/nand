import type { AutomationsApi } from '../../core/automations/api';
import type { AutomationDefinition } from '../../shared/automation/types';
export interface AutomationViewHost {
	service: AutomationsApi;
	edit(definition?: AutomationDefinition): void;
	pin?(definition: AutomationDefinition): Promise<void>;
	inbox(): void;
	retry(): Promise<void>;
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
