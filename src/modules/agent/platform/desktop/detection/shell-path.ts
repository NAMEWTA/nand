import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
export async function loginShellPath(timeoutMs = 5000): Promise<string | null> {
	if (process.platform === 'win32') return process.env.PATH ?? null;
	const { stdout } = await exec(
		process.env.SHELL || '/bin/bash',
		['-ilc', 'printf "__NAND_PATH__%s__NAND_PATH__" "$PATH"'],
		{ timeout: timeoutMs, maxBuffer: 1024 * 1024 },
	);
	return /__NAND_PATH__(.*?)__NAND_PATH__/s.exec(stdout)?.[1] ?? null;
}
