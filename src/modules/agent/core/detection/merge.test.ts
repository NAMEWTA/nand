import { expect, test } from 'vitest';
import { normalizeTerminalSettings } from '../terminal/settings';
import { availableAgents, launchSettings } from './merge';
import { launchArgs } from '../launch/flags';
test('disabled or absent default falls back to installed enabled agents', () => {
	const settings = normalizeTerminalSettings({ enabled: { 'claude-code': false }, defaultAgent: 'claude-code' });
	expect(availableAgents(settings, { 'claude-code': '/cli/claude', codex: '/cli/codex' }).map((a) => a.id)).toEqual([
		'codex',
	]);
	expect(availableAgents(settings, {})).toEqual([]);
});
test('flattened settings override detection and custom args survive permission switches, including empty args', () => {
	const settings = normalizeTerminalSettings({
		permissionMode: 'yolo',
		overrides: { codex: { command: '/cli/custom', args: '', env: { FOO: 'bar' } } },
	});
	expect(launchArgs(launchSettings(settings), 'codex')).toEqual([]);
	settings.overrides.codex!.args = '--model "custom model"';
	settings.permissionMode = 'manual';
	expect(launchArgs(launchSettings(settings), 'codex')).toEqual(['--model', 'custom model']);
	expect(launchSettings(settings).agents.codex).toMatchObject({ cliPath: '/cli/custom', env: { FOO: 'bar' } });
	expect(normalizeTerminalSettings({ presets: [{ name: 'old' }] }).quickCommands).toEqual([]);
});
