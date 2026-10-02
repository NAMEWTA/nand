import { t } from '../../../shared/i18n';

export function formatRelativeTime(timestamp: number): string {
	const diff = Date.now() - timestamp;
	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) return t('recent.daysAgo', { count: days });
	if (hours > 0) return t('recent.hoursAgo', { count: hours });
	if (minutes > 0) return t('recent.minutesAgo', { count: minutes });
	return t('recent.justNow');
}
