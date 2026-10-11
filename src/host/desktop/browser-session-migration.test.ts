import { mkdtemp, mkdir, readFile, writeFile, readdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { prepareSessionDirectory, retainLegacyDirectory } from './browser-session-migration';

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function fixture() {
	const root = await mkdtemp(path.join(tmpdir(), 'nand-session-')); roots.push(root);
	const vault = path.join(root, 'vault'), source = path.join(root, 'host', 'Partitions', 'nand-browser-test');
	await mkdir(vault); await mkdir(path.join(source, 'Local Storage'), { recursive: true });
	await writeFile(path.join(source, 'Local Storage', 'data'), 'login-data');
	return { root, vault, source, relative: '.nand/browser/device/profiles/default', boot: 'boot-one', active: () => false };
}
test('cold migration requires a full process restart, verifies bytes and preserves originals inside the vault', async () => {
	const options = await fixture();
	await expect(prepareSessionDirectory(options)).rejects.toThrow('browser_session_restart');
	await expect(prepareSessionDirectory(options)).rejects.toThrow('browser_session_restart');
	const directory = await prepareSessionDirectory({ ...options, boot: 'boot-two' });
	expect(directory).toBe(path.join(options.vault, options.relative, 'session'));
	expect(await readFile(path.join(directory, 'Local Storage', 'data'), 'utf8')).toBe('login-data');
	expect(await readFile(path.join(options.source, 'Local Storage', 'data'), 'utf8')).toBe('login-data');
	await writeFile(path.join(directory, 'Local Storage', 'data'), 'new-data');
	expect(await prepareSessionDirectory({ ...options, boot: 'boot-three' })).toBe(directory);
	expect(await readFile(path.join(directory, 'Local Storage', 'data'), 'utf8')).toBe('new-data');
	expect(await prepareSessionDirectory({ ...options, source: path.join(options.root, 'relocated-host'), boot: 'boot-four' })).toBe(directory);
	expect(await readFile(path.join(options.vault, options.relative, 'legacy-original', 'Local Storage', 'data'), 'utf8')).toBe('login-data');
	await expect(readdir(options.source)).rejects.toMatchObject({ code: 'ENOENT' });
});
test('active legacy guests block copying and ambiguous ownership requires an explicit choice', async () => {
	const options = await fixture();
	await expect(prepareSessionDirectory({ ...options, ambiguous: true })).rejects.toThrow('browser_session_choice');
	await expect(prepareSessionDirectory({ ...options, ambiguous: true, choose: async () => 'copy' })).rejects.toThrow('browser_session_restart');
	await expect(prepareSessionDirectory({ ...options, boot: 'boot-two', active: () => true })).rejects.toThrow('browser_session_restart');
	const directory = await prepareSessionDirectory({ ...options, boot: 'boot-two' });
	expect(await readFile(path.join(directory, 'Local Storage', 'data'), 'utf8')).toBe('login-data');
});
test('choosing a fresh login leaves shared host data untouched across later restarts', async () => {
	const options = await fixture();
	const directory = await prepareSessionDirectory({ ...options, ambiguous: true, choose: async () => 'fresh' });
	expect(await readdir(directory)).toEqual([]);
	await prepareSessionDirectory({ ...options, boot: 'boot-three', ambiguous: true });
	expect(await readFile(path.join(options.source, 'Local Storage', 'data'), 'utf8')).toBe('login-data');
});
test('linked owned paths and legacy trees never publish a session', async () => {
	const options = await fixture();
	await symlink(options.source, path.join(options.vault, '.nand'), 'junction');
	await expect(prepareSessionDirectory(options)).rejects.toThrow('symlink');
});
test('inactive bridge artifacts are retained once and original absolute references have a durable mapping', async () => {
	const options = await fixture();
	const target = await retainLegacyDirectory(options.vault, '.nand/browser/device/legacy-runtime', options.source);
	expect(await readFile(path.join(target!, 'Local Storage', 'data'), 'utf8')).toBe('login-data');
	const receipt = JSON.parse(await readFile(path.join(options.vault, '.nand/browser/device/legacy-runtime/migration.json'), 'utf8')) as { origin: string; files: Record<string, string> };
	expect(receipt.origin).toBe(options.source); expect(receipt.files['Local Storage/data']).toMatch(/^[a-f\d]{64}$/);
	await expect(readdir(options.source)).rejects.toMatchObject({ code: 'ENOENT' });
	expect(await retainLegacyDirectory(options.vault, '.nand/browser/device/legacy-runtime', options.source)).toBe(target);
	await writeFile(path.join(target!, 'Local Storage', 'data'), 'user-edit');
	expect(await retainLegacyDirectory(options.vault, '.nand/browser/device/legacy-runtime', options.source)).toBe(target);
	expect(await readFile(path.join(target!, 'Local Storage', 'data'), 'utf8')).toBe('user-edit');
});
