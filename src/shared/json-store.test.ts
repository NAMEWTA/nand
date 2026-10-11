import { expect, test } from 'vitest';
import { JsonStore } from './json-store';
import type { TextStorage } from './storage/ports';

function memory() {
	const files = new Map<string, string>();
	const storage: TextStorage = {
		exists: async path => files.has(path),
		read: async path => { const value = files.get(path); if (value === undefined) throw new Error('missing'); return value; },
		write: async (path, value) => { files.set(path, value); },
		mkdir: async () => {},
	};
	return { files, storage };
}

test('a later local edit preserves an external update already merged by the previous save', async () => {
	const { files, storage } = memory();
	files.set('state.json', JSON.stringify({ a: 1, b: 1 }));
	const store = new JsonStore(storage, 'state.json', (value): value is { a: number; b: number } => !!value && typeof value === 'object');
	let local = await store.load({ a: 0, b: 0 });
	files.set('state.json', JSON.stringify({ a: 1, b: 2 }));
	local = await store.commit({ base: local, value: { ...local, a: 2 } });
	local = await store.commit({ base: local, value: { ...local, a: 3 } });
	expect(JSON.parse(files.get('state.json')!)).toEqual({ a: 3, b: 2 });
});

const validate = (value: unknown): value is Record<string, number> => !!value && typeof value === 'object' && Object.values(value).every(item => typeof item === 'number');

test('external additions and deletions survive three saves across two store instances', async () => {
	const { files, storage } = memory();
	files.set('state', JSON.stringify({ a: 1, obsolete: 1 }));
	const first = new JsonStore(storage, 'state', validate), second = new JsonStore(storage, 'state', validate);
	let local = await first.load({}), remote = await second.load({});
	remote = await second.commit({ base: remote, value: { a: 1, added: 2 } });
	for (const a of [2, 3, 4]) local = await first.commit({ base: local, value: { ...local, a } });
	expect(local).toEqual({ a: 4, added: 2 });
	expect(await second.load({})).toEqual(local);
});

test('a partial primary write recovers the latest valid external state and can be retried', async () => {
	const { files, storage } = memory();
	files.set('state', JSON.stringify({ a: 1, b: 1, obsolete: 1 }));
	const store = new JsonStore(storage, 'state', validate);
	const base = await store.load({});
	files.set('state', JSON.stringify({ a: 1, b: 2 }));
	const write = storage.write;
	storage.write = async (path, value) => { if (path === 'state') { files.set(path, '{'); throw new Error('interrupted'); } await write(path, value); };
	await expect(store.commit({ base, value: { ...base, a: 2 } })).rejects.toThrow('interrupted');
	expect(JSON.parse(files.get('state.backup')!)).toEqual({ a: 1, b: 2 });
	storage.write = write;
	const recovered = new JsonStore(storage, 'state', validate);
	const value = await recovered.load({});
	expect(value).toEqual({ a: 1, b: 2 });
	expect(await recovered.commit({ base: value, value: { ...value, a: 3 } })).toEqual({ a: 3, b: 2 });
	expect(files.get('state.corrupt')).toBe('{');
});

test('an unreadable primary never falls back to backup or writes recovery files', async () => {
	const { files, storage } = memory();
	files.set('state', '{"a":2}'); files.set('state.backup', '{"a":1}');
	const read = storage.read;
	storage.read = async path => { if (path === 'state') throw new Error('access denied'); return read(path); };
	const store = new JsonStore(storage, 'state', validate);
	await expect(store.load({})).rejects.toThrow('access denied');
	await expect(store.commit({ base: {}, value: { a: 3 } })).rejects.toThrow('Reload');
	expect([...files]).toEqual([['state', '{"a":2}'], ['state.backup', '{"a":1}']]);
});

test('the same caller can retry a partial write without losing its pending edit or the external update', async () => {
	const { files, storage } = memory();
	files.set('state', '{"a":1,"b":1}');
	const store = new JsonStore(storage, 'state', validate), base = await store.load({});
	files.set('state', '{"a":1,"b":2}');
	const write = storage.write;
	let fail = true;
	storage.write = async (path, value) => { if (path === 'state' && fail) { fail = false; files.set(path, '{'); throw new Error('interrupted'); } await write(path, value); };
	await expect(store.commit({ base, value: { ...base, a: 2 } })).rejects.toThrow('interrupted');
	expect(await store.commit({ base, value: { ...base, a: 2 } })).toEqual({ a: 2, b: 2 });
	expect(files.get('state.corrupt')).toBe('{');
});

test('backup verification failure leaves the primary untouched', async () => {
	const { files, storage } = memory();
	files.set('state', '{"a":1}');
	const store = new JsonStore(storage, 'state', validate), base = await store.load({});
	const write = storage.write;
	storage.write = async (path, value) => write(path, path.endsWith('.backup') ? '{}' : value);
	await expect(store.commit({ base, value: { a: 2 } })).rejects.toThrow('verification failed');
	expect(files.get('state')).toBe('{"a":1}');
});

test('recovery never rewrites the only valid backup and rereads external backup updates', async () => {
	const { files, storage } = memory();
	files.set('state', '{'); files.set('state.backup', '{"a":1,"b":1}');
	const store = new JsonStore(storage, 'state', validate), base = await store.load({});
	files.set('state.backup', '{"a":1,"b":2}');
	const write = storage.write;
	storage.write = async (path, value) => {
		if (path === 'state.backup') { files.set(path, '{'); throw new Error('backup interrupted'); }
		if (path === 'state') { files.set(path, '{'); throw new Error('primary interrupted'); }
		await write(path, value);
	};
	await expect(store.commit({ base, value: { ...base, a: 2 } })).rejects.toThrow('primary interrupted');
	expect(await new JsonStore(storage, 'state', validate).load({})).toEqual({ a: 1, b: 2 });
	storage.write = write;
	expect(await store.commit({ base, value: { ...base, a: 2 } })).toEqual({ a: 2, b: 2 });
});

test('conflicting edits and externally removed files are rejected without silent replacement', async () => {
	const { files, storage } = memory();
	files.set('state', '{"a":1}');
	const store = new JsonStore(storage, 'state', validate), base = await store.load({});
	files.set('state', '{"a":2}');
	await expect(store.commit({ base, value: { a: 3 } })).rejects.toThrow('Concurrent edit');
	expect(files.get('state')).toBe('{"a":2}');
	files.delete('state');
	await expect(store.commit({ base, value: { a: 3 } })).rejects.toThrow('removed externally');
});
