import { describe, expect, it } from 'vitest';
import { automationDocuments } from './documents';
import { systemTimeZone } from './schedule';

describe('automation documents', () => {
	it('write recurring schedules without a time zone in the device time zone', () => {
		const [document] = automationDocuments.encode({
			definitions: [
				{
					id: 'auto-0000-0000-daily',
					name: 'Daily',
					enabled: true,
					deviceId: 'device',
					revision: 1,
					schedule: { kind: 'recurring', expression: '0 9 * * *', start: Date.UTC(2026, 9, 1) },
					action: { kind: 'notify', body: 'Hello' },
					channels: ['in-app'],
					notifyOn: 'always',
					graceMinutes: 0,
					createdAt: 0,
					updatedAt: 0,
				},
			],
		});
		expect(document?.properties.timezone).toBe(systemTimeZone());
		expect(systemTimeZone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
	});
});

it('round-trips precheck, extra arguments and template provenance without changing old definitions', () => {
	const d = {
		id: 'agent',
		name: 'Review',
		enabled: true,
		deviceId: 'device',
		revision: 1,
		schedule: { kind: 'manual' as const },
		action: {
			kind: 'agent' as const,
			agentId: 'claude-code',
			prompt: 'Review',
			cwd: '/vault',
			sessionMode: 'fresh' as const,
			extraArgs: '--model opus',
		},
		precheck: { command: 'exit 0', shell: 'bash' as const },
		templateId: 'daily-notes',
		channels: ['in-app' as const],
		notifyOn: 'always' as const,
		graceMinutes: 720,
		createdAt: 0,
		updatedAt: 0,
	};
	expect(automationDocuments.decode(automationDocuments.encode({ definitions: [d] })).definitions).toEqual([d]);
	const old = structuredClone(d);
	delete (old as Partial<typeof d>).precheck;
	delete (old as Partial<typeof d>).templateId;
	delete (old.action as Partial<typeof old.action>).extraArgs;
	expect(automationDocuments.decode(automationDocuments.encode({ definitions: [old] })).definitions).toEqual([old]);
});
it('removed browser workflow is a read-only tombstone and keeps its original document byte model', () => {
	const document = {
		id: 'removed',
		path: '.nand/content/NAND/自动化/Removed/操作.md',
		properties: {
			'nand-type': 'automation',
			'nand-id': 'removed',
			name: 'Removed',
			enabled: true,
			deviceId: 'device',
			revision: 1,
			graceMinutes: 720,
			channels: ['in-app'],
			notifyOn: 'always',
			createdAt: 0,
			updatedAt: 0,
			action: 'browser-workflow',
			workflowId: 'legacy',
			schedule: 'manual',
		},
		sections: { prompt: 'Original content' },
	};
	const decoded = automationDocuments.decode([document]);
	expect(decoded.definitions[0]?.removedAction).toEqual(document);
	expect(automationDocuments.encode(decoded)).toEqual([document]);
});
