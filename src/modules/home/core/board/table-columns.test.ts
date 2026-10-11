import { expect, test } from 'vitest';
import { libraryTableCandidates, libraryTableColumns } from './table-columns';
import { reconcileColumns } from './board-experience';
import { parse, serialize } from './parser';

test('table candidates include every matching note and distinguish file fields from named properties', () => {
	const rows = Array.from({ length: 25 }, (_, index) => ({
		frontmatter: { [`field${index}`]: index, name: 'Custom name', modified: 'Custom time', position: { start: 0 } },
	}));
	const candidates = libraryTableCandidates(rows, [{ property: 'required', values: ['yes'] }]);
	expect(candidates.slice(0, 3)).toEqual(['file.name', 'file.modified', 'property:required']);
	expect(candidates).toContain('property:field24');
	expect(candidates).toContain('property:name');
	expect(candidates).toContain('property:modified');
	expect(candidates).not.toContain('property:position');
	expect(new Set(candidates).size).toBe(candidates.length);
});

test('missing and hidden-only fields keep their place while new fields append visibly', () => {
	const preferences = {
		tableOrder: ['property:status', 'file.name', 'property:status'],
		tableHidden: ['property:status', 'property:owner'],
	};
	const snapshot = JSON.stringify(preferences);
	const absent = libraryTableColumns(preferences, ['file.name', 'file.modified', 'property:new']);
	expect(absent.order).toEqual(['property:status', 'file.name', 'property:owner', 'file.modified', 'property:new']);
	expect(absent.visible).toEqual(['file.name', 'file.modified', 'property:new']);
	const back = libraryTableColumns({ tableOrder: absent.order, tableHidden: absent.hidden }, [
		'file.name',
		'file.modified',
		'property:owner',
		'property:status',
		'property:new',
	]);
	expect(back.order).toEqual(absent.order);
	expect(back.visible).toEqual(absent.visible);
	expect(JSON.stringify(preferences)).toBe(snapshot);
	expect(reconcileColumns([], ['owner'], ['owner', 'new'])).toEqual({ order: ['owner', 'new'], hidden: ['owner'] });
	expect(libraryTableColumns({}, ['file.name', 'property:status']).visible).toEqual(['file.name', 'property:status']);
});

test('section preferences round-trip independently; reset removes only table preferences', () => {
	const source =
		'---\ncustom: keep # author\ncolumns: [{name: One, type: library, library: {filters: [], visibleProperties: [owner]}}, {name: Two, type: folder, library: {filters: [], folders: [Work]}}]\n---\n## One\nAuthor prose.\n\n## Two\n';
	const data = parse(source);
	expect(serialize(data)).toBe(source);
	const first = data.columns[0]!.libraryConfig!;
	first.tableOrder = ['property:owner', 'file.name'];
	first.tableHidden = ['file.modified'];
	const saved = serialize(data),
		back = parse(saved);
	expect(back.columns[0]!.libraryConfig!.tableOrder).toEqual(first.tableOrder);
	expect(back.columns[1]!.libraryConfig!.tableOrder).toBeUndefined();
	expect(back.columns[0]!.libraryConfig!.visibleProperties).toEqual(['owner']);
	expect(serialize(back)).toBe(saved);
	back.columns[0]!.libraryConfig!.tableOrder = undefined;
	back.columns[0]!.libraryConfig!.tableHidden = undefined;
	const reset = serialize(back);
	expect(reset).not.toContain('tableOrder');
	expect(reset).not.toContain('tableHidden');
	expect(reset).toContain('custom: keep # author');
	expect(reset).toContain('Author prose.');
	expect(parse(reset).columns[0]!.libraryConfig!.visibleProperties).toEqual(['owner']);
});
