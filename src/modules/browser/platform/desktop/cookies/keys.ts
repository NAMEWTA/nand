import { setTimeout as schedule, clearTimeout as cancel } from 'node:timers';
// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/main/browser/browser-cookie-key.ts
import { pbkdf2Sync } from 'node:crypto';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { DetectedBrowser } from '../../../core/cookies';
export type EncryptionKeyResult =
	| { mode: 'aes-128-cbc'; keysByVersion: { v10?: Buffer; v11?: Buffer }; keyringUnavailable?: boolean }
	| { mode: 'aes-256-gcm'; key: Buffer };
function command(program: string, args: string[], input = ''): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn(program, args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
		let output = '';
		const timeout = schedule(() => {
			child.kill();
			reject(new Error('Key retrieval timed out'));
		}, 30000);
		child.stdout.on('data', (data: Buffer) => {
			if (output.length < 65536) output += data.toString();
			else child.kill();
		});
		child.stderr.resume();
		child.stdin.on('error', () => undefined);
		child.on('error', (error) => {
			cancel(timeout);
			reject(error);
		});
		child.on('close', (code) => {
			cancel(timeout);
			if (code === 0) resolve(output.trim());
			else reject(new Error('Key retrieval unavailable'));
		});
		child.stdin.end(input);
	});
}
// The fixed bridge reads query metadata from stdin, without evaluating it as shell code.
// security/secret-tool lookup accept attributes only in argv; only this final local exec uses argv.
const KEY_QUERIES = {
	mac: 'IFS= read -r service; IFS= read -r account; exec /usr/bin/security find-generic-password -s "$service" -a "$account" -w',
	linux: 'IFS= read -r service; IFS= read -r account; exec /usr/bin/secret-tool lookup service "$service" account "$account"',
	application: 'IFS= read -r application; exec /usr/bin/secret-tool lookup application "$application"',
} as const;
export function queryKeyring(kind: keyof typeof KEY_QUERIES, values: string[]): Promise<string> {
	if (values.length !== (kind === 'application' ? 1 : 2) || values.some((value) => /[\r\n\0]/.test(value)))
		return Promise.reject(new Error('Invalid keyring metadata'));
	return command('/bin/sh', ['-c', KEY_QUERIES[kind]], values.join('\n') + '\n');
}
export async function getEncryptionKey(browser: DetectedBrowser): Promise<EncryptionKeyResult | null> {
	const service = browser.keychainService || '',
		account = browser.keychainAccount || '';
	if (process.platform === 'darwin') {
		try {
			const raw = await queryKeyring('mac', [service, account]);
			return { mode: 'aes-128-cbc', keysByVersion: { v10: pbkdf2Sync(raw, 'saltysalt', 1003, 16, 'sha1') } };
		} catch {
			return null;
		}
	}
	if (process.platform === 'linux') {
		const v10 = pbkdf2Sync('peanuts', 'saltysalt', 1, 16, 'sha1');
		let password = '';
		try {
			password = await queryKeyring('linux', [service, account]);
		} catch {
			/* Try newer keyring metadata. */
		}
		if (!password)
			try {
				password = await queryKeyring('application', [account.toLowerCase().replaceAll(' ', '')]);
			} catch {
				/* v10 remains available. */
			}
		return {
			mode: 'aes-128-cbc',
			keysByVersion: { v10, ...(password ? { v11: pbkdf2Sync(password, 'saltysalt', 1, 16, 'sha1') } : {}) },
			keyringUnavailable: !password,
		};
	}
	if (process.platform === 'win32')
		try {
			const data = JSON.parse(await fs.readFile(join(browser.root, 'Local State'), 'utf8')) as {
				os_crypt?: { encrypted_key?: string };
			};
			if (!data.os_crypt?.encrypted_key || !process.env.SystemRoot) return null;
			const encrypted = Buffer.from(data.os_crypt.encrypted_key, 'base64');
			if (encrypted.subarray(0, 5).toString() !== 'DPAPI') return null;
			const script =
				'Add-Type -AssemblyName System.Security; $data=[Convert]::FromBase64String([Console]::In.ReadLine()); [Convert]::ToBase64String([System.Security.Cryptography.ProtectedData]::Unprotect($data,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser))';
			const output = await command(
				join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
				['-NoProfile', '-NonInteractive', '-Command', script],
				encrypted.subarray(5).toString('base64') + '\n',
			);
			const key = Buffer.from(output, 'base64');
			return key.length === 32 ? { mode: 'aes-256-gcm', key } : null;
		} catch {
			return null;
		}
	return null;
}
