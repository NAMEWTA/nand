import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';
import { HistoryImportError, MAX_HISTORY_IMPORT_BYTES, parseMaiwHistory } from './maiw-format';

const fixture = readFileSync(resolve('src/modules/browser/core/workspace/fixtures/maiw-v3.jsonl'), 'utf8');
const rows = (): Array<{ type: string; [key: string]: any }> => fixture.trim().split('\n').map(line => JSON.parse(line));
const encode = (rows: unknown[]): string => rows.map(row => JSON.stringify(row)).join('\n') + '\n';

test('the pinned MAIW export function fixture preserves all supported v3 fields and removed historical panels', () => {
	const history = parseMaiwHistory(fixture);
	assert.equal(history.sessions.length, 1); assert.equal(history.turns.length, 2); assert.equal(history.exchanges.length, 2);
	assert.equal(history.sessions[0]!.workspace.panels[0]!.widthRatio, 2.5);
	assert.match(history.sessions[0]!.workspace.panels[0]!.url, /entry=home$/);
	assert.equal(history.turns[0]!.appliedPromptTemplates![0]!.content, 'Check sources');
	assert.equal(history.exchanges[0]!.responseRevision, 2); assert.match(history.exchanges[0]!.responseMarkdown!, /```ts/);
	assert.equal(history.exchanges[1]!.panelId, 'removed-claude-panel');
	assert.equal(history.exchanges[1]!.responseStatus, 'partial');
});

test('strict v3 envelopes reject obsolete versions, unknown fields, invalid states and foreign or credentialed provider URLs', () => {
	for (const change of [
		(data: ReturnType<typeof rows>) => { data[0]!.version = 2; },
		(data: ReturnType<typeof rows>) => { data[1]!.data.token = 'must-not-enter-storage'; },
		(data: ReturnType<typeof rows>) => { data[1]!.data.workspace.panels[0].url = 'https://chat.deepseek.com.evil.example/'; },
		(data: ReturnType<typeof rows>) => { data[1]!.data.workspace.panels[0].url = 'https://user:password@chat.deepseek.com/'; },
		(data: ReturnType<typeof rows>) => { data[1]!.data.workspace.panels[0].url = 'https://claude.ai/'; },
		(data: ReturnType<typeof rows>) => { data[1]!.data.createdAt = '2026-02-30T00:00:00.000Z'; },
		(data: ReturnType<typeof rows>) => { data[2]!.data.status = 'invented'; },
		(data: ReturnType<typeof rows>) => { data[4]!.data.responseRevision = 0; },
		(data: ReturnType<typeof rows>) => { data[4]!.data.captureSource = 'made-up'; },
		(data: ReturnType<typeof rows>) => { data[4]!.data.responseText = 'x'.repeat(2000001); },
	]) {
		const data = rows(); change(data); assert.throws(() => parseMaiwHistory(encode(data)), HistoryImportError);
	}
	assert.throws(() => parseMaiwHistory('\n'+fixture+'{broken'), (error: unknown) => error instanceof HistoryImportError && error.line === 8);
});

test('whole-bundle validation rejects count mismatches, duplicate IDs and ambiguous or orphan relations', () => {
	for (const change of [
		(data: ReturnType<typeof rows>) => { data[0]!.counts.sessions = 2; },
		(data: ReturnType<typeof rows>) => { data[3]!.data.id = data[2]!.data.id; },
		(data: ReturnType<typeof rows>) => { data[3]!.data.sequence = data[2]!.data.sequence; },
		(data: ReturnType<typeof rows>) => { data[2]!.data.sessionId = 'missing'; },
		(data: ReturnType<typeof rows>) => { data[4]!.data.turnId = 'missing'; },
		(data: ReturnType<typeof rows>) => { data[4]!.data.sessionId = 'wrong-session'; },
		(data: ReturnType<typeof rows>) => { data[5]!.data.turnId = data[4]!.data.turnId; },
	]) { const data = rows(); change(data); assert.throws(() => parseMaiwHistory(encode(data)), /import_relations/); }
});

test('import limits UTF-8 bytes before parsing rather than JavaScript character count', () => {
	const oversized = '字'.repeat(Math.floor(MAX_HISTORY_IMPORT_BYTES / 3) + 1);
	assert.ok(oversized.length < MAX_HISTORY_IMPORT_BYTES);
	assert.throws(() => parseMaiwHistory(oversized), /import_size/);
});
