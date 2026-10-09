import { App, Platform } from 'obsidian';
import type { DashboardColumn } from '../../core/board/types/index';
import { attachNoteHover } from '../ui/hover-preview';
import { getRenderContext, resolveNoteFile } from './render-context';

export function getSectionType(column: DashboardColumn): string {
	if (column.sectionType) return column.sectionType;
	const lower = column.name.toLowerCase();
	if (lower === 'memo') return 'memo';
	if (lower === 'todo') return 'todo';
	if (lower === 'sticky') return 'sticky';
	if (lower === 'projects') return 'projects';
	if (lower === 'notes') return 'notes';
	if (lower === 'dashboard') return 'dashboard';
	if (lower === 'library') return 'library';
	if (lower === 'folder') return 'folder';
	if (lower === 'images') return 'images';
	if (lower === 'videos') return 'videos';
	if (lower === 'alltasks') return 'alltasks';
	if (lower === 'calendar') return 'calendar';
	if (lower === 'dataview') return 'dataview';
	if (lower === 'weread') return 'weread';
	if (lower === 'web') return 'web';
	if (column.cards.length > 0) {
		const types = new Set(column.cards.map((c) => c.type));
		const dashboardTypes = new Set(['chart', 'weather', 'tracker']);
		if ([...types].every((t) => dashboardTypes.has(t)) && types.size > 0) return 'dashboard';
		if (types.has('task') && types.size === 1) return 'todo';
		if (types.has('task') && !types.has('project')) return 'todo';
		if (types.has('project') && types.size === 1) return 'projects';
		if (types.has('generic') && !types.has('project') && !types.has('task')) return 'memo';
	}
	return 'projects';
}
export function renderTextWithLinks(container: HTMLElement, text: string, app: App): void {
	const parts = text.split(/(\[\[[^\]]+?\]\]|\[[^\]]+\]\([^)]+\))/g);
	for (const part of parts) {
		const wikiMatch = part.match(/^\[\[([^\]]+)\]\]$/);
		if (wikiMatch) {
			renderWikilink(container, wikiMatch[1]!, app);
			continue;
		}
		const extMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
		if (extMatch) {
			renderExternalLink(container, extMatch[1]!, extMatch[2]!);
			continue;
		}
		if (part) {
			container.appendText(part);
		}
	}
}
function renderWikilink(container: HTMLElement, content: string, app: App): void {
	const context = getRenderContext(container);
	let alias: string | undefined;
	let linkPart = content;

	const pipeIdx = content.indexOf('|');
	if (pipeIdx !== -1) {
		alias = content.slice(pipeIdx + 1);
		linkPart = content.slice(0, pipeIdx);
	}

	let path = linkPart;
	let fragment: string | undefined;

	const hashIdx = linkPart.indexOf('#');
	if (hashIdx !== -1) {
		path = linkPart.slice(0, hashIdx);
		fragment = linkPart.slice(hashIdx + 1);
	}

	const noteName = path.split('/').pop()?.replace(/\.md$/, '') ?? path;
	let displayName: string;
	if (alias) {
		displayName = alias;
	} else if (fragment) {
		displayName = `${noteName} > ${fragment}`;
	} else {
		displayName = noteName;
	}

	const link = container.createSpan({
		cls: 'dashboard-wikilink',
		text: displayName,
	});

	const file = resolveNoteFile(app, path);

	if (file && !Platform.isMobile && context.hoverParent) {
		attachNoteHover(app, link, file, context.hoverParent, fragment ? `#${fragment}` : undefined);
	}

	link.addEventListener('click', (e) => {
		e.stopPropagation();
		if (!file) return;
		context.noteOpener?.(file, fragment ? `#${fragment}` : undefined);
	});
}
function renderExternalLink(container: HTMLElement, text: string, url: string): void {
	const link = container.createSpan({
		cls: 'dashboard-external-link',
		text: text,
	});
	link.addEventListener('click', (e) => {
		e.stopPropagation();
		window.open(url, '_blank');
	});
}
export function isReminderOverdue(reminder: string): boolean {
	const now = new Date();
	const parts = reminder.trim().split(/\s+/);
	if (parts.length < 2) return false;
	const dateStr = parts[0]!;
	const timeStr = parts[1]!;
	const [year, month, day] = dateStr.split('-').map(Number);
	const [hour, min] = timeStr.split(':').map(Number);
	if (!year || !month || !day) return false;
	const due = new Date(year, month - 1, day, hour ?? 0, min ?? 0);
	return now >= due;
}
