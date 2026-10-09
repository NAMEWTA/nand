import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import type { AgentPromptRunner } from '../../agent/api';
import { AI_SITES, SITE_HOME, type AiSite, type ExchangeTarget } from '../core/ai-workbench';
import { sendCurrentTurn } from '../core/site-exchange';
import { pageSitePort } from '../platform/desktop/site-port';
import { AiWorkspace } from './ai-workspace';

const idle = (): ExchangeTarget[] => AI_SITES.map((id) => ({ id, binding: 'unverified', send: 'idle', capture: 'idle', attempt: 0 }));

const COMPOSER_REFS = [
	{ ref: 'box', role: 'textbox', name: 'Message' },
	{ ref: 'go', role: 'button', name: 'Send' },
] as const;

type GuestLog =
	| { kind: 'goto'; url: string }
	| { kind: 'snapshot'; url: string; revision: string; refs: string[] }
	| { kind: 'fill'; url: string; revision: string; element: string; value: string }
	| { kind: 'click'; url: string; revision: string; element: string }
	| { kind: 'keypress'; url: string; key: string };

interface PageState {
	text: string;
	login: boolean;
	revision?: string;
	refs: { ref: string; role: string; name: string }[];
}

/**
 * One in-memory guest. Fill and click throw unless they carry the revision and a ref
 * from the snapshot just taken on the current URL. Keypress stays revision-free.
 */
function scriptedGuest(answer: string, loginUrls: readonly string[] = []) {
	const log: GuestLog[] = [];
	const pages = new Map<string, PageState>();
	let current = '';
	let serial = 0;
	const opens: string[] = [];
	const fills: { url: string; value: string }[] = [];
	const clicks: { url: string; revision: string }[] = [];

	async function execute(method: string, params: Record<string, unknown>): Promise<unknown> {
		if (method === 'goto') {
			const url = String(params.url);
			opens.push(url);
			current = url;
			log.push({ kind: 'goto', url });
			const existing = pages.get(url);
			if (existing) {
				existing.revision = undefined;
				return { url };
			}
			const login = loginUrls.some((part) => url.includes(part));
			pages.set(url, { text: login ? 'login' : `composer\n${url}`, login, refs: [] });
			return { url };
		}
		const page = pages.get(current);
		if (!page || !current) throw new Error(`${method} without an open page`);
		if (method === 'snapshot') {
			if (!page.login && !page.text.includes(current)) throw new Error(`snapshot is not from ${current}`);
			serial += 1;
			const revision = `guest:${serial}`;
			const refs = page.login ? [] : COMPOSER_REFS.map((item) => ({ ...item }));
			page.revision = revision;
			page.refs = refs;
			log.push({ kind: 'snapshot', url: current, revision, refs: refs.map((item) => item.ref) });
			return { snapshot: page.text, refs, revision, url: current };
		}
		if (method === 'fill' || method === 'click') {
			const revision = typeof params.revision === 'string' ? params.revision : '';
			const element = typeof params.element === 'string' ? params.element : '';
			if (!page.revision || revision !== page.revision) throw new Error('stale-revision');
			if (!page.refs.some((item) => item.ref === element)) throw new Error('stale-ref');
			if (method === 'fill') {
				if (page.login || !page.text.includes(current)) throw new Error(`fill is not on ${current}`);
				const value = String(params.value ?? '');
				page.text = `${value}\n${current}`;
				fills.push({ url: current, value });
				log.push({ kind: 'fill', url: current, revision, element, value });
				return { performed: 'fill' };
			}
			page.text = `${page.text}\n\n${answer}\n${current}`;
			clicks.push({ url: current, revision });
			log.push({ kind: 'click', url: current, revision, element });
			return { performed: 'click' };
		}
		if (method === 'keypress') {
			log.push({ kind: 'keypress', url: current, key: String(params.key ?? '') });
			page.text = `${page.text}\n\n${answer}\n${current}`;
			return { performed: 'keypress' };
		}
		throw new Error(`unexpected ${method}`);
	}

	return {
		port: pageSitePort(() => ({ automation: { execute } })),
		opens,
		fills,
		clicks,
		log,
		expectHomes(targets: readonly ExchangeTarget[]) {
			for (const target of targets) {
				if (target.capture !== 'complete' && target.send !== 'submitted') continue;
				const home = SITE_HOME[target.id as AiSite];
				const wrote = fills.some((item) => item.url === home && item.value.trim().length > 0);
				if (!home || !wrote || !target.answer?.includes(home)) throw new Error(`${target.id} answer or fill is not from ${home ?? 'its home'}`);
			}
		},
	};
}

