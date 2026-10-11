import { expect, test } from 'vitest';
import { memoryVault } from '../../../../../scripts/fixtures/memory-vault';
import { collectVaultTasks, toggleTaskInFile } from './alltasks-scan';

test('managed board tasks survive folder exclusions and use guarded writes when toggled', async () => {
	const path = '.nand/content/Boards/work.md';
	const vault = memoryVault({ [path]: '# Board\n- [ ] Review [due:: 2026-10-11]' });
	const tasks = await collectVaultTasks(vault.app, ['Boards'], 'Boards/work');
	expect(tasks.map(task => task.path)).toEqual([path]);
	await toggleTaskInFile(vault.app, tasks[0]!, true);
	expect(vault.contents.get(path)).toContain('- [x] Review');
	expect(await collectVaultTasks(vault.app, ['Boards'])).toEqual([]);
});
