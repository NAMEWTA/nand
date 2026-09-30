import { spawnSync } from 'node:child_process';
for (const file of [
	'automation-target',
	'automation-dst',
	'automation-session',
	'dashboard-conflict',
	'server-lifecycle',
]) {
	const result = spawnSync(
		process.execPath,
		[
			'--experimental-transform-types',
			'--import',
			'./scripts/register-ts-hooks.mjs',
			`scripts/regressions/${file}.mjs`,
			...(file === 'server-lifecycle' ? ['--native-signal-fixture'] : []),
		],
		{ stdio: 'inherit', timeout: 30000, env: { ...process.env, TZ: 'America/New_York' } },
	);
	if (result.error) console.error(result.error);
	if (result.status !== 0) {
		process.exitCode = 1;
		break;
	}
}
