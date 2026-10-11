import { expect, test } from 'vitest';
import { memoryVault } from '../../../../../scripts/fixtures/memory-vault';
import { contentFiles } from '../../../../host/obsidian/storage/content-files';
import { extractFrontmatterProperties, loadPreview, queryVaultFiles } from './library-file-result';

test('managed library notes remain visible, filterable and previewable after migration', async () => {
	const path = '.nand/content/Books/One.md';
	const vault = memoryVault({ [path]: '---\nproject: Alpha\ntags: [reading]\n---\n# A useful summary\nBody #inline' });
	const files = contentFiles(vault.app); await files.prepareMetadata();
	const results = queryVaultFiles(vault.app, { viewMode: 'list', folders: ['Books'], filters: [{ property: 'project', values: ['Alpha'] }], sortBy: 'name', sortDesc: false });
	expect(results.map(item => item.file.path)).toEqual([path]);
	expect(extractFrontmatterProperties(vault.app).get('project')).toContain('Alpha');
	expect(extractFrontmatterProperties(vault.app).get('tags')).toContain('#inline');
	expect(await loadPreview(vault.app, files.getFileByPath(path)!)).toContain('A useful summary');
});