/** Each write uses the revision from the snapshot that followed that URL's latest goto. A click uses the later snapshot. */
function assertLiveRevisions(log: readonly GuestLog[]): void {
	for (let index = 0; index < log.length; index++) {
		const event = log[index]!;
		if (event.kind !== 'fill' && event.kind !== 'click') continue;
		const prior = [...log.slice(0, index)].reverse().find((item) => item.kind === 'snapshot' && item.url === event.url);
		assert.ok(prior && prior.kind === 'snapshot');
		assert.equal(event.revision, prior.revision);
		assert.equal(prior.refs.includes(event.element), true);
		if (event.kind === 'fill') {
			const goto = log[log.indexOf(prior) - 1];
			assert.equal(goto?.kind, 'goto');
			if (goto?.kind === 'goto') assert.equal(goto.url, event.url);
		} else {
			const fill = [...log.slice(0, index)].reverse().find((item) => item.kind === 'fill' && item.url === event.url);
			assert.ok(fill && fill.kind === 'fill');
			if (fill && fill.kind === 'fill') assert.notEqual(event.revision, fill.revision);
		}
	}
}

describe('browser workspace send and capture', () => {
	test('a send reads the current turn and does not call the runner', async () => {
		const guest = scriptedGuest('the answer');
		const sent = await sendCurrentTurn(idle(), 'hello', guest.port);
		assert.equal(sent.calls, 0);
		assert.equal(guest.opens.length, AI_SITES.length * 2);
		assert.equal(sent.targets.filter((target) => target.capture === 'complete').length, AI_SITES.length);
		assert.equal(sent.targets[0]?.answer?.includes('the answer'), true);
		assert.equal(guest.fills.length, AI_SITES.length);
		assert.equal(guest.clicks.length, AI_SITES.length);
		assert.equal(guest.log.some((item) => item.kind === 'keypress'), false);
		guest.expectHomes(sent.targets);
		assertLiveRevisions(guest.log);
		const opened = guest.opens.length;
		const again = await sendCurrentTurn(sent.targets, 'hello', guest.port);
		assert.equal(again.targets[0]?.attempt, sent.targets[0]?.attempt);
		assert.equal(guest.opens.length, opened);
	});

	test('resend creates one attempt and recollect does not send again', async () => {
		const guest = scriptedGuest('the answer');
		const workspace = new AiWorkspace(guest.port, () => undefined);
		await workspace.send('hello');
		const first = workspace.targets[0]?.attempt;
		assert.equal(first, 1);
		assert.equal(workspace.frozen?.prompt, 'hello');
		assert.equal(workspace.comparison.complete.length, AI_SITES.length);
		assert.equal(workspace.support.every((site) => site.verified === false), true);
		workspace.resend('deepseek');
		await workspace.send('hello again');
		assert.equal(workspace.targets.find((target) => target.id === 'deepseek')?.attempt, 2);
		assert.equal(workspace.targets.find((target) => target.id === 'kimi')?.attempt, 1);
		assert.equal(workspace.targets[0]?.id, 'deepseek');
		guest.expectHomes(workspace.targets);
		assertLiveRevisions(guest.log);
		const opens = guest.opens.length;
		const presses = guest.clicks.length;
		await workspace.recollect('deepseek');
		assert.equal(workspace.targets[0]?.attempt, 2);
		assert.equal(guest.opens.length, opens + 1);
		assert.equal(guest.opens.at(-1), SITE_HOME.deepseek);
		assert.equal(guest.clicks.length, presses);
		workspace.targets[0] = { ...workspace.targets[0]!, send: 'submitting', answer: 'kept' };
		const receipt = workspace.cancel();
		assert.equal(workspace.targets[0]?.send, 'unknown');
		assert.equal(workspace.targets[0]?.answer, 'kept');
		assert.equal(receipt.state, 'cancelled');
	});

	test('one site that is not ready blocks every composer write', async () => {
		const guest = scriptedGuest('the answer', ['kimi.com']);
		const sent = await sendCurrentTurn(idle(), 'hello', guest.port);
		assert.equal(guest.fills.length, 0);
		assert.equal(guest.clicks.length, 0);
		assert.equal(sent.calls, 0);
		assert.equal(sent.targets.some((target) => target.send === 'submitted'), false);
		assert.equal(sent.targets.find((target) => target.id === 'kimi')?.binding, 'login-required');
		const kimiShots = guest.log.filter((item) => item.kind === 'snapshot' && item.url === SITE_HOME.kimi);
		assert.ok(kimiShots.length >= 1);
		assert.equal(
			kimiShots.every((item) => item.kind === 'snapshot' && item.refs.length === 0),
			true,
		);
	});

	test('a ready site is filled on its own home when a later site is logged out', async () => {
		const guest = scriptedGuest('the answer', ['kimi.com']);
		const sent = await sendCurrentTurn(
			idle().filter((target) => target.id === 'deepseek' || target.id === 'kimi'),
			'hello',
			guest.port,
			true,
		);
		assert.equal(sent.calls, 0);
		const kimi = sent.targets.find((target) => target.id === 'kimi');
		assert.equal(kimi?.binding, 'login-required');
		assert.equal(kimi?.send, 'idle');
		const deepseek = sent.targets.find((target) => target.id === 'deepseek');
		assert.equal(deepseek?.capture, 'complete');
		assert.equal(deepseek?.answer?.includes(SITE_HOME.deepseek), true);
		assert.equal(guest.fills.some((item) => item.url === SITE_HOME.kimi), false);
		assert.equal(guest.opens.filter((url) => url === SITE_HOME.deepseek).length, 2);
		guest.expectHomes(sent.targets);
		assertLiveRevisions(guest.log);
		const kimiFill = guest.log.find((item) => (item.kind === 'fill' || item.kind === 'click') && item.url === SITE_HOME.kimi);
		assert.equal(kimiFill, undefined);
	});

	test('synthesis calls the shared runner only when the user opts in', async () => {
		let calls = 0;
		const runner: AgentPromptRunner = {
			async run() {
				calls += 1;
				return { status: 'complete', text: 'synthesis' };
			},
		};
		const guest = scriptedGuest('answer');
		const workspace = new AiWorkspace(guest.port, () => runner);
		await workspace.send('hello');
		assertLiveRevisions(guest.log);
		const skipped = await workspace.synthesize(false, 'hello');
		assert.equal(skipped.calls, 0);
		assert.equal(calls, 0);
		const done = await workspace.synthesize(true, 'hello');
		assert.equal(done.calls, 1);
		assert.equal(done.text, 'synthesis');
		assert.equal(calls, 1);
	});

	test('a snapshot without a revision does not fill or click', async () => {
		const calls: string[] = [];
		const port = pageSitePort(() => ({
			automation: {
				async execute(method: string) {
					calls.push(method);
					if (method === 'snapshot') {
						return {
							snapshot: 'composer\nhttps://chat.deepseek.com/',
							refs: [{ ref: 'box', role: 'textbox', name: 'Message' }],
						};
					}
					return {};
				},
			},
		}));
		const shot = await port.snapshot();
		assert.equal(shot.refs[0]?.ref, 'box');
		await assert.rejects(() => port.fill('box', 'hello'));
		assert.equal(await port.press('go'), 'unknown');
		assert.deepEqual(calls, ['snapshot']);
	});
});
