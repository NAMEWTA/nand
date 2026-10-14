import { createContext, useContext } from 'react';
import type { NativeSurfaceContext } from '../../../../ui/native-surface';
import type { AgentController } from '../../services/controller';
export interface WorkspaceUI {
	chrome?: {
		context: NativeSurfaceContext;
		menu: string | undefined;
		setMenu: (groupId: string | undefined) => void;
	};
	controller: AgentController;
	confirm: (message: string) => Promise<boolean>;
	close: (tabId: string) => void;
}
export const WorkspaceUIContext = createContext<WorkspaceUI | null>(null);
export function useWorkspaceUI(): WorkspaceUI {
	const value = useContext(WorkspaceUIContext);
	if (!value) throw new Error('Missing workspace UI');
	return value;
}
