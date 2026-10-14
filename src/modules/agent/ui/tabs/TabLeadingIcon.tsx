// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/tab-bar/TerminalTabLeadingIcon.tsx
import { BellRing, Globe, TerminalSquare } from 'lucide-react';
import type { WorkspaceTab } from '../../core/workspace/model';
import { AgentIcon } from '../../../../ui/components/nand/AgentIcon';
import { StatusDot } from '../../../../ui/components/nand/StatusDot';
import { useT } from '../../../../ui/react/hooks';
export function TabLeadingIcon({ tab, sidebar = false }: { tab: WorkspaceTab; sidebar?: boolean }) {
	const t = useT();
	return (
		<span className="inline-flex shrink-0 items-center gap-1">
			{tab.kind === 'browser' ? (
				<Globe className="size-3" />
			) : tab.agentId ? (
				<AgentIcon agent={tab.agentId} size={12} />
			) : (
				<TerminalSquare className="size-3" />
			)}
			{tab.kind === 'terminal' && tab.agentId && (
				<StatusDot
					state={tab.state}
					label={t(`agent.workspace.state.${tab.state}`)}
					size={sidebar ? 'md' : 'sm'}
					sidebar={sidebar}
				/>
			)}
			{tab.kind === 'terminal' && tab.unread && !['working', 'waiting', 'permission'].includes(tab.state) && (
				<BellRing
					aria-label={t('agent.workspace.unread')}
					className="size-3 fill-status-warning text-status-warning"
				/>
			)}
		</span>
	);
}
