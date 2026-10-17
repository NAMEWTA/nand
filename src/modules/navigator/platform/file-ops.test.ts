// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { expect, test } from 'vitest';
import { TFolder, type App, type TAbstractFile } from 'obsidian';
import { moveEntries } from './file-ops';

class FakeEntry {
	parent: { path: string; isRoot: () => boolean };
	constructor(public path: string) {
		const slash = path.lastIndexOf('/');
		this.parent = { path: slash < 0 ? '/' : path.slice(0, slash), isRoot: () => slash < 0 };
	}
}
function fakeFolder(path: string): FakeEntry {
	const entry = new FakeEntry(path);
	Object.setPrototypeOf(entry, TFolder.prototype);
	return entry;
}

function fakeApp(existing: string[]) {
	const taken = new Set(existing);
	const app = {
		vault: { getAbstractFileByPath: (path: string) => (taken.has(path) ? {} : null) },
		fileManager: {
			// Like Obsidian, the entry is updated in place.
			renameFile: (entry: { path: string }, target: string) => { taken.delete(entry.path); taken.add(target); entry.path = target; return Promise.resolve(); },
		},
	};
	return app as unknown as App;
}

test('moving reports old to new paths even though Obsidian updates the entry in place', async () => {
	const entry = new FakeEntry('a/one.md');
	const result = await moveEntries(fakeApp(['a/one.md']), [entry as unknown as TAbstractFile], 'b');
	expect([...result.moved]).toEqual([['a/one.md', 'b/one.md']]);
	expect(result.skipped).toEqual([]);
	expect(entry.path).toBe('b/one.md');
});

test('a taken name at the destination is skipped, reported and left untouched', async () => {
	const keep = new FakeEntry('a/clash.md');
	const go = new FakeEntry('a/go.md');
	const result = await moveEntries(fakeApp(['a/clash.md', 'a/go.md', 'b/clash.md']), [keep, go] as unknown as TAbstractFile[], 'b');
	expect([...result.moved]).toEqual([['a/go.md', 'b/go.md']]);
	expect(result.skipped).toEqual(['a/clash.md']);
	expect(keep.path).toBe('a/clash.md');
});

test('a folder is not moved into itself or its descendants, and entries already in the folder are ignored silently', async () => {
	const folder = fakeFolder('a');
	const inside = await moveEntries(fakeApp(['a']), [folder as unknown as TAbstractFile], 'a/sub');
	expect(inside.skipped).toEqual(['a']);
	expect(inside.moved.size).toBe(0);
	const already = await moveEntries(fakeApp(['a/x.md']), [new FakeEntry('a/x.md')] as unknown as TAbstractFile[], 'a');
	expect(already.skipped).toEqual([]);
	expect(already.moved.size).toBe(0);
});
