import type { AutomationDefinition, AutomationRun, ScheduleSpec } from '../../../shared/automation/types';
import { getLanguage, t } from '../../../shared/i18n';
import { nextOccurrence } from '../core/schedule';
export function scheduleLabel(schedule: ScheduleSpec): string {
	if (schedule.kind === 'manual') return t('automation.manual');
	if (schedule.kind === 'once')
		return `${t('automation.once')}: ${new Date(schedule.at).toLocaleString(getLanguage())}`;
	const [minute, hour, day, month, weekday] = schedule.expression.split(/\s+/);
	if (/^\d+$/.test(minute ?? '') && day === '*' && month === '*') {
		if (hour === '*' && weekday === '*') return `${t('automation.hourly')} · ${minute}`;
		if (/^\d+$/.test(hour ?? '')) {
			const time = `${hour!.padStart(2, '0')}:${minute!.padStart(2, '0')}`;
			if (weekday === '*') return `${t('automation.daily')} ${time}`;
			if (weekday === '1-5') return `${t('automation.weekdays')} ${time}`;
			if (/^[0-6]$/.test(weekday ?? ''))
				return `${new Date(Date.UTC(2026, 0, 4 + Number(weekday))).toLocaleDateString(getLanguage(), { weekday: 'long', timeZone: 'UTC' })} ${time}`;
		}
	}
	return schedule.expression;
}
export function nextRun(definition: AutomationDefinition): number | null {
	if (!definition.enabled) return null;
	try {
		return nextOccurrence(definition.schedule, Date.now());
	} catch {
		return null;
	}
}
export function tokenLabel(run?: AutomationRun): string {
	if (!run?.usage?.known) return '—';
	return new Intl.NumberFormat(getLanguage(), { notation: 'compact', maximumFractionDigits: 1 }).format(
		run.usage.input + run.usage.output + run.usage.cacheRead + run.usage.cacheWrite,
	);
}
export function durationLabel(run: AutomationRun): string {
	if (!run.endedAt) return '—';
	const seconds = Math.max(0, Math.round((run.endedAt - run.startedAt) / 1000));
	return seconds < 60
		? t('automation.seconds', { count: seconds })
		: t('automation.minutes', { count: Math.round(seconds / 60) });
}
