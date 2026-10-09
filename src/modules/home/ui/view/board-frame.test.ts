import assert from 'node:assert/strict';
import { test } from 'vitest';
import { boardFrame } from './board-frame';

test('an immersive board keeps the desktop or phone frame', () => {
	assert.deepEqual(boardFrame(true, true), { layout: 'stacked', board: 'immersive' });
	assert.deepEqual(boardFrame(true, false), { layout: 'side', board: 'immersive' });
	assert.deepEqual(boardFrame(false, true), { layout: 'stacked', board: null });
});
