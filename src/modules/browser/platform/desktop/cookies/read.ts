import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { NativeHelperSqlite } from '../../../../agent/api';
/** SQLite sees a consistent WAL snapshot in a unique, vault-owned directory. */
export async function readCookieRows(
	source: string,
	kind: 'chromium' | 'firefox',
	tmp: string,
	helper: NativeHelperSqlite,
	signal?: AbortSignal,
): Promise<Array<Record<string, unknown>>> {
	const directory = join(tmp, randomUUID()),
		target = join(directory, 'Cookies');
	await fs.mkdir(directory, { recursive: true, mode: 0o700 });
	try {
		await fs.copyFile(source, target);
		for (const suffix of ['-wal', '-shm'])
			try {
				await fs.copyFile(source + suffix, target + suffix);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
			}
		if (signal?.aborted) throw new Error('Cookie import cancelled');
		// Wait for the native reader to close SQLite before removing the copy (also on Windows).
		const result = await helper.readCookies(target, kind);
		if (signal?.aborted) throw new Error('Cookie import cancelled');
		return result.rows;
	} finally {
		await fs.rm(directory, { recursive: true, force: true });
	}
}
