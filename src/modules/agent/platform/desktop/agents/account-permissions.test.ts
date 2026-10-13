import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { expect, test } from 'vitest';
import { accountEnv } from './accounts';
import { getAgent } from '../../../core/launch/catalog';

test('account creation repairs existing private data and uses the actual platform permission model', async () => {
	const vault = await mkdtemp(path.join(tmpdir(), 'nand-account-permissions-')), root = path.join(vault, '.nand/agents/fixture-device');
	await mkdir(root, { recursive: true, mode: 0o755 }); await writeFile(path.join(root, 'existing'), 'credential', { mode: 0o644 });
	try {
		await accountEnv(getAgent('codex'), '', vault, 'fixture-device');
		if (process.platform === 'win32') {
			const script = '$a=(Get-Item -LiteralPath $env:NAND_PERMISSION_PROBE -Force).GetAccessControl(); $s=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value; @{protected=$a.AreAccessRulesProtected; unexpected=@($a.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]) | Where-Object {$_.IdentityReference.Value -ne $s -and $_.IdentityReference.Value -ne "S-1-5-18"}).Count} | ConvertTo-Json -Compress';
			for (const file of [root, path.join(root, 'existing')]) {
				const result = await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, env: { ...process.env, NAND_PERMISSION_PROBE: file } });
				expect(JSON.parse(result.stdout)).toEqual({ protected: true, unexpected: 0 });
			}
		} else {
			expect((await stat(root)).mode & 0o777).toBe(0o700);
			expect((await stat(path.join(root, 'existing'))).mode & 0o777).toBe(0o600);
		}
	} finally { await rm(vault, { recursive: true, force: true }); }
}, 30000);
