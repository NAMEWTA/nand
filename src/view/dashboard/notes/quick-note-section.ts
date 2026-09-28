import { App, Notice, TFile } from 'obsidian';
import { h } from 'preact';
import type { DashboardSettings, PinnedNote, QuickNotePreset } from '../../../core/dashboard/types/index';
import {
	ensureFolder,
	getOrCreateDailyNote,
	substituteTemplateVars,
} from '../../../platform/obsidian/calendar/daily-notes';
import { MomentLike, nowMoment } from '../../../platform/obsidian/datetime';
import { t } from '../../../shared/i18n/index';
import type { RenderCallbacks } from '../render-contract';
import { mountDashboardPanel } from '../renderer/render-context';
import { showPromptDialog } from '../ui/prompt-dialog';
import { QuickNotesPanel } from './QuickNotesPanel';

export function renderQuickNoteRegion(
	container: HTMLElement,
	settings: DashboardSettings,
	callbacks: RenderCallbacks,
): void {
	const root = container.createDiv({ cls: 'dashboard-quicknote' });
	mountDashboardPanel(root, h(QuickNotesPanel, { settings, callbacks, root }));
}

// ── Behaviors (called from view.ts callbacks) ──────────────────────────────

/** Create a note from a preset: resolve template + vars + folder, then open. */
export async function createNoteFromPreset(app: App, preset: QuickNotePreset): Promise<void> {
	const filenamePattern = preset.filename?.trim() || '{{date:YYYY-MM-DD}}';
	let title = '';
	if (filenamePattern.includes('{{title}}')) {
		const input = await showPromptDialog(app, {
			title: t('quickNote.titlePrompt'),
			placeholder: t('quickNote.titlePlaceholder'),
		});
		if (input == null) return; // cancelled
		title = input.trim();
		if (!title) return;
	}

	const now = nowMoment();
	let filename = sanitizeFilename(substituteTemplateVars(filenamePattern, { title, now }));
	if (!filename) filename = now.format('YYYY-MM-DD');

	const folder = (preset.folder || '').trim().replace(/^\/+|\/+$/g, '');
	if (folder) await ensureFolder(app, folder);
	const ext = filename.toLowerCase().endsWith('.md') ? '' : '.md';
	let path = folder ? `${folder}/${filename}${ext}` : `${filename}${ext}`;
	path = await uniquePath(app, path);

	let content = '';
	const tplPath = (preset.templatePath || '').trim();
	if (tplPath) {
		const tpl = await readTemplateContent(app, tplPath, { title, now });
		if (!tpl.found) {
			new Notice(t('quickNote.templateNotFound'));
		}
		content = tpl.content;
	}

	const file = await app.vault.create(path, content);
	await app.workspace.getLeaf('tab').openFile(file);
	new Notice(t('quickNote.created', { name: file.basename }));
}

/** Capture a fleeting thought: insert into the target note — top (after any
 *  frontmatter) or bottom, per quickCapturePosition — or create a new note.
 *  New notes place the line the same way against their template content. */
export async function captureThought(app: App, settings: DashboardSettings, text: string): Promise<void> {
	const now = nowMoment();
	// Wiki-link date (jumps to the daily note + shows up in its backlinks) plus
	// time-of-day; the plain date text is also globally searchable for filtering.
	const line = `- ${text} *([[${now.format('YYYY-MM-DD')}]] ${now.format('HH:mm')})*`;
	const target = (settings.quickCaptureTarget || '').trim();

	if (target) {
		const file = await getOrCreateNote(app, target);
		if (file) {
			const raw = await app.vault.read(file);
			await app.vault.modify(file, placeCaptureLine(raw, line, settings.quickCapturePosition));
			new Notice(t('quickNote.captured'));
			return;
		}
	}

	const folder = (settings.quickCaptureFolder || '').trim().replace(/^\/+|\/+$/g, '');
	if (folder) await ensureFolder(app, folder);
	const filename = now.format('YYYY-MM-DD-HHmm');
	let path = folder ? `${folder}/${filename}.md` : `${filename}.md`;
	path = await uniquePath(app, path);
	// Seed new notes with the configured template (if any), then place the
	// captured line top/bottom of it exactly as for an existing target note.
	const { content: tplContent } = await readTemplateContent(app, settings.quickCaptureTemplate, { now });
	await app.vault.create(path, placeCaptureLine(tplContent, line, settings.quickCapturePosition));
	new Notice(t('quickNote.captured'));
}

/** Open a pinned note in a new tab. */
export function openPinnedNote(app: App, note: PinnedNote): void {
	const file = resolveFile(app, note.path);
	if (file) {
		void app.workspace.getLeaf('tab').openFile(file);
	} else {
		new Notice(t('quickNote.notFound'));
	}
}

