import { open } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { shell } from 'electron';
import { absoluteVaultPath } from '../../../../host/desktop/nand-paths';
const desktopShell = shell as unknown as {
	showItemInFolder(path: string): void;
	trashItem(path: string): Promise<void>;
};
/** Only paths returned by the agent public skill directory reach this seam. */
export async function readSkillFile(path: string): Promise<{ text: string; mtime: number }> {
	if (basename(path) !== 'SKILL.md') throw new Error('Invalid skill path');
	const file = await open(path, 'r');
	try {
		const stat = await file.stat();
		const buffer = new Uint8Array(Math.min(stat.size, 262144));
		const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
		return { text: new TextDecoder().decode(buffer.subarray(0, bytesRead)), mtime: stat.mtimeMs };
	} finally {
		await file.close();
	}
}
export async function revealSkillFile(path: string, vaultRoot?: string): Promise<void> {
	desktopShell.showItemInFolder(vaultRoot ? await absoluteVaultPath(vaultRoot, path) : path);
}
export async function trashSkillDirectory(path: string): Promise<void> {
	if (basename(path) !== 'SKILL.md') throw new Error('Invalid skill path');
	await desktopShell.trashItem(dirname(path));
}
