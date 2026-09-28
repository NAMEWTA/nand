import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const roots = [
	'src/core/pty',
	'src/core/agent-launch',
	'src/core/ai-vault',
	'src/platform/desktop',
	'src/platform/terminal-server',
	'src/view/terminal',
	'src/view/agent-usage',
	'src/plugin/modules/terminal',
];
function tests(dir) {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory()
			? tests(`${dir}/${entry.name}`)
			: entry.name.endsWith('.test.ts')
				? [`${dir}/${entry.name}`]
				: [],
	);
}
const result = spawnSync(
	process.execPath,
	['--experimental-strip-types', '--import', './scripts/register-ts-hooks.mjs', '--test', ...roots.flatMap(tests)],
	{ stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
