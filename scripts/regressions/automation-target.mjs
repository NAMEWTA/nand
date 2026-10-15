import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// Exercise the production React editor through DOM events, including the original clear/reselect regression.
const repo = process.env.NAND_REPO || process.cwd();
const result = spawnSync(process.execPath, [
	resolve(repo, 'node_modules/vitest/vitest.mjs'), 'run', '--project', 'dom',
	'src/modules/automations/ui/editor/automation-target.dom.test.tsx',
], { cwd: repo, stdio: 'inherit', timeout: 50000 });
if (result.error) console.error(result.error);
process.exitCode = result.status ?? 1;
