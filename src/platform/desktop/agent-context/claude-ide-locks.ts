/** Lock files Claude Code writes for an IDE. NAND used to add its own. */
export const NAND_IDE_NAME = 'NAND (Obsidian)';

export interface IdeLockIo {
	readdirSync(path: string): string[];
	readFileSync(path: string, encoding: 'utf8'): string;
	unlinkSync(path: string): void;
	join(directory: string, name: string): string;
}

/** True when `pid` is a live process. EPERM counts as alive; a missing pid does not. */
export function isProcessAlive(pid: number): boolean {
	if (!Number.isInteger(pid) || pid <= 0) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EPERM';
	}
}

/**
 * Delete NAND IDE lock files whose process has already exited.
 * Other IDEs, unreadable files, and locks with a live pid are left alone.
 * A missing directory is not an error and is not created.
 */
export function removeStaleNandIdeLockfiles(
	directory: string,
	io: IdeLockIo,
	isPidAlive: (pid: number) => boolean,
): void {
	let names: string[];
	try {
		names = io.readdirSync(directory);
	} catch (error) {
		if (errorCode(error) === 'ENOENT') return;
		throw error;
	}
	for (const name of names) {
		if (!name.endsWith('.lock')) continue;
		const file = io.join(directory, name);
		let parsed: unknown;
		try {
			parsed = JSON.parse(io.readFileSync(file, 'utf8'));
		} catch {
			continue;
		}
		if (!parsed || typeof parsed !== 'object') continue;
		const record = parsed as { ideName?: unknown; pid?: unknown };
		if (record.ideName !== NAND_IDE_NAME) continue;
		if (typeof record.pid !== 'number' || !Number.isInteger(record.pid) || record.pid <= 0) continue;
		if (isPidAlive(record.pid)) continue;
		try {
			io.unlinkSync(file);
		} catch (error) {
			if (errorCode(error) !== 'ENOENT') throw error;
		}
	}
}

function errorCode(error: unknown): unknown {
	return typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
}
