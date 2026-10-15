import { expect, test, vi } from 'vitest';
import { memoryVault } from '../../../../scripts/fixtures/memory-vault';
import { MarkdownAutomationDefinitions } from './definitions';
import type { AutomationDefinition } from '../../../shared/automation/types';

test('unreadable saved automation blocks listing and edits until its document is repaired', async () => {
	const vault = memoryVault();
	const definitions = new MarkdownAutomationDefinitions(vault.app);
	const action: AutomationDefinition = {
		id: 'review-action',
		name: 'Review',
		enabled: true,
		deviceId: 'fixture',
		revision: 1,
		graceMinutes: 0,
		channels: [],
		notifyOn: 'never',
		createdAt: 1,
		updatedAt: 1,
		schedule: { kind: 'manual' },
		action: { kind: 'open-file', path: 'Target.md' },
	};
	try {
		await definitions.save(action);
		const [file, original] = [...vault.contents.entries()].find(([file]) => file.endsWith('.md'))!;
		const invalid = original.replace('action: open-file', 'action: unsupported');
		await vault.adapter.write(file, invalid);
		const writes = vault.writes;
		await expect(definitions.list()).rejects.toThrow('Invalid action');
		await expect(definitions.save({ ...action, name: 'Changed' })).rejects.toThrow('Invalid action');
		await expect(definitions.remove(action)).rejects.toThrow('Invalid action');
		expect(vault.writes).toBe(writes);
		expect(vault.contents.get(file)).toBe(invalid);
		await vault.adapter.write(file, original);
		expect(await definitions.list()).toEqual([action]);
		await definitions.save({ ...action, name: 'Changed' });
		expect((await definitions.list())[0]?.name).toBe('Changed');
		vi.spyOn(vault.adapter, 'process').mockRejectedValueOnce(new Error('Write unavailable'));
		await expect(definitions.save({ ...action, name: 'Retry' })).rejects.toThrow('Write unavailable');
		await definitions.save({ ...action, name: 'Retry' });
		expect((await definitions.list())[0]?.name).toBe('Retry');
	} finally {
		await definitions.shutdown();
	}
});

test('removed workflow can be listed and explicitly deleted without rewriting other legacy content', async () => {
	const vault = memoryVault(),
		definitions = new MarkdownAutomationDefinitions(vault.app);
	const action: AutomationDefinition = {
		id: 'removed',
		name: 'Removed',
		enabled: true,
		deviceId: 'fixture',
		revision: 1,
		graceMinutes: 0,
		channels: [],
		notifyOn: 'never',
		createdAt: 1,
		updatedAt: 1,
		schedule: { kind: 'manual' },
		action: { kind: 'open-file', path: 'Target.md' },
	};
	try {
		await definitions.save(action);
		const [file, original] = [...vault.contents.entries()].find(([file]) => file.endsWith('.md'))!;
		const legacy = original.replace('action: open-file', 'action: browser-workflow');
		await vault.adapter.write(file, legacy);
		const removed = (await definitions.list())[0]!;
		expect(removed.removedAction).toBeTruthy();
		expect(vault.contents.get(file)).toBe(legacy);
		await definitions.save({ ...action, id: 'other', name: 'Other' });
		expect(vault.contents.get(file)).toBe(legacy);
		await definitions.remove(removed);
		expect(await definitions.list()).toHaveLength(1);
		// Collection deletion is an explicit persisted tombstone, preserving recoverable user content.
		expect(vault.contents.get(file)).toContain('nand-deleted: true');
	} finally {
		await definitions.shutdown();
	}
});
