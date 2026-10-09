import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import type { QueryResult } from '../../core/dql/types';
import { visibleRowWindow } from './result-model';
import { displayColumns } from './table-model';

describe('dataview columns and the row window', () => {
	test('hidden columns drop out and the first window is 50', () => {
		const result: QueryResult = { queryType: 'TABLE', columns: [{ alias: 'title' }, { alias: 'status' }, { alias: 'gone' }], rows: [], grouped: false };
		const columns = displayColumns(result, { order: ['status', 'title'], hidden: ['gone'] });
		assert.deepEqual(columns.valueColumns, ['status', 'title']);
		const first = visibleRowWindow(800, 0);
		assert.equal(first.count, 50);
		assert.equal(first.truncated, true);
		assert.equal(first.total, 800);
		assert.equal(visibleRowWindow(800, first.next).count, 100);
		assert.equal(visibleRowWindow(800, 500).count, 500);
	});
});
