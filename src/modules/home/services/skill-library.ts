// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/skill-store.ts
import { validSkillName } from '../../../shared/agent-prompt';
import { t } from '../../../shared/i18n';
import { createStore } from 'zustand/vanilla';
import { Platform, type App } from 'obsidian';
import { contentFiles } from '../../../host/obsidian/storage/content-files';
import { contentPath } from '../../../shared/storage/content-paths';
import { readMarkdownDocument, readYaml } from '../../../shared/storage/markdown-document';
import { homeServices } from './instances';
import type { SkillSource } from '../../agent/api';
export interface LibrarySource extends SkillSource {
	agents: string[];
	mtime?: number;
	text?: string;
	description?: string;
}
export interface LibrarySkill {
	name: string;
	sources: LibrarySource[];
	description?: string;
}
export class SkillLibrary {
	readonly state = createStore(() => ({ entries: [] as LibrarySkill[], loading: false, error: '' }));
	private abort?: AbortController;
	constructor(private app: App) {}
	dispose(): void {
		this.abort?.abort();
	}
	async refresh(): Promise<void> {
		this.abort?.abort();
		const abort = new AbortController();
		this.abort = abort;
		this.state.setState({ loading: true, error: '' });
		try {
			const directory = homeServices.skills?.();
			const targets = (directory?.targets() ?? []).filter((target) => directory?.capability(target.id));
			const scans = await Promise.all(targets.map((target) => directory!.list(target.id, abort.signal)));
			const merged = new Map<string, LibrarySkill>();
			for (const [index, scan] of scans.entries())
				for (const entry of scan.entries) {
					const row = merged.get(entry.name) ?? { name: entry.name, sources: [] };
					for (const source of entry.sources) {
						const existing = row.sources.find((s) => s.kind === source.kind && s.path === source.path);
						const agent = targets[index]!.id;
						const owner = source.path.includes('.codex/')
							? 'codex'
							: source.path.includes('.claude/')
								? 'claude-code'
								: undefined;
						const agents = !owner || owner === agent ? [agent] : [];
						if (existing) {
							if (agents.length && !existing.agents.includes(agent)) existing.agents.push(agent);
						} else row.sources.push({ ...source, agents });
					}
					merged.set(entry.name, row);
				}
			const files = contentFiles(this.app);
			for (const file of files
				.getMarkdownFiles()
				.filter((f) => f.path.startsWith('.nand/content/NAND/技能/') && f.name === 'SKILL.md')) {
				const text = await files.read(file),
					name = readYaml(readMarkdownDocument(text).yaml).get('name') ?? file.path.split('/').at(-2);
				if (typeof name === 'string') {
					const entry = merged.get(name) ?? { name, sources: [] };
					if (!entry.sources.some((s) => s.path === file.path))
						entry.sources.push({
							kind: 'vault',
							path: file.path,
							agents: targets.map((target) => target.id),
						});
					merged.set(name, entry);
				}
			}
			for (const entry of merged.values())
				for (const source of entry.sources) {
					if (abort.signal.aborted) return;
					try {
						const detail = await this.read(source);
						source.text = detail.text;
						source.mtime = detail.mtime;
						const description = readYaml(readMarkdownDocument(detail.text).yaml).get('description');
						if (typeof description === 'string') {
							source.description = description;
							entry.description ||= description;
						}
					} catch {
						/* A remembered or unavailable source still has a usable invocation. */
					}
				}
			if (!abort.signal.aborted)
				this.state.setState({
					entries: [...merged.values()].sort((a, b) => a.name.localeCompare(b.name)),
					loading: false,
				});
		} catch (e) {
			if (!abort.signal.aborted) this.state.setState({ loading: false, error: String(e) });
		}
	}
	async read(source: SkillSource): Promise<{ text: string; mtime: number }> {
		if (source.kind === 'directory' && Platform.isDesktopApp)
			return (await import('../platform/desktop/skill-files')).readSkillFile(source.path);
		if (source.kind !== 'vault') throw new Error(t('skills.docReadFailed'));
		return {
			text: (await this.app.vault.adapter.read(source.path)).slice(0, 262144),
			mtime: (await this.app.vault.adapter.stat(source.path))?.mtime ?? 0,
		};
	}
	async reveal(source: LibrarySource): Promise<void> {
		if (Platform.isDesktopApp && (source.kind === 'directory' || source.kind === 'vault')) {
			const adapter = this.app.vault.adapter as { getBasePath?: () => string };
			const base = source.kind === 'vault' ? adapter.getBasePath?.() : undefined;
			if (source.kind === 'directory' || base) {
				await (await import('../platform/desktop/skill-files')).revealSkillFile(source.path, base);
				return;
			}
		}
		if (source.kind === 'vault') await contentFiles(this.app).open(source.path);
	}
	async remove(entry: LibrarySkill, source: LibrarySource): Promise<void> {
		// Only discovered instances can be removed; the caller confirms each instance.
		if (!this.state.getState().entries.some((row) => row.name === entry.name && row.sources.includes(source)))
			return;
		if (source.kind === 'directory' && Platform.isDesktopApp)
			await (await import('../platform/desktop/skill-files')).trashSkillDirectory(source.path);
		else if (source.kind === 'vault' && source.path.endsWith('/SKILL.md')) {
			const folder = source.path.slice(0, -'/SKILL.md'.length);
			if (!(await this.app.vault.adapter.trashSystem(folder))) await this.app.vault.adapter.trashLocal(folder);
		} else if (source.kind === 'remembered')
			for (const agent of source.agents) await homeServices.skills?.()?.forget(agent, entry.name);
		await this.refresh();
	}

	async importFiles(input: readonly { path: string; bytes: ArrayBuffer }[]): Promise<void> {
		const skill = input.find((file) => file.path.split('/').length === 2 && file.path.endsWith('/SKILL.md'));
		if (!skill) throw new Error(t('home.p1.skillInvalid'));
		const markdown = new TextDecoder().decode(skill.bytes),
			raw = readYaml(readMarkdownDocument(markdown).yaml).get('name');
		const name = typeof raw === 'string' ? raw : skill.path.split('/')[0]!;
		if (!validSkillName(name)) throw new Error(t('home.p1.skillInvalid'));
		const base = skill.path.split('/')[0]!,
			files = contentFiles(this.app);
		const paths = input.map((file) => {
			const relative = file.path.split('/').slice(1);
			if (
				file.path.split('/')[0] !== base ||
				!relative.length ||
				relative.some((part) => !part || part === '.' || part === '..' || part.includes('\\'))
			)
				throw new Error(t('home.p1.skillInvalid'));
			return { path: contentPath(`NAND/技能/${name}/${relative.join('/')}`), bytes: file.bytes };
		});
		for (const file of paths) if (files.getFileByPath(file.path)) throw new Error(t('home.p1.skillExists'));
		for (const file of paths) await files.createBinary(file.path, file.bytes);
		await this.refresh();
	}

	async importMarkdown(markdown: string): Promise<void> {
		const name = readYaml(readMarkdownDocument(markdown).yaml).get('name');
		if (typeof name !== 'string' || !validSkillName(name)) throw new Error(t('home.p1.skillInvalid'));
		await contentFiles(this.app).create(contentPath(`NAND/技能/${name}/SKILL.md`), markdown);
		await this.refresh();
	}
}
