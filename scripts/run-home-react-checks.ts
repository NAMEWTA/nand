import { spawnSync } from 'node:child_process';
/** Keep named CLI checks available while running the current components in a real DOM implementation. */
export function runHomeReactChecks(paths: string[]): void {
	const result = spawnSync(
		process.execPath,
		['node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=1', ...paths.map((path) => `src/modules/home/${path}`)],
		{ stdio: 'inherit' },
	);
	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status ?? 1);
}
