import assert from 'node:assert/strict';
import { test } from 'vitest';
import { compareAnswers } from './comparison';
import type { AnswerCapture, WorkspaceExchange, WorkspaceTurn } from './model';

const capture = (id: string, exchangeId: string, revision: number, complete = true): AnswerCapture => ({ id, exchangeId, revision, complete,
	source: 'provider-api', adapterVersion: 'verified-v1', conversationId: 'conversation', messageId: id, parentId: 'user',
	markdown: '# Answer\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n$x^2$', reasons: complete ? [] : ['missing-page'], terminalEvidence: complete ? ['finished'] : [], capturedAt: revision });
const turn: WorkspaceTurn = { id: 'turn', taskId: 'task', sequence: 1, question: 'Q', finalPrompt: 'Q', templates: [], createdAt: 1,
	targets: ['a', 'b', 'c'].map(id => ({ id, provider: 'deepseek', profileId: id, accountLabel: id, status: 'ready' })) };
const exchanges = (): WorkspaceExchange[] => turn.targets.map(target => ({ id: target.id, targetId: target.id, turnId: turn.id,
	submitState: 'submitted', acquisitionState: 'complete', saveState: 'saved', attempts: [], captures: [capture(target.id + '-1', target.id, 1)], currentCaptureId: target.id + '-1' }));

test('comparison pins exact same-round revisions and labels an older complete capture after a partial replaces it', () => {
	const rows = exchanges(), references = [{ exchangeId: 'a', captureId: 'a-1' }, { exchangeId: 'b', captureId: 'b-1' }];
	const first = compareAnswers(turn, rows, references); rows[0]!.captures.push(capture('a-2', 'a', 2, false)); rows[0]!.currentCaptureId = 'a-2';
	const later = compareAnswers(turn, rows, references);
	assert.equal(later[0]!.current, false); assert.equal(later[0]!.capture.id, first[0]!.capture.id); assert.equal(later[0]!.capture.complete, true);
	assert.equal(later[1]!.current, true);
	later[0]!.capture.markdown = 'Caller edit'; assert.match(rows[0]!.captures[0]!.markdown, /\| A \| B \|/);
	assert.equal(compareAnswers(turn, rows, [{ exchangeId: 'a', captureId: 'a-2' }, references[1]!])[0]!.capture.complete, false);
});

test('comparison rejects duplicate targets, wrong rounds and missing revisions without substituting current content', () => {
	const rows = exchanges(), a = { exchangeId: 'a', captureId: 'a-1' }, b = { exchangeId: 'b', captureId: 'b-1' };
	assert.throws(() => compareAnswers(turn, rows, [a]), /comparison_targets/);
	assert.throws(() => compareAnswers(turn, rows, [a, a]), /comparison_targets/);
	assert.throws(() => compareAnswers(turn, rows, [a, { ...b, captureId: 'missing' }]), /answer_missing/);
	rows[1]!.turnId = 'other'; assert.throws(() => compareAnswers(turn, rows, [a, b]), /answer_missing/);
});

test('comparison can explicitly select a partial excerpt without promoting it to a current provider capture', () => {
	const rows = exchanges(); rows[0]!.selections = [{ id: 'excerpt', exchangeId: 'a', revision: 1, source: 'user-selection', complete: false,
		markdown: 'Hand-selected paragraph', capturedAt: 5, reasons: ['user-selection'], selection: { page: { pageId: 'page', profileId: 'a', generation: 'guest' },
			url: 'https://chat.deepseek.com/', title: 'Page', selector: '#answer', rect: { x: 0, y: 0, width: 20, height: 10 }, viewport: { width: 800, height: 600 } } }];
	const result = compareAnswers(turn, rows, [{ exchangeId: 'a', captureId: 'excerpt' }, { exchangeId: 'b', captureId: 'b-1' }]);
	assert.equal(result[0]!.capture.source, 'user-selection'); assert.equal(result[0]!.capture.complete, false); assert.equal(result[0]!.current, false);
	assert.equal(rows[0]!.currentCaptureId, 'a-1');
});
