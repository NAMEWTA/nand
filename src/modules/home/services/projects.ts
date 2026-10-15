// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/pm-model.ts, src/pm-board-modal.ts
import { t } from '../../../shared/i18n';
import { createStore } from 'zustand/vanilla';
import type { App } from 'obsidian';
import { contentFiles } from '../../../host/obsidian/storage/content-files';
import { contentPath } from '../../../shared/storage/content-paths';
import type { PmConfig } from '../core/board/types/model';
import { parseProjectBody, projectBodyTemplate, insertProjectTask, removeProjectTask } from '../core/pm/body';
import { pipelineFrontmatter, patchPipelineFields } from '../platform/pipeline/vault';
import { togglePipelineTask, withinPipeline } from '../core/pipeline/rules';
import type { PipelineTask } from '../core/pipeline/model';
export interface Project {
	path: string;
	title: string;
	raw: string;
	fields: Record<string, unknown>;
	body: ReturnType<typeof parseProjectBody>;
}
export class ProjectStore {
	readonly state = createStore(() => ({ projects: [] as Project[], error: '', loading: true }));
	private generation = 0;
	private closed = false;
	private stop?: () => void;
	constructor(
		private app: App,
		private config: PmConfig,
	) {}
	connect(): () => void {
		this.closed = false;
		const files = contentFiles(this.app);
		this.stop = files.subscribe(() => {
			void this.load();
		});
		void this.load();
		return () => {
			this.closed = true;
			this.generation++;
			this.stop?.();
		};
	}
	async load(): Promise<void> {
		const version = ++this.generation;
		try {
			const files = contentFiles(this.app);
			await files.prepareMetadata();
			const result = await Promise.all(
				files
					.getMarkdownFiles()
					.filter(
						(f) =>
							withinPipeline(this.config.rootFolder, f.path) ||
							(!!this.config.archiveFolder && withinPipeline(this.config.archiveFolder, f.path)),
					)
					.filter((f) => !this.config.excludeFolders?.some((folder) => withinPipeline(folder, f.path)))
					.map(async (f) => {
						const raw = await files.read(f),
							fields = pipelineFrontmatter(raw);
						return { path: f.path, title: f.basename, raw, fields, body: parseProjectBody(raw) };
					}),
			);
			if (!this.closed && version === this.generation)
				this.state.setState({
					projects: result.filter((p) => String(p.fields.type).toLowerCase() === 'project'),
					loading: false,
					error: '',
				});
		} catch (error) {
			if (!this.closed) this.state.setState({ error: String(error), loading: false });
		}
	}
	async mutate(path: string, update: (raw: string) => string): Promise<void> {
		await contentFiles(this.app).process(path, (raw) => {
			if (raw === null) throw new Error(t('pm.fileMissing'));
			return update(raw);
		});
		await this.load();
	}
	fields(path: string, fields: Record<string, unknown>): Promise<void> {
		return this.mutate(path, (raw) => patchPipelineFields(raw, fields));
	}
	toggle(path: string, task: PipelineTask, checked: boolean): Promise<void> {
		return this.mutate(path, (raw) => togglePipelineTask(raw, task, checked));
	}
	addTask(path: string, section: 'milestone' | 'todo', text: string): Promise<void> {
		return this.mutate(path, (raw) => insertProjectTask(raw, section, text));
	}
	removeTask(path: string, task: PipelineTask): Promise<void> {
		return this.mutate(path, (raw) =>
			raw.split('\n')[task.line] === task.originalLine ? removeProjectTask(raw, task.line) : raw,
		);
	}
	async workNote(project: Project): Promise<string> {
		const files = contentFiles(this.app),
			folder = contentPath(`${this.config.rootFolder}/${project.title}`),
			base = `${folder}/${new Date().toLocaleDateString('sv-SE')}`,
			template = this.config.workNoteTemplate ? files.resolveLink(this.config.workNoteTemplate) : null;
		let path = base + '.md',
			i = 1;
		while (files.getFileByPath(path)) path = `${base} ${++i}.md`;
		await files.create(path, template ? await files.read(template) : `# ${project.title}\n\n`);
		return path;
	}
	async trash(path: string): Promise<void> {
		const files = contentFiles(this.app),
			file = files.getFileByPath(path);
		if (file) await files.trash(file);
		await this.load();
	}
	async create(name: string): Promise<void> {
		const path = contentPath(`${this.config.rootFolder}/${name.replace(/[/\\?%*:|"<>]/g, '-')}.md`);
		await contentFiles(this.app).create(
			path,
			`---\ntype: project\nstage: ${JSON.stringify(this.config.stages?.[0]?.label ?? '')}\n---\n\n${projectBodyTemplate(this.config.stages.map((s) => s.label))}\n`,
		);
		await this.load();
	}
	async archive(project: Project, archived: boolean): Promise<void> {
		await this.fields(project.path, { archived });
		if (archived && this.config.archiveFolder) {
			const files = contentFiles(this.app);
			const file = files.getFileByPath(project.path);
			if (file) await files.rename(file, contentPath(`${this.config.archiveFolder}/${project.title}.md`));
		}
		await this.load();
	}
}
