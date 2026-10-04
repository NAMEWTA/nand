import { AttachmentError, DEFAULT_ATTACHMENT_PATH_POLICY, type AttachmentPathPolicy, type ResolvedAttachmentDirectory } from './model';
import { containsAttachmentControl, isPortableDirectorySegment, noteFolderName } from './naming';

const PROTECTED_ROOTS = new Set(['.nand', '.obsidian', '.trash', '.git']);

function relativeSegments(path: string, initial: readonly string[] = []): string[] {
	if (/^(?:[\\/]|[a-zA-Z]:)/.test(path) || containsAttachmentControl(path)) {
		throw new AttachmentError('invalid-path', path);
	}
	const result = [...initial];
	for (const segment of path.replace(/\\/g, '/').split('/')) {
		if (!segment || segment === '.') continue;
		if (segment === '..') {
			if (result.length === 0) throw new AttachmentError('path-outside-vault', path);
			result.pop();
		} else result.push(segment);
	}
	return result;
}

/** Normalizes Vault syntax without URL-decoding existing file names. */
export function normalizeAttachmentVaultPath(path: string): string {
	const segments = relativeSegments(path);
	if (segments.length === 0) throw new AttachmentError('invalid-path', path);
	return segments.join('/');
}

function ownRule(rules: Readonly<Record<string, string>>, key: string): string | undefined {
	return Object.prototype.hasOwnProperty.call(rules, key) ? rules[key] : undefined;
}

export function resolveAttachmentDirectory(
	notePath: string,
	policy: AttachmentPathPolicy = DEFAULT_ATTACHMENT_PATH_POLICY,
	itemTemplate?: string,
): ResolvedAttachmentDirectory {
	const canonical = normalizeAttachmentVaultPath(notePath);
	const components = canonical.split('/');
	const filename = components.pop();
	if (!filename || !/\.md$/i.test(filename)) throw new AttachmentError('invalid-note', notePath);
	let template = itemTemplate;
	let source: ResolvedAttachmentDirectory['source'] = 'item';
	let matchedPath: string | null = null;
	if (template === undefined) {
		template = ownRule(policy.noteOverrides, canonical);
		source = 'note';
		if (template !== undefined) matchedPath = canonical;
	}
	if (template === undefined) {
		const ancestors = [...components];
		for (;;) {
			const ancestor = ancestors.join('/');
			template = ownRule(policy.folderOverrides, ancestor);
			if (template !== undefined) {
				source = 'folder';
				matchedPath = ancestor;
				break;
			}
			if (ancestors.length === 0) break;
			ancestors.pop();
		}
	}
	if (template === undefined) {
		template = policy.defaultTemplate;
		source = 'default';
	}
	if (!template.trim()) throw new AttachmentError('invalid-template', template);
	if (/[{}]/.test(template.replace(/\{note\}/g, ''))) throw new AttachmentError('invalid-template', template);
	const expanded = template.replace(/\{note\}/g, () => noteFolderName(filename.slice(0, -3)));
	const resolved = relativeSegments(expanded, components);
	if (resolved.some((segment) => !isPortableDirectorySegment(segment))) {
		throw new AttachmentError('invalid-path', expanded);
	}
	const first = resolved[0];
	if (first && PROTECTED_ROOTS.has(first.toLowerCase())) {
		throw new AttachmentError('protected-path', resolved.join('/'));
	}
	return { directory: resolved.join('/'), template, source, matchedPath };
}

/** Resolves from the note's parent, never from whichever document is currently active. */
export function relativeAttachmentPath(notePath: string, attachmentPath: string): string {
	const from = normalizeAttachmentVaultPath(notePath).split('/');
	from.pop();
	const to = normalizeAttachmentVaultPath(attachmentPath).split('/');
	let shared = 0;
	while (shared < from.length && shared < to.length && from[shared] === to[shared]) shared++;
	return [...Array<string>(from.length - shared).fill('..'), ...to.slice(shared)].join('/');
}
