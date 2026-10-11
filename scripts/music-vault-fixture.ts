import { FileSystemAdapter, type App } from 'obsidian';
import { mkdtemp, readFile, writeFile, mkdir, stat, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { initializeDevice } from '../src/host/obsidian/storage/device-id';
import { runtimeRequire } from './music-electron-stub';
export async function musicVaultFixture(): Promise<{ app: App; dispose(): Promise<void> }> {
	const root = await mkdtemp(path.join(tmpdir(), 'nand-music-vault-'));
	const adapter = Object.assign(new FileSystemAdapter(), {
		getBasePath: () => root,
		exists: async (file: string) => { try { await stat(path.join(root, file)); return true; } catch { return false; } },
		read: (file: string) => readFile(path.join(root, file), 'utf8'),
		write: (file: string, text: string) => writeFile(path.join(root, file), text),
		mkdir: (directory: string) => mkdir(path.join(root, directory), { recursive: true }),
	});
	const app = { vault: { adapter, getName: () => 'unit-music' }, workspace: { containerEl: { win: { require: runtimeRequire } } }, loadLocalStorage: () => null, saveLocalStorage: () => {} } as unknown as App;
	await initializeDevice(app, { machineIdentity: async () => 'music-test-machine', label: 'test', chooseDevice: async () => ({ label: 'test' }) });
	return { app, dispose: () => rm(root, { recursive: true, force: true }) };
}
