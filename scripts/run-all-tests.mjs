import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const { scripts } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const runner = process.env.npm_execpath;
if (!runner) throw new Error('Run through pnpm run test:all');
const tests = Object.keys(scripts).filter(name => name.startsWith('test:') && name !== 'test:all');
const failed = [];
for (const name of tests) {
	const result = spawnSync(process.execPath, [runner, 'run', name], { stdio: 'inherit', env: process.env });
	if (result.status !== 0 || result.error) failed.push(name);
}
console.log(JSON.stringify({ total: tests.length, passed: tests.length - failed.length, failed }));
process.exitCode = failed.length ? 1 : 0;
