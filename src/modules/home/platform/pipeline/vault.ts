import { MarkdownView, TFolder, type App, type TFile } from 'obsidian';
import { patchFrontmatter, readMarkdownDocument, readYaml } from '../../../../shared/storage/markdown-document';
import type { PipelineConfig, PipelineNote, PipelineTask } from '../../core/pipeline/model';
import { pipelineConfigError, pipelineDestination, pipelineIncludes, resolvePipelineStage, togglePipelineTask, withinPipeline } from '../../core/pipeline/rules';
import { pipelineDueFields } from '../../core/pipeline/due';
import { deviceId } from '../../../../host/obsidian/storage/device-id';

export interface PipelineMoveResult {
	status: 'done' | 'refused' | 'partial';
	path: string;
	destination: string;
	completed: Array<'status' | 'rename'>;
	actual?: PipelineNote;
	error?: string;
}

export function pipelineFrontmatter(raw: string): Record<string, unknown> {
	return (readYaml(readMarkdownDocument(raw).yaml).toJSON() ?? {}) as Record<string, unknown>;
}
/** Patch owned keys into the latest YAML AST; retain comments, unknown fields and the body. */
export function patchPipelineFields(raw: string, fields: Record<string, unknown>): string {
	const current = pipelineFrontmatter(raw), body = readMarkdownDocument(raw).body;
	const before = Object.fromEntries(Object.keys(fields).filter(key => Object.hasOwn(current, key)).map(key => [key, current[key]]));
	const after = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
	return patchFrontmatter(raw, `---\n${JSON.stringify(before)}\n---\n${body}`, `---\n${JSON.stringify(after)}\n---\n${body}`);
}

