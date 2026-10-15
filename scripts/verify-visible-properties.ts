// Retained baseline logic assertions; renderer behavior is verified against the current React components.
import { strict as assert } from 'node:assert';
import { runHomeReactChecks } from './run-home-react-checks';
import { selectBadgeKeys } from '../src/modules/home/ui/library/library-presentation';
// ---------- 1. selectBadgeKeys ----------

const fm = {
	title: 'Note A',
	作者: '张三',
	状态: '在读',
	类型: '技术',
	rating: 4,
	tags: ['x', 'y'],
	position: { start: { line: 0 } },
	empty: '',
	missing: null,
};

// Automatic mode (no picks): note order, tags/position/empty skipped, capped.
assert.deepEqual(
	selectBadgeKeys(fm, undefined, 6),
	['title', '作者', '状态', '类型', 'rating'],
	'auto mode shows first N formattable keys',
);
assert.deepEqual(selectBadgeKeys(fm, [], 2), ['title', '作者'], 'auto mode respects the cap');
assert.deepEqual(selectBadgeKeys({}, undefined, 6), [], 'empty note yields no badges');

// Pinned mode: hits only, pick order preserved, uncapped, missing skipped.
assert.deepEqual(
	selectBadgeKeys(fm, ['类型', '作者', '出版社'], 3),
	['类型', '作者'],
	'picks show in pick order; missing key skipped',
);
assert.deepEqual(
	selectBadgeKeys(fm, ['作者', '状态', '类型', 'rating'], 1),
	['作者', '状态', '类型', 'rating'],
	'picks are uncapped by the auto limit',
);
// Pinned keys holding empty/unformattable values count as misses.
assert.deepEqual(
	selectBadgeKeys(fm, ['empty', 'missing'], 6),
	['title', '作者', '状态', '类型', 'rating'],
	'unformattable picks fall back to automatic',
);
// tags/position are never badge candidates, even when pinned — such picks all
// miss and the card falls back to the automatic slice.
assert.deepEqual(
	selectBadgeKeys(fm, ['tags', 'position'], 6),
	['title', '作者', '状态', '类型', 'rating'],
	'tags/position unpinnable',
);

console.log('selectBadgeKeys semantics: PASS');

runHomeReactChecks(['ui/sections/library.dom.test.tsx']);
