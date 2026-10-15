import { act, render } from '@testing-library/react';
import type { App } from 'obsidian';
import { afterEach, expect, test, vi } from 'vitest';
import type { DashboardColumn } from '../../core/board/types/index';
import { WebPanel } from './WebPanel';

vi.mock('./web-precheck', async (original) => ({
	...(await original<typeof import('./web-precheck')>()),
	precheckEmbed: vi.fn(async () => ({ verdict: 'allowed' })),
}));

// Only the frame element matters here; happy-dom must not try to load the remote page.
const happyDOM = (window as unknown as { happyDOM?: { settings: { navigation: { disableChildFrameNavigation: boolean } } } }).happyDOM;
if (happyDOM) happyDOM.settings.navigation.disableChildFrameNavigation = true;

afterEach(() => document.body.replaceChildren());

function host() {
	const listeners = new Set<() => void>();
	const app = {
		workspace: {
			on: (name: string, listener: () => void) => {
				expect(name).toBe('css-change');
				listeners.add(listener);
				return listener;
			},
			offref: (ref: () => void) => listeners.delete(ref),
		},
	} as unknown as App;
	return { app, listeners, cssChange: () => act(() => listeners.forEach((listener) => listener())) };
}

test('embedded frames follow the board scheme and reload when Obsidian switches light/dark', async () => {
	const { app, listeners, cssChange } = host();
	const root = document.body.appendChild(document.createElement('div'));
	root.className = 'nand-dashboard-root';
	root.style.setProperty('--db-bg', '#ffffff');
	const column = { name: 'Web', webConfig: { url: 'https://example.com/' } } as unknown as DashboardColumn;
	const view = render(<WebPanel app={app} root={root} column={column} reloadRegister={() => {}} />, { container: root });
	const frame = await vi.waitFor(() => {
		const element = root.querySelector('iframe');
		expect(element).not.toBeNull();
		return element!;
	});
	expect(frame.style.colorScheme).toBe('light');

	// Chromium only gives a light page an opaque canvas when the frame loads with a different scheme.
	root.style.setProperty('--db-bg', '#1c1c1c');
	cssChange();
	const dark = root.querySelector('iframe')!;
	expect(dark.style.colorScheme).toBe('dark');
	expect(dark).not.toBe(frame);
	expect(dark.getAttribute('src')).toBe('https://example.com/');

	view.unmount();
	expect(listeners.size).toBe(0);
});
