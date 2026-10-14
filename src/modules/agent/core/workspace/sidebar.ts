import type { WorkspaceTab } from './model';

export type SessionBucket = 'attention' | 'working' | 'done' | 'idle' | 'unknown' | 'terminal' | 'browser';
export function sessionBucket(tab: WorkspaceTab): SessionBucket {
	if (tab.kind === 'browser') return 'browser';
	if (!tab.agentId) return 'terminal';
	switch (tab.state) {
		case 'waiting':
		case 'permission':
		case 'failed':
		case 'interrupted':
			return 'attention';
		case 'working':
			return 'working';
		case 'done':
			return 'done';
		case 'idle':
			return tab.unread ? 'done' : 'idle';
		case 'unknown':
			return 'unknown';
	}
}
