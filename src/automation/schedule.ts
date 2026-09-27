import type { ScheduleSpec } from '../shared/automation/types';
import { isValidAutomationSchedule } from './schedule/automation-schedule-parsing';
import {
	latestAutomationOccurrenceAtOrBefore,
	nextAutomationOccurrenceAfter,
} from './schedule/automation-schedule-occurrences';

export function validateSchedule(schedule: ScheduleSpec): void {
	if (schedule.kind === 'manual') return;
	if (schedule.kind === 'once') {
		if (!Number.isFinite(schedule.at)) throw new Error('Invalid date');
		return;
	}
	if (schedule.kind !== 'recurring' || !Number.isFinite(schedule.start)) throw new Error('Invalid schedule');
	if (!isValidAutomationSchedule(schedule.expression)) throw new Error('Invalid recurrence');
}
export function latestOccurrence(schedule: ScheduleSpec, now: number): number | null {
	validateSchedule(schedule);
	if (schedule.kind === 'manual') return null;
	if (schedule.kind === 'once') return schedule.at <= now ? schedule.at : null;
	return latestAutomationOccurrenceAtOrBefore(schedule.expression, schedule.start, now);
}
export function nextOccurrence(schedule: ScheduleSpec, now: number): number | null {
	validateSchedule(schedule);
	if (schedule.kind === 'manual') return null;
	if (schedule.kind === 'once') return schedule.at > now ? schedule.at : null;
	return nextAutomationOccurrenceAfter(schedule.expression, schedule.start, now);
}
