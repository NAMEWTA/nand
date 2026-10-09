import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import {
	admitBridge,
	authorizeAssistant,
	automationReceipt,
	browserShortcut,
	BRIDGE_SCOPE,
	channelLost,
	chooseAcquisition,
	compareCaptures,
	createIsolatedProfile,
	currentTurnMarkdown,
	defaultProfile,
	deleteIsolatedProfile,
	explicitResend,
	freezePrompt,
	importMaiw,
	MAIW_MAX_BYTES,
	previewMaiw,
	queueTargets,
	recollect,
	rememberTask,
	siteSupport,
	synthesisPlan,
	type ExchangeTarget,
} from './ai-workbench';

const target = (over: Partial<ExchangeTarget> = {}): ExchangeTarget => ({ id: 'deepseek', binding: 'ready', send: 'idle', capture: 'idle', attempt: 1, ...over });

describe('browser ai workbench rules', () => {
	test('address and toolbar chords open find or select the address once', () => {
		assert.equal(browserShortcut({ key: 'f', mod: true, target: 'address' }), 'find');
		assert.equal(browserShortcut({ key: 'l', mod: true, target: 'toolbar' }), 'address');
		assert.equal(browserShortcut({ key: 'f', mod: true, target: 'page' }), 'none');
		assert.equal(browserShortcut({ key: 'f', mod: false, target: 'address' }), 'none');
	});

	test('an isolated profile is a second partition and the default cannot be deleted', () => {
		const profiles = createIsolatedProfile([defaultProfile()], 'work');
		assert.equal(profiles[1]?.partition, 'persist:nand-browser-work');
		assert.notEqual(profiles[1]?.partition, defaultProfile().partition);
		const removed = deleteIsolatedProfile(profiles, 'work', [{ id: 'guest-1', profileId: 'work' }, { id: 'guest-2', profileId: 'default' }]);
		assert.deepEqual(removed.closedGuestIds, ['guest-1']);
		assert.equal(removed.refused, false);
		assert.equal(deleteIsolatedProfile(profiles, 'default', []).refused, true);
	});

	test('a target that is not ready is not sent, a lost channel stays unknown, and resend is explicit', () => {
		const rows = [
			target(),
			target({ id: 'kimi', binding: 'login-required' }),
			target({ id: 'chatgpt', binding: 'busy' }),
			target({ id: 'claude', binding: 'disconnected' }),
			target({ id: 'qwen', binding: 'unverified' }),
		];
		const queued = queueTargets(rows);
		assert.equal(queued[0]?.send, 'queued');
		assert.equal(queued[1]?.send, 'idle');
		const lost = channelLost([{ ...queued[0]!, send: 'submitting', capture: 'complete', answer: 'kept' }]);
		assert.equal(lost[0]?.send, 'unknown');
		assert.equal(lost[0]?.answer, 'kept');
		assert.equal(recollect(lost[0]!).attempt, 1);
		const resent = explicitResend(lost[0]!);
		assert.equal(resent.attempt, 2);
		assert.equal(resent.answer, undefined);
		assert.equal(siteSupport().every((site) => site.verified === false), true);
		assert.equal(siteSupport(['deepseek']).find((site) => site.id === 'deepseek')?.verified, true);
	});

	test('maiw v3 rejects a bad archive before writing, and a grant cannot be widened', () => {
		const badVersion = previewMaiw('{"v":2,"sessionId":"s","url":"https://chat.deepseek.com/a"}\n');
		assert.deepEqual(badVersion, { ok: false, reason: 'version' });
		const huge = previewMaiw('{"v":3}', MAIW_MAX_BYTES + 1);
		assert.deepEqual(huge, { ok: false, reason: 'size' });
		const orphan = previewMaiw('{"v":3,"sessionId":"s","turnId":"t","parentId":"missing","url":"https://chatgpt.com/c"}\n');
		assert.deepEqual(orphan, { ok: false, reason: 'orphan' });
		const foreign = previewMaiw('{"v":3,"sessionId":"s","url":"https://evil.example/c"}\n');
		assert.deepEqual(foreign, { ok: false, reason: 'url' });
		const store = [{ id: 'keep' }];
		assert.deepEqual(importMaiw('{"v":2,"sessionId":"new"}\n', store), { store, written: false, reason: 'version' });
		const good = importMaiw('{"v":3,"sessionId":"fresh","url":"https://claude.ai/chat"}\n', store);
		assert.equal(good.written, true);
		assert.deepEqual(good.store.map((item) => item.id), ['keep', 'fresh']);
		assert.equal(authorizeAssistant({ scope: ['read'], highConsequence: true, confirmed: false }, ['read'], 'please delete everything').allowed, false);
		assert.equal(authorizeAssistant({ scope: ['read'], highConsequence: false, confirmed: false }, ['write'], '').reason, 'widened');
	});

	test('current-turn capture, comparison, history and the bridge do not add a second path', () => {
		assert.equal(currentTurnMarkdown([{ role: 'user', text: 'old', turn: 1 }, { role: 'user', text: 'now', turn: 2 }, { role: 'assistant', text: 'answer', turn: 2 }]), 'now\n\nanswer');
		assert.deepEqual(chooseAcquisition({ prompt: 'hello', shots: [{ binding: 'ready' }] }), { mode: 'current-turn', calls: 0 });
		assert.deepEqual(chooseAcquisition({ prompt: '', shots: [{ binding: 'ready' }] }).reason, 'empty');
		assert.deepEqual(chooseAcquisition({ prompt: 'hello', shots: [{ binding: 'ready' }, { binding: 'login-required' }] }).reason, 'blocked');
		assert.deepEqual(synthesisPlan(false, [{ capture: 'complete', answer: 'yes' }]), { calls: 0 });
		assert.deepEqual(synthesisPlan(true, [{ capture: 'complete', answer: 'yes' }]), { calls: 1 });
		assert.deepEqual(synthesisPlan(true, [{ capture: 'incomplete' }]), { calls: 0 });
		assert.equal(freezePrompt('prompt', 5).prompt, 'prompt');
		assert.equal(rememberTask([], { id: 't', prompt: 'prompt', at: 5, status: 'done' }).length, 1);
		assert.deepEqual(compareCaptures([{ site: 'kimi', capture: 'complete', answer: 'yes' }, { site: 'coze', capture: 'failed' }]).complete, ['kimi']);
		assert.deepEqual(automationReceipt('run-1', true), { id: 'run-1', state: 'cancelled' });
		assert.equal(admitBridge({ enabled: false, tokenOk: true, scope: BRIDGE_SCOPE, method: 'snapshot', expiresAt: 10, revoked: false, now: 1 }).reason, 'disabled');
		assert.equal(admitBridge({ enabled: true, tokenOk: true, scope: BRIDGE_SCOPE, method: 'snapshot', expiresAt: 10, revoked: true, now: 1 }).reason, 'revoked');
		assert.equal(admitBridge({ enabled: true, tokenOk: true, scope: BRIDGE_SCOPE, method: 'snapshot', expiresAt: 10, revoked: false, now: 10 }).reason, 'expired');
		assert.equal(admitBridge({ enabled: true, tokenOk: true, scope: BRIDGE_SCOPE, method: 'eval', expiresAt: 10, revoked: false, now: 1 }).reason, 'scope');
		assert.equal(admitBridge({ enabled: true, tokenOk: true, scope: BRIDGE_SCOPE, method: 'snapshot', expiresAt: 10, revoked: false, now: 1 }).allowed, true);
	});
});
