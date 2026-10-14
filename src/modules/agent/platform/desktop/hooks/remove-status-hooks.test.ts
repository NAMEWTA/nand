import { test, expect } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { removeStatusHooks } from './remove-status-hooks';

test('disabling status hooks removes only NAND commands, preserving mixed user hook groups', async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nand-remove-hooks-'));
	try {
		const file = path.join(root, 'settings.json');
		const user = { type: 'command', command: 'echo keep-user-hook' };
		const ours = { type: 'command', command: `node ${path.join(root, 'nand-automation-hook.cjs')} Stop` };
		const otherAccount = { type: 'command', command: 'node /another-account/nand-automation-hook.cjs Stop' };
		await fs.writeFile(
			file,
			JSON.stringify({
				theme: 'keep',
				hooks: { Stop: [{ matcher: '*', hooks: [ours, user] }, { hooks: [ours] }, { hooks: [otherAccount] }] },
			}),
		);
		await removeStatusHooks('claude-code', { NAND_ACCOUNT_ROOT: root, CLAUDE_CONFIG_DIR: root });
		expect(JSON.parse(await fs.readFile(file, 'utf8'))).toEqual({
			theme: 'keep',
			hooks: { Stop: [{ matcher: '*', hooks: [user] }, { hooks: [otherAccount] }] },
		});
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
});
