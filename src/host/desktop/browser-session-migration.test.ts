import { mkdtemp, mkdir, readFile, writeFile, readdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { prepareSessionDirectory, confirmSessionDirectory, retainLegacyDirectory, clearSessionRecovery } from './browser-session-migration';

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
	await confirmSessionDirectory(options.vault, options.relative, 'boot-two');
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

test('two explicitly selected vaults retain their own original bytes before either cleans the shared source', async () => {
	const first = await fixture(), otherVault = path.join(first.root, 'other-vault'); await mkdir(otherVault);
	const second = { ...first, vault: otherVault };
	for (const options of [first, second]) await expect(prepareSessionDirectory({ ...options, ambiguous: true, choose: async () => 'copy' })).rejects.toThrow('browser_session_restart');
	for (const options of [first, second]) { await prepareSessionDirectory({ ...options, boot: 'two' }); await confirmSessionDirectory(options.vault, options.relative, 'two'); }
	for (const options of [first, second]) {
		const target = await prepareSessionDirectory({ ...options, boot: 'three' });
		expect(await readFile(path.join(target, 'Local Storage/data'), 'utf8')).toBe('login-data');
		expect(await readFile(path.join(options.vault, options.relative, 'legacy-original/Local Storage/data'), 'utf8')).toBe('login-data');
	}
});

test('a missing published session never authorizes removal of its original source', async () => {
	const options = await fixture();
	await expect(prepareSessionDirectory(options)).rejects.toThrow('browser_session_restart');
	const target = await prepareSessionDirectory({ ...options, boot: 'two' });
	await confirmSessionDirectory(options.vault, options.relative, 'two');
	await rm(target, { recursive: true });
	await expect(prepareSessionDirectory({ ...options, boot: 'three' })).rejects.toThrow('browser_session_unclaimed');
	expect(await readFile(path.join(options.source, 'Local Storage/data'), 'utf8')).toBe('login-data');
});

test('a native initialization failure leaves the source until a successful switch and a later boot', async () => {
	const options = await fixture();
	await expect(prepareSessionDirectory(options)).rejects.toThrow('browser_session_restart');
	await prepareSessionDirectory({ ...options, boot: 'two' });
	await prepareSessionDirectory({ ...options, boot: 'three' });
	expect(await readFile(path.join(options.source, 'Local Storage/data'), 'utf8')).toBe('login-data');
	await confirmSessionDirectory(options.vault, options.relative, 'three');
	await prepareSessionDirectory({ ...options, boot: 'three' });
	expect(await readFile(path.join(options.source, 'Local Storage/data'), 'utf8')).toBe('login-data');
	await prepareSessionDirectory({ ...options, boot: 'four' });
	await expect(readdir(options.source)).rejects.toMatchObject({ code: 'ENOENT' });
});

test('account deletion removes all legacy credentials after cold migration while preserving downloads and other profiles', async () => {
	for (const complete of [false, true]) {
		const options = await fixture();
		await expect(prepareSessionDirectory(options)).rejects.toThrow('browser_session_restart');
		await prepareSessionDirectory({ ...options, boot: 'two' });
		await confirmSessionDirectory(options.vault, options.relative, 'two');
		if (complete) await prepareSessionDirectory({ ...options, boot: 'three' });
		const downloads = path.join(options.vault, options.relative, 'downloads'); await mkdir(downloads); await writeFile(path.join(downloads, 'saved'), 'user-material');
		await clearSessionRecovery({ ...options, boot: 'three' });
		await clearSessionRecovery({ ...options, boot: 'three' });
		await expect(readdir(options.source)).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(readdir(path.join(options.vault, options.relative, 'legacy-original'))).rejects.toMatchObject({ code: 'ENOENT' });
		expect(await readFile(path.join(downloads, 'saved'), 'utf8')).toBe('user-material');
		await prepareSessionDirectory({ ...options, boot: 'four' });
	}
}, 30000);
