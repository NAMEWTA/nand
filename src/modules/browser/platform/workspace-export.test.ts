import { expect, test } from 'vitest';
import { memoryVault } from '../../../../scripts/fixtures/memory-vault';
import { storageWriteQueue } from '../../../shared/storage/write-queue';
import { saveWorkspaceExport } from './workspace-export';

test('a queued export rechecks the module generation before publishing', async () => {
	const vault = memoryVault(); let active = true, release!: () => void;
	const wait = new Promise<void>(resolve => { release = resolve; });
	const blocked = storageWriteQueue(vault.adapter).run('nand-content:mutation', () => wait);
	const exported = saveWorkspaceExport(vault.app, 'NAND/AI Workspace', 'private conversation', 'md', () => { if (!active) throw new Error('disabled'); });
	active = false; release(); await blocked;
	await expect(exported).rejects.toThrow('disabled');
	expect([...vault.contents.keys()].some(path => path.includes('/Exports/'))).toBe(false);
});
