import { installPreactMiniDom } from './preact-mini-dom';
import { strict as assert } from 'node:assert';
import { Platform, type App } from 'obsidian';
import { El, findByClass, findTag } from './mini-dom';
import { generateDefaultMarkdown } from '../src/modules/home/core/board/parser/default-document';
import { parse, serialize } from '../src/modules/home/core/board/parser/index';
import type { DashboardData, DashboardColumn } from '../src/modules/home/core/board/types/index';
import {
	classifyFramePolicy,
	clearPrecheckCache,
	getCachedVerdict,
	isValidWebUrl,
	normalizeHeaders,
	normalizeWebUrl,
	precheckEmbed,
	type HeaderFetcher,
} from '../src/modules/home/ui/web/web-precheck';
import { renderWebSection } from '../src/modules/home/ui/web/web-section';

// The current contract uses owned desktop sessions and has no host iframe fallback.
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 20));

/** Deterministic header fetcher factory — records calls, returns a queue. */
function fakeFetcher(responses: Array<Record<string, string> | Error>): HeaderFetcher & { calls: string[] } {
	const calls: string[] = [];
	let i = 0;
	const fn = async (url: string): Promise<Record<string, string>> => {
		calls.push(url);
		const next = responses[Math.min(i++, responses.length - 1)]!;
		if (next instanceof Error) throw next;
		return next;
	};
	return Object.assign(fn, { calls });
}

const DENY: Record<string, string> = { 'x-frame-options': 'DENY' };
const CLEAN: Record<string, string> = { 'content-type': 'text/html' };

function webColumn(name: string, url: string, zoom?: number): DashboardColumn {
	return {
		name,
		color: '#e11d48',
		sectionType: 'web',
		cards: [],
		webConfig: { url, zoom },
	};
}

function dataWith(col: DashboardColumn): DashboardData {
	// Build on the real default shape: serialize() reads unguarded banner
	// fields, so a hand-rolled cast object would crash it.
	const base = parse(generateDefaultMarkdown());
	return { ...base, columns: [col] };
}

/** Render into a fresh El and return the registered reload closure. */
function render(
	column: DashboardColumn,
	options?: { timeoutMs?: number },
): { host: El; reload: () => void } {
	const host = new El('div');
	let reload: () => void = () => {};
	renderWebSection(
		host as unknown as HTMLElement,
		{} as App,
		column,
		(fn) => {
			reload = fn;
		},
		options,
	);
	return { host, reload };
}

