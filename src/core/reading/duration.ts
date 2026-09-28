import { t } from '../../shared/i18n/index';

export function formatReadingDuration(totalSeconds: number): string {
	const hours = Math.floor(totalSeconds / 3600);
	const mins = Math.floor((totalSeconds % 3600) / 60);
	if (hours > 0 && mins > 0) return t('reading.timeHM', { h: hours, m: mins });
	if (hours > 0) return t('reading.hours', { count: hours });
	return t('reading.minutes', { count: Math.max(1, mins) });
}
