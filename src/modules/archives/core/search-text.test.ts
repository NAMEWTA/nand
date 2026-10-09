import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { searchHit, type SearchDocument } from './search-text';

describe('archive search hits', () => {
	test('a hit names its source and drops raw markup from the snippet', () => {
		const doc: SearchDocument = {
			fields: 'ada lovelace',
			record: 'ada lovelace notes',
			fieldsDisplay: 'Ada Lovelace',
			fragments: [
				{ source: 'fields', text: 'Ada Lovelace', lower: 'ada lovelace' },
				{ source: 'body', text: 'Wrote <script>notes</script> about the engine', lower: 'wrote <script>notes</script> about the engine', located: 'Wrote notes about the engine', lineAt: () => 4 },
			],
		};
		const hit = searchHit(doc, 'engine', 'record');
		assert.equal(hit?.source, 'body');
		assert.equal(hit?.line, 4);
		assert.equal(hit?.snippet.includes('<'), false);
		assert.equal(searchHit(doc, 'missing', 'record'), undefined);
	});
});
