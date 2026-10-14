import { AutomationError } from '../../../../shared/automation/errors';
import { precheckError } from './precheck-error';
import { execFile } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { readdir, readFile } from 'node:fs/promises';

interface ProcessIdentity {
	pid: number;
	parent: number;
	birth: string;
	owned: boolean;
}
const gone = (error: unknown) =>
	['ESRCH', 'ENOENT', 'EACCES', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '');
const pause = () => delay(15);

/** Inherited ownership survives setsid and reparenting; parent links also capture children that replace env. */
async function census(marker: string): Promise<ProcessIdentity[]> {
	if (process.platform === 'linux') {
		const rows = await Promise.all(
			(await readdir('/proc'))
				.filter((name) => /^\d+$/.test(name))
				.map(async (name) => {
					try {
						const stat = await readFile(`/proc/${name}/stat`, 'utf8');
						const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
						if (fields[0] === 'Z') return undefined;
						let owned = false;
						try {
							owned = (await readFile(`/proc/${name}/environ`, 'utf8')).split('\0').includes(marker);
						} catch (error) {
							if (!gone(error)) throw error;
						}
						return { pid: Number(name), parent: Number(fields[1]), birth: fields[19]!, owned };
					} catch (error) {
						if (!gone(error)) throw error;
						return undefined;
					}
				}),
		);
		return rows.filter((row): row is ProcessIdentity => !!row);
	}
	const output = await new Promise<string>((resolve, reject) => {
		execFile(
			'/bin/ps',
			['eww', '-axo', 'pid=,ppid=,lstart=,command='],
			{ timeout: 1000, maxBuffer: 8 * 1024 * 1024 },
			(error, stdout) => (error ? reject(precheckError(error)) : resolve(stdout)),
		);
	});
	return output.split('\n').flatMap((line) => {
		const match = /^\s*(\d+)\s+(\d+)\s+(.{24})\s+(.*)$/.exec(line);
		return match
			? [
					{
						pid: Number(match[1]),
						parent: Number(match[2]),
						birth: match[3]!,
						owned: match[4]!.split(/\s+/).includes(marker),
					},
				]
			: [];
	});
}

export function ownedProcesses(pid: number, marker: string) {
	const known = new Map<number, string>();
	const discover = async () => {
		const rows = await census(marker);
		for (const row of rows) if (row.owned || (row.pid === pid && !known.has(pid))) known.set(row.pid, row.birth);
		let changed: boolean;
		do {
			changed = false;
			for (const row of rows) {
				if (
					!known.has(row.pid) &&
					rows.some((parent) => parent.pid === row.parent && known.get(parent.pid) === parent.birth)
				) {
					known.set(row.pid, row.birth);
					changed = true;
				}
			}
		} while (changed);
		return rows.filter((row) => known.get(row.pid) === row.birth);
	};
	const signal = (rows: ProcessIdentity[], value: NodeJS.Signals) => {
		for (const row of rows) {
			try {
				process.kill(row.pid, value);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
			}
		}
	};
	return {
		observe: discover,
		async terminate() {
			const deadline = Date.now() + 1500;
			// Freeze then rescan before killing, so a process cannot fork between enumeration and termination.
			while (Date.now() < deadline) {
				const rows = await discover();
				if (!rows.length) return;
				signal(rows, 'SIGSTOP');
				const frozen = await discover();
				signal(frozen, 'SIGSTOP');
				signal(frozen, 'SIGKILL');
				await pause();
			}
			throw new AutomationError('precheckCleanupFailed');
		},
	};
}
