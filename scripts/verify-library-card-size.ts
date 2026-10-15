// Retained baseline logic assertions; renderer behavior is verified against the current React components.
import { strict as assert } from 'node:assert';
import { runHomeReactChecks } from './run-home-react-checks';
import { parse, serialize } from '../src/modules/home/core/board/parser';

// ---------- 1. Parser round-trip ----------

const roundTrip = (size: string | undefined): string | undefined => {
	const dash = parse(
		[
			'---',
			'columns:',
			'  - name: C1',
			'    type: folder',
			'    library:',
			`      cardSize: ${size}`,
			'---',
			'',
			'## C1',
		].join('\n'),
	);
	const col = dash.columns[0];
	return serialize(dash).match(/cardSize: (\w+)/)?.[1] ?? undefined;
};

assert.equal(roundTrip('small'), 'small', 'small round-trips');
assert.equal(roundTrip('large'), 'large', 'large round-trips');
assert.equal(roundTrip('medium'), 'medium', 'explicit author default is preserved');
assert.equal(roundTrip('huge'), 'huge', 'unmanaged author input is preserved');

console.log('cardSize parser round-trip: PASS');

runHomeReactChecks(['ui/sections/library.dom.test.tsx']);
