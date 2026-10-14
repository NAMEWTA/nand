import { expect, test } from 'vitest';
import { sessionBucket } from './sidebar';
import type { AgentState, TerminalTabData } from './model';
import { sessionState } from '../../services/terminal/status';
import type { TerminalSession } from '../../services/terminal/session';
const tab = (state: AgentState, unread = false) =>
	({ kind: 'terminal', agentId: 'codex', state, unread }) as TerminalTabData;
test.each(['waiting', 'permission', 'failed', 'interrupted'] as const)(
	'%s needs attention, never implies successful completion',
	(state) => {
		expect(sessionBucket(tab(state))).toBe('attention');
		expect(sessionBucket(tab(state, true))).toBe('attention');
	},
);
test('unknown is explicit regardless of unread, working stays working and ordinary shells remain terminals', () => {
	expect(sessionBucket(tab('unknown'))).toBe('unknown');
	expect(sessionBucket(tab('unknown', true))).toBe('unknown');
	expect(sessionBucket(tab('working', true))).toBe('working');
	expect(sessionBucket({ ...tab('unknown'), agentId: undefined })).toBe('terminal');
});
test.each([false, true])('completion before and after 30 minutes retains discoverability when unread=%s', (unread) => {
	const session = { connection: 'connected', activity: 'done', activityAt: 1000 } as TerminalSession;
	expect(sessionBucket(tab(sessionState(session, 1000 + 29 * 60_000), unread))).toBe('done');
	expect(sessionBucket(tab(sessionState(session, 1000 + 31 * 60_000), unread))).toBe(unread ? 'done' : 'idle');
});

test('successful process exit uses the same read/unread aging rule', () => {
	const session = { connection: 'exited', exitCode: 0, activityAt: 1000 } as TerminalSession;
	expect(sessionBucket(tab(sessionState(session, 1000 + 29 * 60_000)))).toBe('done');
	expect(sessionBucket(tab(sessionState(session, 1000 + 31 * 60_000)))).toBe('idle');
	expect(sessionBucket(tab(sessionState(session, 1000 + 31 * 60_000), true))).toBe('done');
});
