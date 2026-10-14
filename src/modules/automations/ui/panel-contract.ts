import type { AutomationsApi, AutomationEditRequest } from '../core/api';
import type { AutomationDefinition } from '../../../shared/automation/types';
import type { AutomationViewStore } from '../services/view-store';

export type TaskTarget = { path: string; cardId: string; title: string };
export interface AutomationViewHost {
	service: AutomationsApi;
	store: AutomationViewStore;
	skipDeleteConfirmation?(): boolean;
	setSkipDeleteConfirmation?(value: boolean): Promise<void>;
	edit(definition?: AutomationDefinition): void;
	inbox(): void;
	retry(): Promise<void>;
	refresh(): Promise<void>;
	takeEdit?(): AutomationEditRequest | undefined;
	taskTargets?(): Promise<TaskTarget[]>;
	paths(): Array<{ path: string; kind: 'file' | 'folder' }>;
	commands(): Array<{ id: string; name: string }>;
	readonly cwd?: string;
}
