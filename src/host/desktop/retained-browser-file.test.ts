import path from 'node:path';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { expect, test } from 'vitest';
import { retainLegacyDirectory } from './browser-session-migration';
import { retainedBrowserFile } from './retained-browser-file';

test('old absolute artifact links resolve to the verified retained vault file', async () => {
	const root = await mkdtemp(path.join(tmpdir(), 'nand-artifact-link-')), vault = path.join(root, 'vault'), source = path.join(root, 'old-browser');
	await mkdir(vault); await mkdir(path.join(source, 'run/artifacts'), { recursive: true });
	const old = path.join(source, 'run/artifacts/screen.png'); await writeFile(old, 'image fixture');
	try {
		await retainLegacyDirectory(vault, '.nand/browser/device/legacy-runtime', source);
		const retained = path.join(vault, '.nand/browser/device/legacy-runtime/files/run/artifacts/screen.png');
		expect(await retainedBrowserFile(vault, old)).toBe(retained);
		expect(await retainedBrowserFile(vault, path.join(source, '../other'))).toBeUndefined();
		await writeFile(retained, 'changed');
		await expect(retainedBrowserFile(vault, old)).rejects.toThrow();
	} finally { await rm(root, { recursive: true, force: true }); }
});
