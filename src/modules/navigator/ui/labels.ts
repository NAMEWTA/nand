// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { getLanguage, t } from '../../../shared/i18n';
import type { DateBucket } from '../core/note-list';
import { ROOT_FOLDER, baseName, type NavContext } from '../core/types';

/** Locale for dates, following NAND's language rather than the system's. */
export function uiLocale(): string {
	return getLanguage() === 'zh' ? 'zh-CN' : 'en';
}

export function bucketLabel(bucket: DateBucket): string {
	switch (bucket.kind) {
		case 'today': return t('navigator.today');
		case 'yesterday': return t('navigator.yesterday');
		case 'week': return t('navigator.previous7');
		case 'month30': return t('navigator.previous30');
		case 'month': return new Date(bucket.year, bucket.month, 1).toLocaleDateString(uiLocale(), { month: 'long' });
		default: return String(bucket.year);
	}
}

export function folderLabel(path: string): string {
	return path === ROOT_FOLDER ? t('navigator.rootFolder') : baseName(path);
}

export function contextLabel(context: NavContext): string {
	if (context.kind === 'folder') return folderLabel(context.key);
	if (context.kind === 'tag') return `#${context.key}`;
	if (context.kind === 'property') return context.value === undefined ? context.key : `${context.key}: ${context.value}`;
	return t('navigator.untagged');
}
