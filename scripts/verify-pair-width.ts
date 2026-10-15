// Retained baseline logic assertions; renderer behavior is verified against the current React components.
import { strict as assert } from 'node:assert';
import { runHomeReactChecks } from './run-home-react-checks';
import { parse, serialize } from '../src/modules/home/core/board/parser';
import {
	unpartnerAt,
	moveToOwnRow,
	moveBeside,
	normalizeColumnPairs,
} from '../src/modules/home/core/board/column-pairs';
// ---------- 1. column-pairs clears width with half ----------

const col = (name: string, half?: boolean, width?: number): { name: string; half?: boolean; width?: number } => ({
	name,
	...(half ? { half } : {}),
	...(width != null ? { width } : {}),
});

// unpartnerAt clears width on BOTH actors.
const unp = unpartnerAt([col('A', true, 40), col('B', true)], 0);
assert.equal(unp[0]!.width, undefined, 'unpartnerAt clears the actor width');
assert.equal(unp[1]!.width, undefined, 'unpartnerAt clears the partner width (right member mirror gone)');

// moveToOwnRow: the moved column loses width even mid-run.
const own = moveToOwnRow([col('A', true, 40), col('B', true), col('C')], 0, 2);
assert.equal(own.find((c) => c.name === 'A')!.width, undefined, 'moveToOwnRow clears the moved width');
assert.equal(own.find((c) => c.name === 'B')!.width, undefined, 'moveToOwnRow clears the ex-partner width');

// normalizeColumnPairs (parse-time self-heal): orphan halves drop width.
const healed = normalizeColumnPairs([col('A', true, 40), col('B')]);
assert.equal(healed[0]!.width, undefined, 'normalize clears an orphan half width');
assert.equal(healed[0]!.half, undefined, 'normalize clears the orphan half flag');

// moveBeside: evicted ex-partners drop width; the pair keeps functioning.
const beside = moveBeside([col('A', true, 40), col('B', true), col('C')], 2, 1, 'right');
const evicted = beside.find((c) => c.name === 'A')!;
assert.equal(evicted.half, undefined, 'moveBeside evicts the ex-partner');
assert.equal(evicted.width, undefined, 'moveBeside clears the evicted width');

console.log('column-pairs width clearing: PASS');

// ---------- 2. Parser round-trip ----------

const md = (extra: string): string =>
	[
		'---',
		'columns:',
		'  - name: A',
		"    color: '#111111'",
		'    half: true',
		extra,
		'  - name: B',
		"    color: '#222222'",
		'    half: true',
		'---',
		'',
		'## A',
		'',
		'## B',
	].join('\n');

// Valid split persists and survives the round-trip.
const data = parse(md('    width: 40'));
assert.equal(data.columns[0]!.width, 40, 'width parses beside half');
const round = parse(serialize(data));
assert.equal(round.columns[0]!.width, 40, 'width survives serialize -> parse');

// Width without half is dropped (parse keeps it def-only, parseColumns gates).
const noHalf = parse(md('    width: 40').replace('    half: true\n', ''));
assert.equal(noHalf.columns[0]!.width, undefined, 'width without half dropped');

// Out-of-range values rejected at parse.
for (const bad of [5, 95, -1, 101]) {
	assert.equal(parse(md(`    width: ${bad}`)).columns[0]!.width, undefined, `out-of-range width ${bad} dropped`);
}

console.log('parser width round-trip: PASS');

runHomeReactChecks(['ui/board/controls.dom.test.tsx', 'core/board/layout.test.ts']);
