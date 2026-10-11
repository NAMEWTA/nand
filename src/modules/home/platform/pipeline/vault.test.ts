import { expect, test, vi } from 'vitest';
import { TFile, TFolder, type App } from 'obsidian';
import { emptyPipeline, type PipelineConfig } from '../../core/pipeline/model';
import { PipelineVault } from './vault';

const config = (): PipelineConfig => ({ ...emptyPipeline(), rootFolder: 'Work', stages: [{ id: 'draft', value: 'Draft', label: 'Draft' }, { id: 'review', value: 'Review', label: 'Review', folder: 'Review' }], archiveFolder: 'Archive' });
const original = '---\r\nstatus: Draft # retain\r\ncustom: keep\r\n---\r\n# A\r\nBody.\r\n';
function environment() {
	const files = new Map<string, TFile>(), contents = new Map<string, string>(), folders = new Map<string, TFolder>();
	folders.set('Work', Object.assign(new TFolder(), { path: 'Work' }));
	const add = (path: string, raw: string) => { files.set(path, Object.assign(new TFile(), { path, basename: path.split('/').pop()!.replace(/\.md$/, ''), extension: 'md', stat: { mtime: 1, ctime: 1, size: raw.length } })); contents.set(path, raw); };
	add('Work/A.md', original);
	let beforeProcess: (() => void) | undefined;
	const process = vi.fn(async (file: TFile, update: (raw: string) => string) => { beforeProcess?.(); const next = update(contents.get(file.path)!); contents.set(file.path, next); return next; });
	const renameFile = vi.fn(async (file: TFile, to: string) => { if (files.has(to)) throw new Error('Occupied'); const raw = contents.get(file.path)!; files.delete(file.path); contents.delete(file.path); file.path = to; files.set(to, file); contents.set(to, raw); });
	const app = { vault: {
		getFileByPath: (path: string) => files.get(path), getAbstractFileByPath: (path: string) => files.get(path) ?? folders.get(path),
		read: async (file: TFile) => contents.get(file.path)!, process,
		adapter: { exists: async (path: string) => files.has(path) || folders.has(path) },
		createFolder: vi.fn(async (path: string) => { folders.set(path, Object.assign(new TFolder(), { path })); }),
	}, fileManager: { renameFile }, workspace: { getLeavesOfType: () => [] } } as unknown as App;
	return { port: new PipelineVault(app), add, contents, process, renameFile, app, beforeProcess: (fn: () => void) => { beforeProcess = fn; } };
}

test('preflight refuses destination collision and traversal before status, folder or rename mutations', async () => {
	const env = environment(); env.add('Work/Review/A.md', 'Existing');
	const result = await env.port.move(config(), 'Work/A.md', 'review');
	expect(result.status).toBe('refused'); expect(result.completed).toEqual([]); expect(result.error).toBe('home.pipeline.nameClash');
	expect(env.process).not.toHaveBeenCalled(); expect(env.renameFile).not.toHaveBeenCalled(); expect(env.app.vault.createFolder).not.toHaveBeenCalled();
	expect(env.contents.get('Work/A.md')).toBe(original);
	const bad = config(); bad.stages[1]!.folder = '../../Else';
	expect((await env.port.move(bad, 'Work/A.md', 'review')).status).toBe('refused'); expect(env.process).not.toHaveBeenCalled();
});

test('status update operates on latest raw content and optional move uses host link-maintaining API', async () => {
	const env = environment(); env.beforeProcess(() => env.contents.set('Work/A.md', original.replace('custom: keep', 'custom: external').replace('Body.', 'Edited body.')));
	const result = await env.port.move(config(), 'Work/A.md', 'review');
	expect(result.status).toBe('done'); expect(result.completed).toEqual(['status', 'rename']); expect(result.path).toBe('Work/Review/A.md');
	expect(env.contents.get(result.path)).toBe(original.replace('status: Draft', 'status: Review').replace('custom: keep', 'custom: external').replace('Body.', 'Edited body.'));
	expect(env.renameFile).toHaveBeenCalledOnce();
	const keep = environment(); const cfg = config(); delete cfg.stages[1]!.folder;
	expect((await keep.port.move(cfg, 'Work/A.md', 'review')).status).toBe('done'); expect(keep.renameFile).not.toHaveBeenCalled();
});

test('partial failure reports real disk status and explicit retry only finishes the missing rename', async () => {
	const env = environment(); env.renameFile.mockRejectedValueOnce(new Error('Rename denied'));
	const first = await env.port.move(config(), 'Work/A.md', 'review');
	expect(first.status).toBe('partial'); expect(first.completed).toEqual(['status']); expect(first.actual?.frontmatter.status).toBe('Review'); expect(first.path).toBe('Work/A.md');
	const retry = await env.port.move(config(), first.path, 'review');
	expect(retry.status).toBe('done'); expect(retry.path).toBe('Work/Review/A.md'); expect(env.process).toHaveBeenCalledOnce(); expect(env.renameFile).toHaveBeenCalledTimes(2);
});

test('archiving is explicit, uses the configured destination and can finish a partial archive', async () => {
	const env = environment(); env.renameFile.mockRejectedValueOnce(new Error('Archive denied'));
	const first = await env.port.move(config(), 'Work/A.md', 'archive');
	expect(first.actual?.frontmatter.status).toBe('archived'); expect(first.status).toBe('partial');
	const retry = await env.port.move(config(), first.path, 'archive');
	expect(retry.path).toBe('Archive/A.md'); expect(retry.status).toBe('done'); expect(env.process).toHaveBeenCalledOnce();
	const unconfigured = environment(); const cfg = config(); delete cfg.archiveFolder;
	expect((await unconfigured.port.move(cfg, 'Work/A.md', 'archive')).status).toBe('refused'); expect(unconfigured.process).not.toHaveBeenCalled();
});
