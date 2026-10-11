import { constants } from 'node:fs';
import { copyFile, chmod } from 'node:fs/promises';
import { absoluteNandPath, absoluteVaultPath } from './nand-paths';
import { chmodAllowed, PRIVATE_FILE_MODE } from './private-mode';

/** COPYFILE_EXCL is checked by the filesystem at the destination commit. */
export async function copyContentExclusive(root: string, source: string, target: string): Promise<void> {
	const from = await absoluteVaultPath(root, source), to = await absoluteNandPath(root, target);
	await copyFile(from, to, constants.COPYFILE_EXCL);
	if (chmodAllowed(process.platform)) await chmod(to, PRIVATE_FILE_MODE);
}