async function main(): Promise<void> {
	// Globals the section code touches: window (setTimeout/clearTimeout/open)
	// and CustomEvent (the configure button's routing event).
	let opened: string[] = [];
	(globalThis as unknown as { window: unknown }).window = {
		setTimeout: (fn: () => void, ms?: number) => setTimeout(fn, ms),
		clearTimeout: (id: unknown) => clearTimeout(id as ReturnType<typeof setTimeout>),
		open: (url: string) => {
			opened.push(url);
		},
	};
	if (typeof CustomEvent === 'undefined') {
		(globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class {
			type: string;
			detail: unknown;
			constructor(type: string, o?: { detail?: unknown }) {
				this.type = type;
				this.detail = o?.detail;
			}
		};
	}
	installPreactMiniDom();
	const doc = document as unknown as { defaultView: unknown; body: El }; doc.defaultView = window; doc.body = new El('body');
	clearPrecheckCache();

	/* ---------------- A. parser round-trip ---------------- */

	// 1. Full config serializes every field and parses back equal.
	const full = dataWith(webColumn('Keep', 'https://keep.google.com/u/0/', 0.75));
	const md1 = serialize(full);
	assert.ok(md1.includes('type: web'), '1: type line');
	assert.ok(md1.includes('web:'), '1: web block');
	assert.equal(parse(md1).columns[0]!.webConfig?.url, 'https://keep.google.com/u/0/', '1: url value');
	assert.ok(md1.includes('zoom: 0.75'), '1: zoom line');
	assert.ok(!/mode:/.test(md1), '1: engine is automatic — no mode line');
	const back1 = parse(md1).columns[0]!;
	assert.equal(back1.sectionType, 'web', '1: sectionType survives');
	assert.deepEqual(back1.webConfig, { url: 'https://keep.google.com/u/0/', zoom: 0.75 }, '1: config deep-equal');

	// 2. Minimal config emits no mode/zoom lines.
	const md2 = serialize(dataWith(webColumn('Blog', 'https://example.com')));
	assert.ok(!/mode:/.test(md2), '2: no mode line');
	assert.ok(!/zoom:/.test(md2), '2: no zoom line');

	// 3. Hand-written `mode:` / default `zoom: 1` normalize away
	// (round-trip exact): the engine is automatic and old pinned modes drop.
	const noisy = parse(
		serialize(dataWith(webColumn('N', 'https://x.com'))).replace(
			'    web:\n      url: https://x.com',
			'    web:\n      url: https://x.com\n      mode: webview\n      zoom: 1',
		),
	).columns[0]!;
	assert.equal((noisy.webConfig as unknown as Record<string, unknown>).mode, undefined, '3: mode drops');
	assert.equal(noisy.webConfig?.zoom, undefined, '3: zoom 1 normalizes out');

	// 4. Special characters in the URL survive the round-trip.
	const tricky = 'https://x.com/a"b?c=1&d=2#frag';
	const back4 = parse(serialize(dataWith(webColumn('T', tricky)))).columns[0]!;
	assert.equal(back4.webConfig?.url, tricky, '4: special chars preserved');

	// 5. `type: web` is whitelisted (not silently dropped).
	const md5 = serialize(dataWith(webColumn('W', 'https://a.com')));
	assert.equal(parse(md5).columns[0]!.sectionType, 'web', '5: web in SECTION_TYPES');

	// 6. Idempotent serialize and no card body for web sections.
	const once = serialize(dataWith(webColumn('I', 'https://i.com', 1.5)));
	assert.equal(serialize(parse(once)), once, '6: serialize(parse(serialize)) === serialize');
	assert.ok(!once.includes('### '), '6: no card headings in body');

	/* ---------------- B. precheck pure functions ---------------- */

	// 7. No framing headers at all -> allowed.
	assert.equal(classifyFramePolicy({}), 'allowed', '7: empty headers allowed');

	// 8. X-Frame-Options DENY / SAMEORIGIN block in any value casing (keys are
	// lower-cased upstream by normalizeHeaders — see 10); ALLOW-FROM is dead.
	assert.equal(classifyFramePolicy({ 'x-frame-options': 'deny' }), 'blocked', '8: lowercase deny');
	assert.equal(classifyFramePolicy({ 'x-frame-options': 'SameOrigin' }), 'blocked', '8: mixed-case value');
	assert.equal(
		classifyFramePolicy({ 'x-frame-options': 'ALLOW-FROM https://a.com' }),
		'allowed',
		'8: allow-from ignored',
	);

	// 9. CSP frame-ancestors: without * blocks, with * allows, strictest wins.
	assert.equal(
		classifyFramePolicy({ 'content-security-policy': 'frame-ancestors https://a.com' }),
		'blocked',
		'9: explicit origin blocks',
	);
	assert.equal(
		classifyFramePolicy({ 'content-security-policy': 'frame-ancestors *' }),
		'allowed',
		'9: wildcard allows',
	);
	assert.equal(
		classifyFramePolicy({ 'content-security-policy': "default-src 'self'" }),
		'allowed',
		'9: no frame-ancestors directive',
	);
	assert.equal(
		classifyFramePolicy({ 'content-security-policy': "frame-ancestors * , frame-ancestors 'self'" }),
		'blocked',
		'9: strictest of merged policies wins',
	);

	// 10. Header normalization: lower-cased keys, array values joined.
	assert.deepEqual(
		normalizeHeaders({ 'X-Frame-Options': 'DENY', 'Set-Cookie': ['a=1', 'b=2'] }),
		{ 'x-frame-options': 'DENY', 'set-cookie': 'a=1, b=2' },
		'10: normalizeHeaders',
	);

	// 11. URL normalization: scheme added, whitespace trimmed, http kept.
	assert.equal(normalizeWebUrl('  keep.google.com  '), 'https://keep.google.com', '11: scheme added + trimmed');
	assert.equal(normalizeWebUrl('http://x.local'), 'http://x.local', '11: http untouched');

	// 12. URL validity gates.
	assert.equal(isValidWebUrl('https://x.com'), true, '12: plain https ok');
	assert.equal(isValidWebUrl('javascript:alert(1)'), false, '12: javascript rejected');
	assert.equal(isValidWebUrl('ftp://x.com'), false, '12: ftp rejected');
	assert.equal(isValidWebUrl('https://'), false, '12: empty host rejected');
	assert.equal(isValidWebUrl('https://u:p@x.com'), false, '12: userinfo rejected');
	assert.equal(isValidWebUrl('https://x.com/' + 'a'.repeat(2000)), false, '12: >2000 chars rejected');

	// 13. precheckEmbed with injected fetcher: verdict, cache, clear, failure.
	clearPrecheckCache();
	const denyOnce = fakeFetcher([DENY]);
	assert.equal((await precheckEmbed('https://cached.com', denyOnce)).verdict, 'blocked', '13: denied verdict');
	assert.equal((await precheckEmbed('https://cached.com', denyOnce)).verdict, 'blocked', '13: cached verdict served');
	assert.equal(denyOnce.calls.length, 1, '13: fetcher called once (cache hit second time)');
	assert.equal(getCachedVerdict('https://cached.com'), 'blocked', '13: cache readable');

	const throwing = fakeFetcher([new Error('offline')]);
	assert.equal(
		(await precheckEmbed('https://flaky.com', throwing)).verdict,
		'unknown',
		'13: network failure -> unknown',
	);
	assert.equal(
		(await precheckEmbed('https://flaky.com', fakeFetcher([]))).verdict,
		'unknown',
		'13: cached unknown served without fetch',
	);

	// 13b. A black-holed probe resolves to unknown within its bound.
	const hanging: HeaderFetcher = () => new Promise(() => {});
	const t0 = Date.now();
	assert.equal(
		(await precheckEmbed('https://hang.com', hanging, 15)).verdict,
		'unknown',
		'13b: hung probe -> unknown',
	);
	assert.ok(Date.now() - t0 < 2000, '13b: bounded by timeoutMs, not pended forever');
	assert.equal(getCachedVerdict('https://hang.com'), 'unknown', '13b: timeout cached as unknown');

	clearPrecheckCache('https://cached.com');
	assert.equal(getCachedVerdict('https://cached.com'), undefined, '13: cleared per-url');
	const reprobe = fakeFetcher([CLEAN]);
	assert.equal((await precheckEmbed('https://cached.com', reprobe)).verdict, 'allowed', '13: re-probe after clear');

	/* ---------------- C. render state machine ---------------- */

	// 14. Empty URL -> guide state; configure button routes the config event.
	const empty = render(webColumn('Guide', ''));
	const emptyWrap = findByClass(empty.host, 'dashboard-web-empty')[0]!;
	assert.ok(emptyWrap, '14: empty state rendered');
	assert.equal(findTag(empty.host, 'iframe').length, 0, '14: no iframe for empty URL');
	let routed = false;
	empty.host.addEventListener('dashboard-library-config', () => {
		routed = true;
	});
	findByClass(empty.host, 'dashboard-web-fallback-btn')[0]!.click();
	assert.ok(routed, '14: configure button dispatched the config event');

	// Desktop never navigates before acquiring its vault Session, even for frameable sites.
	await precheckEmbed('https://frame.me', fakeFetcher([CLEAN]));
	const desktop = render(webColumn('F', 'https://frame.me'));
	assert.equal(findTag(desktop.host, 'iframe').length, 0);
	const guest = findTag(desktop.host, 'webview')[0]!;
	assert.ok(guest);
	assert.equal(guest.getAttribute('src'), null);
	assert.equal(guest.getAttribute('partition'), null);
	assert.match(guest.getAttribute('webpreferences')!, /nodeIntegration=false/);
	await flush(); await flush();
	assert.equal(findTag(desktop.host, 'iframe').length, 0);
	assert.ok(findByClass(desktop.host, 'dashboard-web-fallback').length, 'unsupported native host reports a visible failure');
	desktop.reload(); await flush();
	assert.equal(findTag(desktop.host, 'iframe').length, 0, 'retry never falls back to host storage');
	const wasMobile = Platform.isMobile; Platform.isMobile = true;
	try {
		for (const target of ['https://frame.me', 'https://deny.com']) {
			const mobile = render(webColumn('M', target)); await flush();
			assert.equal(findTag(mobile.host, 'webview').length + findTag(mobile.host, 'iframe').length, 0);
			const card = findByClass(mobile.host, 'dashboard-web-fallback')[0]!;
			assert.ok(card); const before = opened.length;
			findByClass(card, 'dashboard-web-fallback-btn')[0]!.click(); assert.equal(opened.length, before + 1);
		}
	} finally { Platform.isMobile = wasMobile; }
	console.log('verify-web-section: parser, URL policy, vault-session admission and mobile fallback OK');
}

void main().catch((err) => {
	console.error(err);
	process.exit(1);
});