/** Create (seeded with the core Daily Notes template) / open today's daily note,
 *  in the folder + format the core "Daily notes" plugin is configured for. A
 *  stale blank note (e.g. from earlier, before the template was wired up) is
 *  auto-seeded with the template. Shows a hint when the core plugin is disabled. */
export async function openTodayNote(app: App): Promise<void> {
	const iso = nowMoment().format('YYYY-MM-DD');
	const file = await getOrCreateDailyNote(app, iso);
	if (!file) {
		new Notice(t('quickNote.dailyDisabled'));
		return;
	}
	await app.workspace.getLeaf('tab').openFile(file);
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Resolve a vault file path, trying `.md` append if needed. */
function resolveFile(app: App, path: string): TFile | null {
	const p = path.trim();
	let f = app.vault.getAbstractFileByPath(p);
	if (f instanceof TFile) return f;
	if (!p.toLowerCase().endsWith('.md')) {
		f = app.vault.getAbstractFileByPath(`${p}.md`);
		if (f instanceof TFile) return f;
	}
	return null;
}

/** Read a template file (vault path, `.md` fallback) and substitute
 *  {{date}}/{{time}}/{{title}} vars. An empty path returns { '', true }
 *  (no template configured — not an error); a missing or unreadable file
 *  returns { '', false } so callers can warn the user. */
export async function readTemplateContent(
	app: App,
	tplPath: string,
	opts: { title?: string; now?: MomentLike },
): Promise<{ content: string; found: boolean }> {
	const p = (tplPath || '').trim();
	if (!p) return { content: '', found: true };
	const tpl = resolveFile(app, p);
	if (!tpl) return { content: '', found: false };
	try {
		const raw = await app.vault.read(tpl);
		return { content: substituteTemplateVars(raw, opts), found: true };
	} catch {
		return { content: '', found: false };
	}
}

/** Strip characters that are illegal in filenames across OSes. */
export function sanitizeFilename(name: string): string {
	return name
		.replace(/[\\/:*?"<>|]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Return a non-conflicting vault path, appending `-2`, `-3`, … as needed. */
export async function uniquePath(app: App, path: string): Promise<string> {
	if (!(await app.vault.adapter.exists(path))) return path;
	const dot = path.lastIndexOf('.');
	const hasExt = dot > path.lastIndexOf('/');
	const base = hasExt ? path.slice(0, dot) : path;
	const ext = hasExt ? path.slice(dot) : '';
	for (let i = 2; i < 1000; i++) {
		const candidate = `${base}-${i}${ext}`;
		if (!(await app.vault.adapter.exists(candidate))) return candidate;
	}
	return `${base}-${Date.now()}${ext}`;
}

/** Place a captured line into `raw` — at the top (after any YAML frontmatter)
 *  or at the bottom — per the configured capture position. */
function placeCaptureLine(raw: string, line: string, position: 'start' | 'end'): string {
	if (position === 'start') {
		const { fm, body } = splitFrontmatter(raw);
		// Keep the body's own leading blank line when present; otherwise add one
		// so the line never glues onto the first paragraph (a bare "- x\ntext"
		// would render "text" as a lazy continuation of the list item).
		const sep = body === '' || body.startsWith('\n') ? '' : '\n';
		return `${fm}${line}\n${sep}${body}`;
	}
	const sep = raw === '' || raw.endsWith('\n') ? '' : '\n';
	return `${raw}${sep}${line}\n`;
}

/** Split a leading YAML frontmatter block (a closed `---` fence at line 1)
 *  from the note body. Returns { fm: '', body: raw } when there is none. */
export function splitFrontmatter(raw: string): { fm: string; body: string } {
	if (!raw.startsWith('---')) return { fm: '', body: raw };
	const lines = raw.split('\n');
	for (let i = 1; i < lines.length; i++) {
		if (lines[i]!.trim() === '---') {
			return { fm: `${lines.slice(0, i + 1).join('\n')}\n`, body: lines.slice(i + 1).join('\n') };
		}
	}
	return { fm: '', body: raw };
}

/** Get an existing note (resolving a `.md` suffix if the path omits it), or
 *  create it (empty, as a proper `.md` note) so capture can append to it. */
async function getOrCreateNote(app: App, path: string): Promise<TFile | null> {
	const existing = resolveFile(app, path);
	if (existing) return existing;
	const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
	if (folder) await ensureFolder(app, folder);
	const ext = path.toLowerCase().endsWith('.md') ? '' : '.md';
	try {
		return await app.vault.create(`${path}${ext}`, '');
	} catch {
		return null;
	}
}
