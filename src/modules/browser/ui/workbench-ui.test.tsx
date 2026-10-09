import assert from 'node:assert/strict';
import { h, render } from 'preact';
import { test } from 'vitest';
import { flush, installDom } from '../../../../test/dom';
import { registerMessages, t } from '../../../shared/i18n';
import { messages as browserStrings } from '../../../shared/i18n/lazy/browser';
import { AI_SITES, type ExchangeTarget } from '../core/ai-workbench';
import type { BrowserPageState } from '../core/model';
import type { SiteExchangePort } from '../core/site-exchange';
import type { BrowserHost } from '../services/page-host';
import { AiWorkspace } from '../services/ai-workspace';
import { AiBar } from './AiBar';
import { BrowserPanel } from './BrowserPanel';

registerMessages(browserStrings);
const { document } = installDom();
const inputPrototype = Object.getPrototypeOf(document.createElement('input')) as { select?: () => void };
if (typeof inputPrototype.select !== 'function') inputPrototype.select = () => undefined;

function chord(target: Element, name: string): void {
	const event = new (target.ownerDocument.defaultView as unknown as { Event: typeof Event }).Event('keydown', { bubbles: true, cancelable: true });
	Object.defineProperty(event, 'key', { value: name });
	Object.defineProperty(event, 'ctrlKey', { value: true });
	Object.defineProperty(event, 'metaKey', { value: false });
	target.dispatchEvent(event);
}

const pageState = (): BrowserPageState => ({
	id: 'page-1',
	url: 'about:blank',
	title: '',
	zoom: 1,
	loading: false,
	canGoBack: false,
	canGoForward: false,
	error: null,
	favicon: '',
});

function port(answer: string): SiteExchangePort & { opens: string[] } {
	const opens: string[] = [];
	let text = 'composer';
	return {
		opens,
		async open(url) {
			opens.push(url);
			text = 'composer';
		},
		async snapshot() {
			return { text, refs: [{ ref: 'box', role: 'textbox', name: 'Message' }, { ref: 'go', role: 'button', name: 'Send' }] };
		},
		async fill(_ref, value) {
			text = value;
		},
		async press() {
			text = `${text}\n\n${answer}`;
			return 'submitted';
		},
	};
}

async function settle(): Promise<void> {
	for (let i = 0; i < 8; i++) await flush();
}

test('the panel opens find from the address bar and leaves the page chord alone', async () => {
	const root = document.createElement('div');
	document.body.append(root);
	const host = {
		enabled: () => false,
		history: () => [],
		settings: () => ({ searchEngine: 'https://example.com/?q=%s' }),
	} as unknown as BrowserHost;
	render(h(BrowserPanel, { host, initial: pageState(), changed: () => {}, activate: false }), root);
	await flush();
	const address = root.querySelector('.nand-browser-address') as HTMLInputElement;
	const viewport = root.querySelector('.nand-browser-viewport');
	assert.ok(address);
	assert.ok(viewport);
	let addressFocus = 0;
	address.focus = () => {
		addressFocus += 1;
	};
	chord(viewport, 'f');
	await flush();
	assert.equal(root.querySelector('.nand-browser-find'), null);
	assert.equal(addressFocus, 0);
	chord(address, 'f');
	await flush();
	assert.ok(root.querySelector('.nand-browser-find'));
	assert.equal(addressFocus, 0);
	chord(address, 'l');
	await flush();
	assert.equal(addressFocus, 1);
	render(null, root);
});

test('the browser bar sends the current turn and synthesizes only after opt-in', async () => {
	const guest = port('the answer');
	let calls = 0;
	const workspace = new AiWorkspace(guest, () => ({
		async run() {
			calls += 1;
			return { status: 'complete', text: 'synthesis' };
		},
	}));
	const root = document.createElement('div');
	document.body.append(root);
	render(h(AiBar, { workspace }), root);
	const prompt = root.querySelector('.nand-browser-ai-prompt') as HTMLInputElement;
	prompt.value = 'hello';
	prompt.dispatchEvent(new Event('input', { bubbles: true }));
	await flush();
	const button = (label: string) => [...root.querySelectorAll('button')].find((item) => item.textContent === label);
	button(t('browser.ai.synthesis'))?.click();
	await settle();
	assert.equal(calls, 0);
	button(t('browser.ai.send'))?.click();
	await settle();
	assert.equal(guest.opens.length, AI_SITES.length * 2);
	assert.equal(workspace.targets.filter((target: ExchangeTarget) => target.capture === 'complete').length, AI_SITES.length);
	assert.equal(calls, 0);
	const optIn = [...root.querySelectorAll('label')].find((label) => label.textContent?.includes(t('browser.ai.synthesisOptIn')))?.querySelector('input');
	assert.ok(optIn);
	optIn.checked = true;
	optIn.dispatchEvent(new Event('change', { bubbles: true }));
	await flush();
	button(t('browser.ai.synthesis'))?.click();
	await settle();
	assert.equal(calls, 1);
	assert.equal(workspace.synthesis, 'synthesis');
	render(null, root);
});
