import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { formatResumeCommand } from './resume-command';

const value = "a 'quote' $(echo unsafe) `echo unsafe`";
const request = {
	cwd: process.cwd(),
	file: process.execPath,
	args: ['-e', 'process.stdout.write(JSON.stringify([process.env.CODEX_HOME,process.argv[1]]))', value],
	env: { CODEX_HOME: value },
	title: '',
};
const windows = process.platform === 'win32';

test('the PowerShell resume command keeps the managed account path and literal arguments', () => {
	const encoded = formatResumeCommand(request, true).split(' ').at(-1)!;
	const script = Buffer.from(encoded, 'base64').toString('utf16le');
	expect(script).toContain("$env:CODEX_HOME='a ''quote'' $(echo unsafe) `echo unsafe`'");
	expect(script).toContain('Set-Location -LiteralPath');
});

// Each copied command runs in the shell it is written for; /bin/sh does not exist on Windows runners.
test.skipIf(windows)('copied POSIX resume commands preserve managed account paths and literal arguments', () => {
	const command = formatResumeCommand(request, false);
	expect(JSON.parse(execFileSync('/bin/sh', ['-c', command], { encoding: 'utf8' }))).toEqual([value, value]);
});

test.runIf(windows)('copied PowerShell resume commands preserve managed account paths and literal arguments', () => {
	const [, ...args] = formatResumeCommand(request, true).split(' ');
	expect(JSON.parse(execFileSync('powershell.exe', args, { encoding: 'utf8', windowsHide: true }))).toEqual([value, value]);
});
