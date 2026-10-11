import { expect, test } from 'vitest';
import { cardDocumentPaths, editCardDocuments } from './card-links';
import { parse, serialize } from './parser';

const original = '## Projects\r\n### Card\r\nid: card\r\nlink: [[A]]\r\nAuthor introduction. <!-- keep -->\r\n[[A.md]] <!--collapsed-->\r\n    - [[Child.md|Alias]]\r\n\r\nKeep this footer.\r\n';

test('document editing starts from parsed links and preserves nesting, collapse and author text', () => {
	const board = parse(original), card = board.columns[0]!.cards[0]!;
	expect(card.body).not.toContain('[[A.md]]');
	expect(cardDocumentPaths(card.docs)).toEqual(['A.md', 'Child.md|Alias']);
	card.docs = editCardDocuments(card.docs, ['A.md', 'Child.md|Alias']);
	expect(serialize(board)).toBe(original);
	card.docs = editCardDocuments(card.docs, ['A.md', 'Child.md|Alias', 'B.md']);
	const saved = serialize(board), restored = parse(saved).columns[0]!.cards[0]!;
	expect(restored.docs).toEqual([{ path: 'A.md', collapsed: true, children: [{ path: 'Child.md|Alias' }] }, { path: 'B.md' }]);
	expect(saved).toContain('Author introduction. <!-- keep -->\r\n');
	expect(saved).toContain('\r\n\r\nKeep this footer.\r\n');
	expect(restored.body).toBe(card.body);
});

test('removing a parent retains selected descendants and removes only requested links', () => {
	const board = parse(original), card = board.columns[0]!.cards[0]!;
	card.docs = editCardDocuments(card.docs, ['Child.md|Alias', 'B.md', 'B.md']);
	expect(parse(serialize(board)).columns[0]!.cards[0]!.docs).toEqual([{ path: 'Child.md|Alias' }, { path: 'B.md' }]);
	card.docs = editCardDocuments(card.docs, []);
	const saved = serialize(board);
	expect(parse(saved).columns[0]!.cards[0]!.docs).toEqual([]);
	expect(saved).toContain('Author introduction. <!-- keep -->');
	expect(saved).toContain('Keep this footer.');
});
