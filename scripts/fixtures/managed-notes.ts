import { contentPath } from '../../src/shared/storage/content-paths';
import { memoryVault } from './memory-vault';

/** Complete Adapter fixture: native templates remain visible; owned output is hidden. */
export function managedNotes(templates: Record<string, string> = {}, existing = new Set<string>()) {
	const initial = { ...templates };
	for (const path of existing) if (path.endsWith('.md')) initial[contentPath(path)] = '';
	const vault = memoryVault(initial), created: Array<{ path: string; content: string }> = [], mkdirs: string[] = [];
	const write = vault.adapter.write.bind(vault.adapter), mkdir = vault.adapter.mkdir.bind(vault.adapter);
	vault.adapter.write = async (path, content) => { const fresh = !vault.contents.has(path); await write(path, content); if (fresh && path.startsWith('.nand/content/')) created.push({ path, content }); };
	vault.adapter.mkdir = async path => { mkdirs.push(path); await mkdir(path); };
	return { app: vault.app, created, mkdirs };
}
