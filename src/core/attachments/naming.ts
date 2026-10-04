import { AttachmentError, type AttachmentName, type AttachmentNameWarning } from './model';

/** Leaves room for common filesystem component limits without changing the prefix. */
export const MAX_ATTACHMENT_NAME_BYTES = 240;
const ILLEGAL_NAME = /[<>:"/\\|?*]/;
const DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9]|conin\$|conout\$)(?:\.|$)/i;

export function utf8Length(value: string): number {
	let bytes = 0;
	for (const character of value) {
		const point = character.codePointAt(0) ?? 0;
		bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
	}
	return bytes;
}

function truncateUtf8(value: string, maximum: number): string {
	let result = '';
	let bytes = 0;
	for (const character of value) {
		const next = utf8Length(character);
		if (bytes + next > maximum) break;
		result += character;
		bytes += next;
	}
	return result.replace(/[.\s]+$/, '');
}

function replaceUnpairedSurrogates(value: string): string {
	let result = '';
	for (const character of value) {
		const point = character.codePointAt(0) ?? 0;
		result += point >= 0xd800 && point <= 0xdfff ? '_' : character;
	}
	return result;
}

function isControlPoint(point: number): boolean {
	return point < 32 || (point >= 127 && point <= 159);
}

export function containsAttachmentControl(value: string): boolean {
	return Array.from(value).some((character) => isControlPoint(character.codePointAt(0) ?? 0));
}

export function sanitizeAttachmentLabel(value: string): string {
	let result = '';
	let invalidRun = false;
	for (const character of replaceUnpairedSurrogates(value.normalize('NFC'))) {
		const invalid = isControlPoint(character.codePointAt(0) ?? 0) || ILLEGAL_NAME.test(character);
		if (invalid) {
			if (!invalidRun) result += '_';
		} else result += character;
		invalidRun = invalid;
	}
	return result.trim().replace(/[.\s]+$/, '');
}

/** A note-derived folder may itself be a reserved name; a timestamped file is not. */
export function noteFolderName(value: string): string {
	const name = sanitizeAttachmentLabel(value);
	if (!name) throw new AttachmentError('invalid-name', value);
	return DEVICE_NAME.test(name) ? `_${name}` : name;
}

export function isPortableDirectorySegment(value: string): boolean {
	return value.length > 0 && value !== '.' && value !== '..'
		&& !containsAttachmentControl(value) && !ILLEGAL_NAME.test(value)
		&& !/[.\s]$/.test(value)
		&& !DEVICE_NAME.test(value)
		&& utf8Length(value) <= 255
		&& replaceUnpairedSurrogates(value) === value;
}

/** Device-local, 24-hour time. There is deliberately no random or original-name suffix. */
export function attachmentTimestamp(nowMs: number): string {
	const date = new Date(nowMs);
	const year = date.getFullYear();
	if (!Number.isFinite(nowMs) || !Number.isFinite(date.getTime()) || year < 0 || year > 9999) {
		throw new AttachmentError('invalid-timestamp');
	}
	return [year.toString().padStart(4, '0'),
		(date.getMonth() + 1).toString().padStart(2, '0'),
		date.getDate().toString().padStart(2, '0'),
		date.getHours().toString().padStart(2, '0'),
		date.getMinutes().toString().padStart(2, '0'),
		date.getSeconds().toString().padStart(2, '0')].join('');
}

export function normalizeAttachmentExtension(value: string): string {
	const extension = value.startsWith('.') ? value.slice(1) : value;
	if (!extension) {
		if (value) throw new AttachmentError('invalid-extension', value);
		return '';
	}
	if (extension !== extension.trim() || containsAttachmentControl(extension) || extension.includes(' ') || ILLEGAL_NAME.test(extension)
		|| extension.split('.').some((part) => !part)
		|| replaceUnpairedSurrogates(extension) !== extension
		|| utf8Length(extension) > MAX_ATTACHMENT_NAME_BYTES - 15) {
		throw new AttachmentError('invalid-extension', value);
	}
	return extension.toLowerCase();
}

export function attachmentName(timestamp: string, extension: string, customName = '', sequence = 0): AttachmentName {
	if (!/^\d{14}$/.test(timestamp)) throw new AttachmentError('invalid-timestamp', timestamp);
	if (!Number.isSafeInteger(sequence) || sequence < 0) throw new AttachmentError('invalid-sequence');
	const normalizedExtension = normalizeAttachmentExtension(extension);
	const ending = normalizedExtension ? `.${normalizedExtension}` : '';
	const suffix = sequence === 0 ? '' : `-${sequence.toString().padStart(3, '0')}`;
	const warnings: AttachmentNameWarning[] = [];
	let label = customName.trim();
	if (ending && label.toLowerCase().endsWith(ending)) {
		label = label.slice(0, -ending.length);
		warnings.push('duplicate-extension-removed');
	}
	const sanitized = sanitizeAttachmentLabel(label);
	if (sanitized !== label || customName !== customName.trim()) warnings.push('name-sanitized');
	label = sanitized;
	const remaining = MAX_ATTACHMENT_NAME_BYTES - utf8Length(timestamp + suffix + ending);
	if (remaining < 0) throw new AttachmentError('invalid-name');
	const budget = Math.max(0, remaining - 1);
	if (utf8Length(label) > budget) {
		label = truncateUtf8(label, budget);
		warnings.push('name-truncated');
	}
	return { filename: `${timestamp}${label ? `-${label}` : ''}${suffix}${ending}`, warnings };
}
