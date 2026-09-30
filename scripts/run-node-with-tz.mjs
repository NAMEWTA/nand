import { spawnSync } from 'node:child_process';

const [timezone, ...args] = process.argv.slice(2);
if (!timezone || !args.length) throw new Error('Usage: node scripts/run-node-with-tz.mjs <timezone> <node arguments...>');
const result = spawnSync(process.execPath, args, {
	stdio: 'inherit',
	env: { ...process.env, TZ: timezone },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
