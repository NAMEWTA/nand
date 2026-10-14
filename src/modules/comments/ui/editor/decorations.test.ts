import { expect, test } from 'vitest';
import { segments } from './decorations';
test('overlapping editor marks retain every covering thread id', () => {
	expect(segments([{ start: 0, end: 5, id: 'a' }, { start: 2, end: 7, id: 'b' }])).toEqual([{ start: 0, end: 2, ids: ['a'] }, { start: 2, end: 5, ids: ['a', 'b'] }, { start: 5, end: 7, ids: ['b'] }]);
});
