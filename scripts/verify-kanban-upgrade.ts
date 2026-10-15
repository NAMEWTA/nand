// Retained baseline logic assertions; renderer behavior is verified against the current React components.
import { strict as assert } from 'node:assert';
import { runHomeReactChecks } from './run-home-react-checks';
import { parse, serialize } from '../src/modules/home/core/board/parser';
import { nextGroupPropertyValue } from '../src/modules/home/ui/library/library-groups';
// ---------- 1. nextGroupPropertyValue ----------

// Scalars: replace, same-value no-op, typed values survive.
assert.equal(nextGroupPropertyValue('todo', 'doing', 'todo'), 'doing');
assert.equal(nextGroupPropertyValue('doing', 'doing', 'doing'), undefined);
assert.equal(nextGroupPropertyValue(3, '3', '3'), undefined);
assert.equal(nextGroupPropertyValue(true, 'false', 'true'), 'false');

// Null/absent (dragged out of the not-set column): gains the target.
assert.equal(nextGroupPropertyValue(undefined, 'doing', null), 'doing');
assert.equal(nextGroupPropertyValue(null, 'doing', null), 'doing');

// Arrays: the dragged-from value swaps for the target, others keep theirs.
assert.deepEqual(nextGroupPropertyValue(['a', 'b'], 'c', 'a'), ['b', 'c']);

// Array already containing the target: from-value just drops away.
assert.deepEqual(nextGroupPropertyValue(['a', 'b'], 'b', 'a'), ['b']);

// Array dragged from not-set (fromKey null): only gains the target.
assert.deepEqual(nextGroupPropertyValue(['a'], 'b', null), ['a', 'b']);

// Array drop back on the own column: no reorder, no rewrite.
assert.equal(nextGroupPropertyValue(['a', 'b'], 'a', 'a'), undefined);
assert.equal(nextGroupPropertyValue(['a', 'b'], 'b', 'b'), undefined);

// Stale fromKey (value no longer present): adding the target is still a change.
assert.deepEqual(nextGroupPropertyValue(['a', 'b'], 'c', 'x'), ['a', 'b', 'c']);

// Removing the last value leaves a single-entry array (never an empty one:
// the target is always pushed when missing).
assert.deepEqual(nextGroupPropertyValue(['a'], 'b', 'a'), ['b']);

// ---------- 2. kanbanShowCovers round-trip ----------

const md = (libraryBlock: string): string =>
	[
		'---',
		'columns:',
		'  - name: 书库',
		"    color: '#6366f1'",
		'    type: library',
		'    library:',
		'      viewMode: kanban',
		'      sortBy: modified',
		'      sortDesc: true',
		libraryBlock,
		'---',
		'',
		'## 书库',
	].join('\n');

// Round-trip: toggle survives serialize → parse → serialize.
const parsedOn = parse(md('      kanbanShowCovers: true'));
assert.equal(parsedOn.columns[0]!.libraryConfig!.kanbanShowCovers, true, 'toggle parses from markdown');
assert.equal(
	parse(serialize(parsedOn)).columns[0]!.libraryConfig!.kanbanShowCovers,
	true,
	'toggle survives serialize -> parse round-trip',
);

// Absent stays undefined and never serializes a value.
const parsedOff = parse(md(''));
assert.equal(parsedOff.columns[0]!.libraryConfig!.kanbanShowCovers, undefined, 'absent toggle stays undefined');
const reserialized = serialize(parsedOff);
assert.ok(!reserialized.includes('kanbanShowCovers'), 'absent toggle must not serialize');

console.log('kanbanShowCovers round-trip: PASS');

runHomeReactChecks(['ui/sections/library.dom.test.tsx']);
