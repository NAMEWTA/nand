import { App,TFile } from 'obsidian';
import {
applyWereadProgressEntry,
needsProgressFetch
} from "../../../core/weread/weread-shelf-model";
import { WereadBookLike,WereadBookmarkLike,WereadNotebookLike } from "../../../core/weread/widget-model";
import {
type WereadProgressEntry,
type WereadProgressStore
} from "./weread-progress-store";
import { WereadClient } from "./weread-service";


export async function enrichProgress(
	client: WereadClient,
	store: WereadProgressStore,
	books: WereadBookLike[],
	force = false,
): Promise<WereadBookLike[]> {
	await store.load();
	const enriched: WereadBookLike[] = [];
	const fetched: Record<string, WereadProgressEntry> = {};
	const limit = 8;
	let rateLimited = false;
	for (let i = 0; i < books.length && !rateLimited; i += limit) {
		const batch = books.slice(i, i + limit);
		const next = await Promise.all(
			batch.map(async (book): Promise<WereadBookLike> => {
				if (!needsProgressFetch(book)) return book;
				if (!force) {
					const cached = store.freshEntry(book.bookId);
					if (cached) return applyWereadProgressEntry(book, cached);
				}
				try {
					const details = await client.fetchProgressDetails(book.bookId);
					const readingState =
						details.progress >= 100 || book.readingState === 'finished'
							? 'finished'
							: details.progress > 0
								? 'reading'
								: 'notStarted';
					fetched[book.bookId] = {
						progress: details.progress,
						readingState,
						readingTime: details.readingTime,
						lastReadTime: details.lastReadTime,
						ts: Date.now(),
					};
					return {
						...book,
						progress: details.progress,
						readingState,
						readingTime: details.readingTime ?? book.readingTime,
						lastReadTime: details.lastReadTime ?? book.lastReadTime,
					};
				} catch (err) {
					if (err instanceof Error && err.message === 'RATE_LIMITED') rateLimited = true;
					// A stale persisted entry still beats a blank shelf bar.
					const stale = store.entry(book.bookId);
					return stale ? applyWereadProgressEntry(book, stale) : book;
				}
			}),
		);
		enriched.push(...next);
		if (!rateLimited && i + limit < books.length) await sleepMs(200);
	}
	if (enriched.length < books.length) enriched.push(...books.slice(enriched.length).map(book => { const cached = store.entry(book.bookId); return cached ? applyWereadProgressEntry(book, cached) : book; }));
	store.put(fetched);
	return enriched;
}

export function sleepMs(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

export async function importHighlightsToObsidian(
	app: App,
	importPath: string,
	nb: WereadNotebookLike,
	marks: WereadBookmarkLike[],
): Promise<string> {
	const folder = importPath.trim().replace(/^\/+|\/+$/g, '');
	const safeTitle = sanitizeFileName(nb.title);
	const path = folder ? `${folder}/${safeTitle}.md` : `${safeTitle}.md`;

	if (folder) {
		await ensureFolder(app, folder);
	}

	const lines: string[] = [];
	lines.push('---');
	lines.push('source: weread');
	lines.push(`bookId: ${yamlScalar(nb.bookId)}`);
	lines.push(`title: ${yamlScalar(nb.title)}`);
	if (nb.author) lines.push(`author: ${yamlScalar(nb.author)}`);
	lines.push(`highlightCount: ${marks.length}`);
	lines.push('---');
	lines.push('');
	lines.push(`# ${nb.title}`);
	if (nb.author) {
		lines.push('');
		lines.push(`*${nb.author}*`);
	}
	lines.push('');
	marks.forEach((m, i) => {
		lines.push(`${i + 1}. ${m.markText}`);
		lines.push('');
	});
	const content = lines.join('\n');

	const existing = app.vault.getAbstractFileByPath(path);
	if (existing && existing instanceof TFile) {
		await app.vault.modify(existing, content);
	} else {
		await app.vault.create(path, content);
	}
	return path;
}

export function sanitizeFileName(name: string): string {
	return (
		(name || 'untitled')
			.replace(/[\\/:*?"<>|]/g, '_')
			.trim()
			.slice(0, 80) || 'untitled'
	);
}

export async function ensureFolder(app: App, folder: string): Promise<void> {
	const trimmed = folder.replace(/^\/+|\/+$/g, '');
	if (!trimmed) return;
	let current = '';
	for (const part of trimmed.split('/').filter(Boolean)) {
		current = current ? `${current}/${part}` : part;
		if (!app.vault.getAbstractFileByPath(current)) {
			try {
				await app.vault.createFolder(current);
			} catch {
				/* race or already exists */
			}
		}
	}
}

export function yamlScalar(v: string): string {
	return `"${String(v ?? '')
		.replace(/\\/g, '\\\\')
		.replace(/"/g, '\\"')}"`;
}