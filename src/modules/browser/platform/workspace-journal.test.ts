import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { TextStorage } from '../../../shared/storage/ports';
import { WorkspaceJournal } from './workspace-journal';

test('durable intent blocks failed writes, binds a generation, and never silently retries an interrupted dispatch', async () => {
	const files = new Map<string, string>(); let fail = false;
	const storage: TextStorage = { exists: async path => files.has(path), read: async path => files.get(path)!, mkdir: async () => {},
		write: async (path, text) => { if (fail && path === 'journal.json') { fail = false; throw Error('read-only'); } files.set(path, text); } };
	let journal = new WorkspaceJournal(storage, 'journal.json', () => {});
	const input = { id: 'first', taskId: 'task', turnId: 'turn', exchangeId: 'exchange', target: { pageId: 'page', profileId: 'profile', generation: 'old' }, promptHash: 'a'.repeat(64), at: 1 };
	fail = true; await assert.rejects(journal.reserve(input), /read-only/);
	assert.equal(journal.list().length, 0);
	await journal.reserve(input); input.target.generation = 'new';
	assert.equal(journal.list()[0]!.expectedTarget.generation, 'old');
	await journal.staged('first');
	fail = true; await assert.rejects(journal.dispatching('first', 2), /read-only/);
	assert.equal(journal.list()[0]!.outcome, 'staged', 'A caller cannot proceed to commit after failed durable dispatch intent');
	await journal.dispatching('first', 2); await journal.shutdown();
	journal = new WorkspaceJournal(storage, 'journal.json', () => {}); await journal.ready; await journal.recover();
	assert.equal(journal.list()[0]!.outcome, 'unknown');
	await assert.rejects(journal.reserve({ ...input, id: 'second' }), /retry_review/);
	await assert.rejects(journal.reserve({ ...input, id: 'second', retryOf: 'first', promptHash: 'b'.repeat(64) }), /attempt_changed/);
	await assert.rejects(journal.reserve({ ...input, id: 'second', retryOf: 'first', target: { ...input.target, profileId: 'other' } }), /attempt_changed/);
	await journal.reserve({ ...input, id: 'second', retryOf: 'first', at: 3 });
	await assert.rejects(journal.accepted('first', { messageId: 'late-message', conversationId: 'conversation' }, 4), /attempt_changed/);
	await journal.staged('second'); await journal.dispatching('second', 4); await journal.accepted('second', { messageId: 'accepted-message', conversationId: 'conversation' }, 5);
	await assert.rejects(journal.dispatching('second', 6), /attempt_changed/);
	assert.equal(journal.list()[1]!.acceptedMessageId, 'accepted-message');
	await journal.shutdown();
});

test('malformed journal cannot be overwritten by a new attempt', async () => {
	let writes = 0;
	const storage: TextStorage = { exists: async () => true, read: async () => '{"version":1,"attempts":[{"id":"broken"}]}', mkdir: async () => {}, write: async () => { writes++; } };
	const journal = new WorkspaceJournal(storage, 'journal.json', () => {});
	await assert.rejects(journal.ready, /browser_workspace_journal/);
	await assert.rejects(journal.reserve({ id: 'new', taskId: 'task', turnId: 'turn', exchangeId: 'exchange', target: { pageId: 'page', profileId: 'default', generation: 'generation' }, promptHash: 'a'.repeat(64), at: 1 }), /browser_workspace_journal/);
	assert.equal(writes, 0);
});
