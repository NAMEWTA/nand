import type { NewsAnalysis, NewsBrief, NewsEdition, NewsMaterial, NewsSource } from '../core/model';
import type { NewsNotePort } from '../platform/note-port';
import { briefPath, editionPath, favoriteMaterial, favoritePath, parseMaterialNote, readBriefNote, readEditionId, refreshBriefNote, refreshEditionNote, refreshFavoriteNote, serializeBrief, serializeEdition, serializeMaterial } from '../platform/notes';
import { favoriteFolder, editionFolder, type NewsNoteFolders } from '../core/note-folders';

export class NewsNotebook {
	private entries = new Map<string, { path: string; material: NewsMaterial }>();
	private briefs = new Map<string, NewsBrief>();
	private editions = new Map<string, string>();
	private errors: string[] = [];
	private dirty = true;
	private disposed = false;
	private tail: Promise<void> = Promise.resolve();
	private readonly unsubscribe: () => void;
	readonly ready: Promise<void>;
	constructor(private readonly port: NewsNotePort, private readonly changed: () => void, private readonly folders: () => NewsNoteFolders = () => ({})) {
		this.unsubscribe = port.subscribe(() => {
			this.dirty = true;
			void this.enqueue(async () => { await this.scan(); this.changed(); }).catch(() => undefined);
		});
		this.ready = this.enqueue(() => this.scan());
	}
	private enqueue(work: () => Promise<void>): Promise<void> {
		const task = this.tail.then(async () => {
			if (this.disposed) throw new Error('news.stopped');
			await work();
		});
		this.tail = task.catch(() => undefined);
		return task;
	}
	private async scan(): Promise<void> {
		if (!this.dirty) return;
		this.dirty = false;
		const entries = new Map<string, { path: string; material: NewsMaterial }>();
		const briefs = new Map<string, NewsBrief>();
		const editions = new Map<string, string>();
		const errors: string[] = [];
		for (const path of this.port.paths()) {
			try {
				const text = await this.port.read(path), brief = readBriefNote(text);
				const editionId = readEditionId(text);
				if (editionId) { if (editions.has(editionId)) errors.push(path); else editions.set(editionId, path); continue; }
				if (brief) {
					if (briefs.has(brief.id)) errors.push(path);
					else briefs.set(brief.id, { ...brief, path });
					continue;
				}
				const material = favoriteMaterial(text);
				if (!material) continue;
				if (entries.has(material.id)) { errors.push(path); continue; }
				entries.set(material.id, { path, material });
			} catch { errors.push(path); }
		}
		this.entries = entries;
		this.briefs = briefs;
		this.editions = editions;
		this.errors = errors;
	}
	list(): readonly NewsMaterial[] { return [...this.entries.values()].map(entry => entry.material); }
	issues(): readonly string[] { return this.errors; }
	has(id: string): boolean { return this.entries.has(id); }
	path(id: string): string | undefined { return this.entries.get(id)?.path; }
	brief(ids: readonly string[]): NewsBrief | undefined { return ids.flatMap(id => this.briefs.get(id) ?? [])[0]; }
	async notes(id: string): Promise<string> {
		await this.ready;
		const path = this.path(id);
		return path ? parseMaterialNote(await this.port.read(path)).notes : '';
	}
	async save(material: NewsMaterial, annotation: string, analysis?: NewsAnalysis, event?: string): Promise<void> {
		await this.enqueue(async () => {
			// Resolve identity again, so a manual rename never creates a second favorite.
			this.dirty = true;
			await this.scan();
			let path = this.path(material.id) ?? favoritePath(material, favoriteFolder(this.folders()));
			if (!this.has(material.id) && this.port.paths().includes(path)) path = path.slice(0, -3) + `-${encodeURIComponent(material.id)}.md`;
			const text = await this.port.process(path, current => {
				if (current === null) return serializeMaterial(material, annotation, analysis, event);
				const updated = refreshFavoriteNote(current, material, analysis, event);
				const notes = annotation.trim();
				return notes && !parseMaterialNote(current).notes.includes(notes) ? `${updated.trimEnd()}\n\n${notes}\n` : updated;
			});
			this.entries.set(material.id, { path, material: favoriteMaterial(text)! });
			this.changed();
		});
	}
	async saveBrief(id: string, title: string, body: string, aliases: readonly string[] = []): Promise<string> {
		let path = briefPath(id);
		await this.enqueue(async () => {
			this.dirty = true;
			await this.scan();
			const existing = this.brief([id, ...aliases]);
			path = existing?.path ?? path;
			const noteId = existing?.id ?? id;
			const text = await this.port.process(path, current => current === null ? serializeBrief(noteId, title, body) : refreshBriefNote(current, noteId, title, body));
			this.briefs.set(noteId, { ...readBriefNote(text)!, path });
			this.changed();
		});
		return path;
	}
	async saveEdition(edition: NewsEdition, materials: readonly NewsMaterial[], analyses: readonly NewsAnalysis[], sources: readonly NewsSource[]): Promise<void> {
		await this.enqueue(async () => {
			this.dirty = true;
			await this.scan();
			const path = this.editions.get(edition.id) ?? editionPath(edition, editionFolder(this.folders()));
			await this.port.process(path, current => current === null ? serializeEdition(edition, materials, analyses, sources) : refreshEditionNote(current, edition, materials, analyses, sources));
			this.editions.set(edition.id, path);
		});
	}
	async dispose(): Promise<void> {
		this.disposed = true;
		this.unsubscribe();
		await this.tail;
	}
}
