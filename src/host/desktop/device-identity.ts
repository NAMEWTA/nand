import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { userInfo } from 'node:os';

function output(file: string, args: string[]): Promise<string> {
	return new Promise((resolve, reject) => execFile(file, args, { windowsHide: true, timeout: 5000, maxBuffer: 32 * 1024, encoding: 'utf8' }, (error, stdout) => error instanceof Error ? reject(error) : resolve(stdout)));
}

/** Never writes host identifiers or returns them to logs. A missing identifier requires manual selection. */
export async function machineIdentity(): Promise<string | undefined> {
	try {
		if (process.platform === 'win32') {
			const [machine, account] = await Promise.all([
				output('reg.exe', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', '/reg:64']),
				output('whoami.exe', ['/user', '/fo', 'csv', '/nh']),
			]);
			const guid = /MachineGuid\s+REG_SZ\s+([a-f\d-]{36})/i.exec(machine)?.[1];
			const sid = /S-1-(?:\d+-)+\d+/i.exec(account)?.[0];
			return guid && sid ? JSON.stringify(['win32', guid.toLowerCase(), sid]) : undefined;
		}
		const uid = userInfo().uid;
		if (process.platform === 'darwin') {
			const machine = await output('/usr/sbin/ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice']);
			const guid = /"IOPlatformUUID"\s*=\s*"([a-f\d-]{36})"/i.exec(machine)?.[1];
			return guid ? JSON.stringify(['darwin', guid.toLowerCase(), uid]) : undefined;
		}
		if (process.platform === 'linux') {
			const machine = (await readFile('/etc/machine-id', 'utf8')).trim();
			return /^[a-f\d]{32}$/i.test(machine) ? JSON.stringify(['linux', machine.toLowerCase(), uid]) : undefined;
		}
	} catch { /* The host cannot identify itself; initialization presents a device choice. */ }
	return undefined;
}