/** Obsidian owns IO and link updates; no filesystem access or background retry. */
export class PipelineVault {
	constructor(private readonly app: App) {}
	private dto(file: TFile, frontmatter: Record<string, unknown>): PipelineNote {
		return { path: file.path, title: file.basename, mtime: file.stat.mtime, ctime: file.stat.ctime, frontmatter };
	}
	private file(path: string): TFile {
		const file = this.app.vault.getFileByPath(path);
		if (!file || file.extension !== 'md') throw new Error('home.pipeline.noteMissing');
		return file;
	}
	async read(path: string): Promise<{ note: PipelineNote; raw: string }> {
		const file = this.file(path), raw = await this.app.vault.read(file);
		if (file.path !== path) throw new Error('home.pipeline.contextChanged');
		return { note: this.dto(file, pipelineFrontmatter(raw)), raw };
	}
	scan(config: PipelineConfig): PipelineNote[] {
		if (pipelineConfigError(config)) return [];
		return this.app.vault.getMarkdownFiles().filter(file => withinPipeline(config.rootFolder, file.path))
			.map(file => this.dto(file, this.app.metadataCache.getFileCache(file)?.frontmatter ?? {})).filter(note => pipelineIncludes(config, note));
	}
	private checkEditor(file: TFile, raw: string): void {
		for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
			if (leaf.view instanceof MarkdownView && leaf.view.file === file && leaf.view.getMode() === 'source' && leaf.view.editor.getValue() !== raw) throw new Error('home.pipeline.editorConflict');
		}
	}
	private checkScope(config: PipelineConfig, file: TFile, raw: string, allowArchived = false, expectedPath = file.path): void {
		const note = this.dto(file, pipelineFrontmatter(raw));
		if (file.path !== expectedPath || pipelineConfigError(config) || !withinPipeline(config.rootFolder, file.path) || config.excludeFolders.some(folder => withinPipeline(folder, file.path))
			|| (!resolvePipelineStage(config, note.frontmatter[config.statusField]) && !(allowArchived && note.frontmatter[config.statusField] === 'archived'))) throw new Error('home.pipeline.contextChanged');
		this.checkEditor(file, raw);
	}
	private async preflight(file: TFile, destination: string): Promise<void> {
		if (destination === file.path) return;
		if (await this.app.vault.adapter.exists(destination)) throw new Error('home.pipeline.nameClash');
		const folders = destination.split('/').slice(0, -1);
		for (let i = 1; i <= folders.length; i++) {
			const existing = this.app.vault.getAbstractFileByPath(folders.slice(0, i).join('/'));
			if (existing && !(existing instanceof TFolder)) throw new Error('home.pipeline.nameClash');
		}
	}
	private async ensureParent(destination: string): Promise<void> {
		const folders = destination.split('/').slice(0, -1);
		for (let i = 1; i <= folders.length; i++) {
			const folder = folders.slice(0, i).join('/');
			if (!this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder);
		}
	}
	async move(config: PipelineConfig, path: string, targetId: string, signal?: AbortSignal): Promise<PipelineMoveResult> {
		let file: TFile | undefined, destination = path, statusValue: string | undefined;
		let statusAttempted = false;
		const completed: PipelineMoveResult['completed'] = [];
		try {
			signal?.throwIfAborted();
			file = this.file(path);
			const target = targetId === 'archive' ? 'archive' : config.stages.find(stage => stage.id === targetId);
			if (!target) throw new Error('home.pipeline.contextChanged');
			destination = pipelineDestination(config, path, target);
			statusValue = target === 'archive' ? 'archived' : target.value.trim();
			const raw = await this.app.vault.read(file);
			this.checkScope(config, file, raw, target === 'archive', path);
			await this.preflight(file, destination);
			signal?.throwIfAborted();
			// A retry after a partial move skips the status already present on disk.
			if (pipelineFrontmatter(raw)[config.statusField] !== statusValue) {
				statusAttempted = true;
				await this.app.vault.process(file, latest => {
					signal?.throwIfAborted();
					if (file!.path !== path) throw new Error('home.pipeline.contextChanged');
					this.checkScope(config, file!, latest, target === 'archive');
					return patchPipelineFields(latest, { [config.statusField]: statusValue });
				});
			}
			completed.push('status');
			if (destination !== file.path) {
				signal?.throwIfAborted();
				await this.preflight(file, destination);
				await this.ensureParent(destination);
				signal?.throwIfAborted();
				if (file.path !== path) throw new Error('home.pipeline.contextChanged');
				if (pipelineFrontmatter(await this.app.vault.read(file))[config.statusField] !== statusValue) throw new Error('home.pipeline.contextChanged');
				await this.app.fileManager.renameFile(file, destination);
				completed.push('rename');
			}
			const actual = (await this.read(file.path)).note;
			return { status: 'done', path: file.path, destination, completed, actual };
		} catch (error) {
			let actual: PipelineNote | undefined;
			try { actual = (await this.read(file?.path ?? path)).note; } catch { /* The original error and missing actual snapshot remain visible. */ }
			if (statusAttempted && statusValue !== undefined && actual?.frontmatter[config.statusField] === statusValue && !completed.includes('status')) completed.push('status');
			if (file?.path === destination && destination !== path && !completed.includes('rename')) completed.push('rename');
			return { status: completed.length ? 'partial' : 'refused', path: file?.path ?? path, destination, completed, actual, error: error instanceof Error ? error.message : String(error) };
		}
	}
	async updateFields(config: PipelineConfig, path: string, fields: Record<string, unknown>, expectedAutomationId: string): Promise<void> {
		const file = this.file(path);
		await this.app.vault.process(file, raw => {
			this.checkScope(config, file, raw, false, path);
			const current = pipelineFrontmatter(raw).nandAutomation;
			if (!current || typeof current !== 'object' || !('id' in current) || current.id !== expectedAutomationId) throw new Error('home.pipeline.contextChanged');
			return patchPipelineFields(raw, fields);
		});
	}
	async setDue(config: PipelineConfig, path: string, value: string, remind: boolean, signal?: AbortSignal): Promise<void> {
		const file = this.file(path), ownerDevice = deviceId(this.app), id = crypto.randomUUID();
		await this.app.vault.process(file, raw => {
			signal?.throwIfAborted(); this.checkScope(config, file, raw, false, path);
			const fields = pipelineDueFields(pipelineFrontmatter(raw), value, remind, { id, title: file.basename, deviceId: ownerDevice, now: Date.now() });
			return patchPipelineFields(raw, fields);
		});
	}
	async toggleTask(config: PipelineConfig, path: string, task: PipelineTask, checked: boolean, signal?: AbortSignal): Promise<void> {
		const file = this.file(path);
		await this.app.vault.process(file, raw => { signal?.throwIfAborted(); this.checkScope(config, file, raw, false, path); return togglePipelineTask(raw, task, checked); });
	}
}
