import { expect, test } from 'vitest';
import { TFile, type App } from 'obsidian';
import { emptyPipeline } from '../../core/pipeline/model';
import { pipelineDueFields } from '../../core/pipeline/due';
import { pipelineFrontmatter } from './vault';
import { PipelineAutomationSource } from './automation';

test('workflow reminders enter the existing source, follow moved notes and persist editor changes', async () => {
	const files = new Map<string, TFile>(), contents = new Map<string, string>();
	const fields = pipelineDueFields({}, '2026-10-12 09:30', true, { id: 'sample', deviceId: 'device', title: 'Review note', now: 100 });
	const file = Object.assign(new TFile(), { path: 'Work/A.md', basename: 'A', extension: 'md', stat: { mtime: 1, ctime: 1, size: 100 } });
	files.set(file.path, file); contents.set(file.path, `---\n${JSON.stringify({ status: 'Draft', ...fields })}\n---\nOriginal body.\n`);
	const app = { vault: {
		getMarkdownFiles: () => [...files.values()], getFileByPath: (path: string) => files.get(path),
		read: async (file: TFile) => contents.get(file.path)!,
		process: async (file: TFile, update: (raw: string) => string) => { const next = update(contents.get(file.path)!); contents.set(file.path, next); return next; },
	}, workspace: { getLeavesOfType: () => [] }, metadataCache: { getFileCache: (file: TFile) => ({ frontmatter: pipelineFrontmatter(contents.get(file.path)!) }) } } as unknown as App;
	const source = new PipelineAutomationSource(app), scope = { boardPath: 'Board.md', config: { ...emptyPipeline(), rootFolder: 'Work', stages: [{ id: 'draft', value: 'Draft', label: 'Draft' }] } };
	const rows = await source.list([scope, { ...scope, boardPath: 'Other board.md' }]);
	expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ id: 'pipeline:sample', deviceId: 'device', source: { kind: 'dashboard', path: 'Board.md', id: 'pipeline:sample' }, schedule: { kind: 'once', at: new Date(2026, 9, 12, 9, 30).getTime() } });
	const raw = contents.get(file.path)!; files.delete(file.path); contents.delete(file.path); file.path = 'Work/Review/A.md'; files.set(file.path, file); contents.set(file.path, raw);
	await source.list([scope]); expect(source.resolve(rows[0]!.source!)).toBe(file);
	await source.save({ ...rows[0]!, enabled: false, schedule: { kind: 'once', at: new Date(2026, 9, 13, 10).getTime() } }, false);
	expect((await source.list([scope]))[0]).toMatchObject({ enabled: false, schedule: { kind: 'once', at: new Date(2026, 9, 13, 10).getTime() } });
	expect(contents.get(file.path)).toContain('Original body.\n');
	await source.save(rows[0]!, true); expect(await source.list([scope])).toEqual([]);
	expect(pipelineFrontmatter(contents.get(file.path)!)).toHaveProperty('due');
	expect(pipelineFrontmatter(contents.get(file.path)!)).not.toHaveProperty('nandAutomation');
});
