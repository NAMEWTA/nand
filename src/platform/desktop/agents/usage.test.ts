import assert from 'node:assert/strict';
import test from 'node:test';

import type { UsageSnapshot, UsageStatusKey } from '../../../core/agent-launch/types.ts';
import { setLanguage, t } from '../../../shared/i18n/runtime.ts';
import { usageStatusText } from './usage.ts';

test('cached local usage states translate at display time while raw provider errors retain their text', () => {
	const snapshot: UsageSnapshot = {
		agentId: 'codex', provider: 'Codex', account: null, failed: false, windows: [], status: '未登录',
	};
	const states: UsageStatusKey[] = ['notSignedIn', 'expired', 'readOk', 'noNumbers', 'readFailed', 'quotaUnsupported'];
	for (const language of ['en', 'zh', 'en'] as const) {
		setLanguage(language);
		for (const statusKey of states) {
			assert.equal(usageStatusText({ ...snapshot, statusKey }), t(`terminalAgent.agents.${statusKey}`));
		}
		const status = 'Provider response: no usage numbers for account abc';
		assert.equal(usageStatusText({ ...snapshot, status }), status);
	}
});
