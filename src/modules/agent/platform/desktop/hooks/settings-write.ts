import path from 'node:path';
import { constants } from 'node:fs';
import type * as Fs from 'node:fs/promises';
import { AutomationError } from '../../../../../shared/automation/errors';

/** Claim the actual replaced version, then publish without overwriting a concurrent writer. */
export async function writeHookSettings(fs: typeof Fs, file: string, merge: (raw: string | undefined) => string, check: (file: string) => Promise<void>): Promise<void> {
	const pending = file + '.nand-install', original = path.join(pending, 'original'), next = path.join(pending, 'next');
	const read = async (target: string): Promise<string | undefined> => {
		await check(target);
		try { return await fs.readFile(target, 'utf8'); }
		catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
	};
	const restore = async (): Promise<void> => {
		if (await read(original) === undefined) return;
		const temporary = path.join(pending, 'restore-' + crypto.randomUUID());
		await check(temporary); await check(file);
		await fs.copyFile(original, temporary, constants.COPYFILE_EXCL);
		try { await fs.link(temporary, file); }
		catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
		finally { await fs.unlink(temporary); }
	};
	const archive = async (): Promise<void> => {
		const target = file + '.nand-backup-' + crypto.randomUUID();
		await check(pending); await check(target); await fs.rename(pending, target);
	};
	await check(pending);
	try {
		await fs.lstat(pending);
		// An interrupted install keeps its actual original. Restore only an absent main file;
		// if another writer already recreated it, retain both versions for recovery.
		await restore(); await archive();
	} catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
	const raw = await read(file), text = merge(raw);
	if (raw === text) return;
	await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
	await fs.mkdir(pending, { mode: 0o700 });
	try {
		await check(next); await fs.writeFile(next, text, { flag: 'wx', mode: 0o600 });
		if (raw !== undefined) {
			await check(file); await check(original); await fs.rename(file, original);
			if (await read(original) !== raw) throw new AutomationError('hookSettingsChanged');
		}
		await check(file); await check(next);
		try { await fs.link(next, file); }
		catch (error) { if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new AutomationError('hookSettingsChanged'); throw error; }
		await fs.unlink(next);
		if (await read(file) !== text) throw new AutomationError('hookSettingsChanged');
		await archive();
	} catch (error) { await restore(); throw error; }
}
