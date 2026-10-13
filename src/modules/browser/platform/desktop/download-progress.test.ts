import { EventEmitter } from 'node:events';
import { expect, test } from 'vitest';
import { watchDownload } from './download-progress';

for (const initial of ['progressing', 'completed', 'cancelled']) test(`download observer starts from native ${initial} state and releases completed listeners`, () => {
	const item = Object.assign(new EventEmitter(), { getState: () => initial });
	const states: string[] = []; let finished = 0;
	const dispose = watchDownload(item, state => states.push(state), () => { finished++; });
	expect(states).toEqual([initial]);
	if (initial === 'progressing') {
	 item.emit('updated', {}, 'interrupted'); expect(finished).toBe(0);
	 item.emit('done', {}, 'completed'); expect(states).toEqual(['progressing', 'interrupted', 'completed']);
	}
	expect(finished).toBe(1); expect(item.listenerCount('updated')).toBe(0); expect(item.listenerCount('done')).toBe(0);
	dispose(); expect(finished).toBe(1);
});
test('disposing an active download listener stops future events without claiming completion', () => {
	const item = Object.assign(new EventEmitter(), { getState: () => 'progressing' });
	const states: string[] = []; let finished = 0;
	const dispose = watchDownload(item, state => states.push(state), () => { finished++; });
	dispose(); item.emit('done', {}, 'completed');
	expect(states).toEqual(['progressing']); expect(finished).toBe(0);
});
