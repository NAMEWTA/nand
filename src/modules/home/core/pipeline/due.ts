import { isDefinition } from '../../../../shared/automation/metadata';
import type { AutomationDefinition } from '../../../../shared/automation/types';

/** Uses the existing note-level due/remind fields and local wall-clock dates. */
export function pipelineDue(value: unknown): { date: string; time: string; at: number } | undefined {
	if (typeof value !== 'string') return;
	const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec(value.trim());
	if (!match) return;
	const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]), hour = Number(match[4] ?? 0), minute = Number(match[5] ?? 0);
	const date = new Date(year, month - 1, day, hour, minute);
	if (year < 1000 || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute) return;
	return { date: `${match[1]}-${match[2]}-${match[3]}`, time: match[4] ? `${match[4]}:${match[5]}` : '', at: date.getTime() };
}

/** The scheduler owns execution. Saving a date creates only the existing definition shape. */
export function pipelineDueFields(frontmatter: Record<string, unknown>, value: string, remind: boolean, options: { id: string; title: string; deviceId: string; now: number }): Record<string, unknown> {
	const previous = frontmatter.nandAutomation;
	if (previous !== undefined && (!isDefinition(previous) || !previous.id.startsWith('pipeline:'))) throw new Error('home.pipeline.automationConflict');
	if (!value.trim()) return { due: undefined, remind: undefined, nandAutomation: undefined };
	const due = pipelineDue(value);
	if (!due) throw new Error('home.pipeline.invalidDue');
	const definition: AutomationDefinition | undefined = remind ? {
		id: previous?.id ?? `pipeline:${options.id}`, name: previous?.name ?? options.title, deviceId: options.deviceId,
		enabled: true, revision: options.now, schedule: { kind: 'once', at: due.at }, action: previous?.action ?? { kind: 'notify', body: options.title },
		channels: previous?.channels ?? ['in-app'], notifyOn: previous?.notifyOn ?? 'always', graceMinutes: previous?.graceMinutes ?? 720,
		createdAt: previous?.createdAt ?? options.now, updatedAt: options.now,
	} : undefined;
	return { due: due.date + (due.time ? ` ${due.time}` : ''), remind: remind || undefined, nandAutomation: definition };
}
