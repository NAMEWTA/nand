import { expect, test } from 'vitest';
import { parse, serialize } from './parser';
import { templateChoices, selectTemplate } from './board-experience';

const original =
	'\uFEFF---\r\ncustom: keep # author\r\ncolumns:\r\n  - name: Notes\r\n    type: library\r\n    library:\r\n      filters: []\r\n      viewMode: grid\r\n      sortBy: modified\r\n      sortDesc: true\r\n      templatePath: Templates/Old.md # keep\r\n      custom: nested\r\n---\r\n## Notes\r\nMy notes.\r\n';

test('legacy single template projects a list without migration on read or unrelated edits', () => {
	const board = parse(original),
		config = board.columns[0]!.libraryConfig!;
	expect(config.templatePaths).toEqual(['Templates/Old.md']);
	expect(serialize(board)).toBe(original);
	config.sortBy = 'title';
	const changed = serialize(board);
	expect(changed).toContain('sortBy: title');
	expect(changed).not.toContain('templatePaths:');
	expect(changed).toContain('templatePath: Templates/Old.md # keep');
	expect(changed).toContain('custom: nested');
	expect(changed).toContain('My notes.\r\n');
});

test('ordered choices survive edits; an explicit empty list overrides any old single path', () => {
	const board = parse(original),
		config = board.columns[0]!.libraryConfig!;
	config.templatePaths = templateChoices(config.templatePath, [
		' Templates/B.md ',
		'Templates/A.md',
		'Templates/B.md',
		'',
	]);
	config.templatePath = config.templatePaths[0];
	const saved = serialize(board),
		back = parse(saved).columns[0]!.libraryConfig!;
	expect(back.templatePaths).toEqual(['Templates/B.md', 'Templates/A.md']);
	expect(back.templatePath).toBe('Templates/B.md');
	expect(serialize(parse(saved))).toBe(saved);
	back.templatePaths = []; // An externally retained mirror must not defeat an explicit blank list.
	expect(templateChoices(back.templatePath, back.templatePaths)).toEqual([]);
	expect(selectTemplate(back.templatePaths, 0)).toBe('');
	expect(selectTemplate(['Templates/A.md'], null)).toBeNull();
});
