import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { formatResumeCommand } from './resume-command';

test('copied resume commands preserve managed account paths and literal arguments', () => {
	const value = "a 'quote' $(echo unsafe) `echo unsafe`";
	const request = {
		cwd: process.cwd(),
		file: process.execPath,
		args: ['-e', 'process.stdout.write(JSON.stringify([process.env.CODEX_HOME,process.argv[1]]))', value],
		env: { CODEX_HOME: value },
		title: '',
	};
	const command = formatResumeCommand(request, false);
	expect(JSON.parse(execFileSync('/bin/sh', ['-c', command], { encoding: 'utf8' }))).toEqual([value, value]);
	const encoded = formatResumeCommand(request, true).split(' ').at(-1)!;
	const script = Buffer.from(encoded, 'base64').toString('utf16le');
	expect(script).toContain("$env:CODEX_HOME='a ''quote'' $(echo unsafe) `echo unsafe`'");
	expect(script).toContain('Set-Location -LiteralPath');
});
