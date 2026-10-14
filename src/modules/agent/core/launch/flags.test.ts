import { expect, test } from 'vitest';
import { normalizeAgentSettings } from './defaults';
import { launchArgs, needsYoloConfirmation } from './flags';
test('manual overrides ignore global yolo and acknowledgement is per agent', () => {
	const settings = normalizeAgentSettings({ globalPermissionMode: 'yolo' });
	expect(needsYoloConfirmation(settings, 'codex')).toBe(true);
	settings.yoloAcknowledgedAgents = ['codex'];
	expect(needsYoloConfirmation(settings, 'codex')).toBe(false);
	expect(needsYoloConfirmation(settings, 'claude-code')).toBe(true);
	settings.agents['claude-code'].argsOverride = '';
	expect(launchArgs(settings, 'claude-code')).toEqual([]);
	expect(needsYoloConfirmation(settings, 'claude-code')).toBe(false);
	settings.agents['claude-code'].argsOverride = '--model sonnet';
	expect(needsYoloConfirmation(settings, 'claude-code')).toBe(false);
	settings.globalPermissionMode = 'manual';
	settings.agents['claude-code'].argsOverride = '--dangerously-skip-permissions';
	expect(needsYoloConfirmation(settings, 'claude-code')).toBe(true);
});
