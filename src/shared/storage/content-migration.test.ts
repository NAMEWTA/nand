import { expect, test } from 'vitest';
import { migrateContent, type ContentMigrationPort } from './content-migration';

function fixture(initial: Record<string, string>) {
	const files = new Map(Object.entries(initial));
	const storage: ContentMigrationPort = {
		exists: async path => files.has(path),
		read: async path => { const value = files.get(path); if (value === undefined) throw new Error('missing'); return value; },
		write: async (path, value) => { files.set(path, value); }, mkdir: async () => {},
		readBinary: async path => new TextEncoder().encode(await storage.read(path)).buffer as ArrayBuffer,
		copy: async (source, target) => { if (files.has(target)) throw new Error('exists'); files.set(target, await storage.read(source)); },
		move: async (source, target) => { if (files.has(target)) throw new Error('exists'); files.set(target, await storage.read(source)); files.delete(source); },
	};
	return { files, storage };
}

test('declared content moves byte-for-byte with a retained original; ordinary notes remain outside', async () => {
	const f = fixture({ 'NAND/one.md': '# Original\r\n我的正文\r\n', 'Ordinary.md': 'ordinary' });
	await migrateContent(f.storage, ['NAND/one.md']);
	expect(f.files.get('.nand/content/NAND/one.md')).toBe('# Original\r\n我的正文\r\n');
	expect(f.files.has('NAND/one.md')).toBe(false);
	expect(f.files.get('.nand/migrations/content/originals/NAND/one.md')).toBe('# Original\r\n我的正文\r\n');
	expect(f.files.get('Ordinary.md')).toBe('ordinary');
	await f.storage.write('.nand/content/NAND/one.md', 'later edit');
	await migrateContent(f.storage, []);
	expect(f.files.get('.nand/content/NAND/one.md')).toBe('later edit');
});

test('an interrupted completion resumes from retained bytes even if the copied target was lost', async () => {
	const f = fixture({ 'NAND/one.md': 'original' }), write = f.storage.write;
	f.storage.write = async (path, text) => { if (path.endsWith('manifest.json') && JSON.parse(text).stage === 'complete') throw new Error('disk'); await write(path, text); };
	await expect(migrateContent(f.storage, ['NAND/one.md'])).rejects.toThrow('disk');
	expect(f.files.has('NAND/one.md')).toBe(false);
	f.files.delete('.nand/content/NAND/one.md'); f.storage.write = write;
	await migrateContent(f.storage, []);
	expect(f.files.get('.nand/content/NAND/one.md')).toBe('original');
});

test('last-moment source changes are retained and never reported complete', async () => {
	const f = fixture({ 'one.md': 'original' }), move = f.storage.move;
	f.storage.move = async (source, target) => { f.files.set(source, 'last update'); await move(source, target); };
	await expect(migrateContent(f.storage, ['one.md'])).rejects.toThrow('source-changed');
	expect(f.files.get('.nand/migrations/content/originals/one.md')).toBe('last update');
	expect(f.files.get('.nand/content/one.md')).toBe('original');
	await expect(migrateContent(f.storage, [])).rejects.toThrow('source-changed');
});

test('a target changed before cutover leaves both versions and the original untouched', async () => {
	const f = fixture({ 'one.md': 'original' }), write = f.storage.write;
	f.storage.write = async (path, text) => { await write(path, text); if (path.endsWith('manifest.json') && JSON.parse(text).stage === 'copied') f.files.set('.nand/content/one.md', 'external'); };
	await expect(migrateContent(f.storage, ['one.md'])).rejects.toThrow('target-changed');
	expect(f.files.get('one.md')).toBe('original');
	expect(f.files.get('.nand/content/one.md')).toBe('external');
});

test('a loaded manifest with case-colliding destinations fails before copying or moving any source', async () => {
	const f = fixture({ 'one.md': 'original', 'ONE.md': 'original' });
	const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('original')))].map(byte => byte.toString(16).padStart(2, '0')).join('');
	f.files.set('.nand/migrations/content/manifest.json', JSON.stringify({ version: 1, stage: 'prepared', files: [{ source: 'one.md', hash }, { source: 'ONE.md', hash }] }));
	await expect(migrateContent(f.storage, [])).rejects.toThrow();
	expect(f.files.get('one.md')).toBe('original'); expect(f.files.get('ONE.md')).toBe('original');
	expect([...f.files.keys()].some(path => path.startsWith('.nand/content/'))).toBe(false);
});
