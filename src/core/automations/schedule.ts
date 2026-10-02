import { AutomationError } from '../../shared/automation/errors';
import type { ScheduleSpec } from '../../shared/automation/types';
import {
	latestAutomationOccurrenceAtOrBefore,
	nextAutomationOccurrenceAfter,
} from './schedule/automation-schedule-occurrences';
import { isValidAutomationSchedule } from './schedule/automation-schedule-parsing';
import { zonedOccurrence } from './schedule/zoned-occurrences';

export function validateSchedule(schedule: ScheduleSpec): void {
	if (schedule.kind === 'manual') return;
	if (schedule.kind === 'once') {
		if (!Number.isFinite(schedule.at)) throw new AutomationError('invalidDate');
		return;
	}
	if (schedule.kind !== 'recurring' || !Number.isFinite(schedule.start)) throw new AutomationError('invalidSchedule');
	if (!isValidAutomationSchedule(schedule.expression)) throw new AutomationError('invalidRecurrence');
	if (schedule.timezone) new Intl.DateTimeFormat('en', { timeZone: schedule.timezone }).format();
}
export function latestOccurrence(schedule: ScheduleSpec, now: number): number | null {
	validateSchedule(schedule);
	if (schedule.kind === 'manual') return null;
	if (schedule.kind === 'once') return schedule.at <= now ? schedule.at : null;
	if (schedule.timezone) return now < schedule.start ? null : zonedOccurrence(schedule.expression, schedule.start, now, schedule.timezone, -1);
	return latestAutomationOccurrenceAtOrBefore(schedule.expression, schedule.start, now);
}
export function nextOccurrence(schedule: ScheduleSpec, now: number): number | null {
	validateSchedule(schedule);
	if (schedule.kind === 'manual') return null;
	if (schedule.kind === 'once') return schedule.at > now ? schedule.at : null;
	if (schedule.timezone) return zonedOccurrence(schedule.expression, schedule.start, now, schedule.timezone, 1);
	return nextAutomationOccurrenceAfter(schedule.expression, schedule.start, now);
}
