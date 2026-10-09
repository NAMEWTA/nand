import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { anniversaryDateThisYear } from '../anniversaries/calendar';
import { commitHomeDecor } from './appearance-preset';
import { libraryStageMove } from './library-stage';

describe('board actions use the shipped experience', () => {
	test('a lunar anniversary uses the injected calendar and a name clash writes nothing', () => {
		const mapped = anniversaryDateThisYear(new Date(2024, 2, 1), new Date(2026, 9, 9), 'lunar', {
			toLunar: () => ({ year: 2024, month: 2, leap: false, day: 1 }),
			monthDays: () => 30,
			toSolar: () => '2026-03-19',
		});
		assert.equal(mapped.getFullYear(), 2026);
		assert.equal(mapped.getMonth(), 2);
		assert.equal(mapped.getDate(), 19);
		let writes = 0;
		const refused = libraryStageMove({
			mode: 'folder',
			path: 'Notes/Todo/a.md',
			destination: 'Notes/Doing',
			siblingNames: ['a.md'],
			statusField: 'status',
			stageValue: 'Doing',
			writeStatus: () => {
				writes += 1;
				return 'ok';
			},
			rename: () => {
				writes += 1;
				return 'ok';
			},
		});
		assert.equal(refused.status, 'refused');
		assert.equal(refused.error, 'name-clash');
		assert.equal(writes, 0);
		const failed = commitHomeDecor(
			{ bgImage: 'a.png', bgDim: 1, bgBlur: 0, bgSize: 'cover', surfaceOpacity: null, glassBlur: null, radiusScale: null, fontScale: 'medium' },
			() => undefined,
			() => {
				throw new Error('disk full');
			},
		);
		assert.deepEqual(failed, { saved: false, error: 'disk full' });
	});
});
