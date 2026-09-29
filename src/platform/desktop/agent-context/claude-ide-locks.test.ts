import assert from 'node:assert/strict';
import test from 'node:test';

import { isProcessAlive, removeStaleNandIdeLockfiles, type IdeLockIo } from './claude-ide-locks.ts';

function memory(entries: Record<string, string> | null): { io: IdeLockIo; left(): string[] } {
	const files = entries ? { ...entries } : null;
	const io: IdeLockIo = {
		readdirSync() {
			if (!files) throw Object.assign(new Error('missing'), { code: 'ENOENT' });
			return Object.keys(files);
		},
		readFileSync(file) {
			const name = file.slice(file.lastIndexOf('/') + 1);
			const text = files?.[name];
			if (text === undefined) throw Object.assign(new Error('missing'), { code: 'ENOENT' });
			return text;
		},
		unlinkSync(file) {
			const name = file.slice(file.lastIndexOf('/') + 1);
			if (!files || !(name in files)) throw Object.assign(new Error('missing'), { code: 'ENOENT' });
			delete files[name];
		},
		join: (directory, name) => `${directory}/${name}`,
	};
	return { io, left: () => (files ? Object.keys(files) : []) };
}

test('removeStaleNandIdeLockfiles deletes only dead NAND locks', () => {
	const store = memory({
		'dead.lock': JSON.stringify({ ideName: 'NAND (Obsidian)', pid: 10 }),
		'live.lock': JSON.stringify({ ideName: 'NAND (Obsidian)', pid: 11 }),
		'other.lock': JSON.stringify({ ideName: 'Visual Studio Code', pid: 12 }),
		'broken.lock': '{',
		'nopid.lock': JSON.stringify({ ideName: 'NAND (Obsidian)' }),
		'note.txt': 'ignore',
	});
	removeStaleNandIdeLockfiles('/tmp/ide', store.io, (pid) => pid === 11);
	assert.deepEqual(store.left().sort(), ['broken.lock', 'live.lock', 'nopid.lock', 'note.txt', 'other.lock']);
});

test('removeStaleNandIdeLockfiles ignores a missing directory', () => {
	const store = memory(null);
	assert.doesNotThrow(() => removeStaleNandIdeLockfiles('/missing', store.io, () => false));
});

test('isProcessAlive recognizes this process and rejects a non-pid', () => {
	assert.equal(isProcessAlive(process.pid), true);
	assert.equal(isProcessAlive(0), false);
});
