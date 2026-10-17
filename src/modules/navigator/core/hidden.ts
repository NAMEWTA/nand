// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { baseName, propertyEntries, ROOT_FOLDER, type NoteEntry } from './types';

/** What the user asked to hide. Hiding never removes anything from the index; it only filters what is shown. */
export interface HiddenRules {
	/** `/path/to/folder` (from the vault root) or a folder name; `*` matches any text. */
	folders: readonly string[];
	/** A tag such as `draft` (also hides `draft/...`); `*` matches any text. */
	tags: readonly string[];
	/** A file name such as `*.excalidraw.md`, or a path such as `/Templates/Daily.md`. */
	files: readonly string[];
	/** `key` or `key=value`: notes carrying that frontmatter property are hidden. */
	properties: readonly string[];
}

export interface HiddenMatcher {
	/** No rule is set, so nothing is hidden. */
	readonly empty: boolean;
	folder: (path: string) => boolean;
	note: (note: NoteEntry) => boolean;
}

const NONE: HiddenMatcher = { empty: true, folder: () => false, note: () => false };

function glob(pattern: string): RegExp {
	const source = pattern.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
	return new RegExp(`^${source}$`, 'i');
}

const clean = (rules: readonly string[]): string[] => rules.map((rule) => rule.trim()).filter(Boolean);

/** Compile rules once; the matcher memoizes folder results because every note asks about its folder. */
export function compileHidden(rules: HiddenRules): HiddenMatcher {
	const folderRules = clean(rules.folders).map((rule) => {
		const trimmed = rule.replace(/\/+$/, '');
		const rooted = trimmed.startsWith('/');
		const path = trimmed.replace(/^\/+/, '');
		return { byName: !rooted && !path.includes('/'), pattern: glob(path) };
	});
	const tagRules = clean(rules.tags).map((rule) => glob(rule.replace(/^#/, '')));
	const fileRules = clean(rules.files).map((rule) => ({ byName: !rule.includes('/'), pattern: glob(rule.replace(/^\/+/, '')) }));
	const propertyRules = clean(rules.properties).map((rule) => {
		const eq = rule.indexOf('=');
		return eq < 0 ? { key: rule.toLowerCase(), value: null } : { key: rule.slice(0, eq).trim().toLowerCase(), value: glob(rule.slice(eq + 1).trim()) };
	}).filter((rule) => rule.key);
	if (!folderRules.length && !tagRules.length && !fileRules.length && !propertyRules.length) return NONE;

	const folderMemo = new Map<string, boolean>();
	const folder = (path: string): boolean => {
		if (path === ROOT_FOLDER || !folderRules.length) return false;
		const known = folderMemo.get(path);
		if (known !== undefined) return known;
		const parent = path.lastIndexOf('/');
		let hidden = parent > 0 && folder(path.slice(0, parent));
		if (!hidden) hidden = folderRules.some((rule) => rule.pattern.test(rule.byName ? baseName(path) : path));
		folderMemo.set(path, hidden);
		return hidden;
	};
	const tagHidden = (tag: string): boolean => {
		const parts = tag.split('/');
		for (let end = 1; end <= parts.length; end++) {
			const prefix = parts.slice(0, end).join('/');
			if (tagRules.some((rule) => rule.test(prefix))) return true;
		}
		return false;
	};
	return {
		empty: false,
		folder,
		note(note) {
			if (folder(note.folder)) return true;
			if (fileRules.some((rule) => rule.pattern.test(rule.byName ? baseName(note.path) : note.path))) return true;
			if (tagRules.length && note.tags.some(tagHidden)) return true;
			for (const rule of propertyRules) {
				const lists = propertyEntries(note, rule.key);
				if (lists.length && (rule.value === null || lists.some((list) => list.some((value) => rule.value.test(value))))) return true;
			}
			return false;
		},
	};
}
