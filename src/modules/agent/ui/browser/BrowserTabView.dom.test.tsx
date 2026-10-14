import { act, render, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { TestProviders } from '../../../../ui/react/test-providers';
import { useOwnerDocument } from '../../../../ui/react/contexts';
import { BrowserTabView } from './BrowserTabView';
import type { BrowserTabData } from '../../core/workspace/model';
const fixture = vi.hoisted(() => ({ controller: {} as object }));
vi.mock('../workspace/workspace-context', () => ({ useWorkspaceUI: () => ({ controller: fixture.controller }) }));
it('remounts the existing page when Obsidian adopts its container into another Document', async () => {
	Object.defineProperty(document.body, 'win', { configurable: true, value: window });
	const container = document.body.appendChild(document.createElement('div'));
	const iframe = document.body.appendChild(document.createElement('iframe'));
	const target = iframe.contentDocument!;
	const mounted: Document[] = [];
	const page = {
		store: createStore(() => ({})),
		mount: vi.fn((el: HTMLElement) => mounted.push(el.ownerDocument)),
		unmount: vi.fn(),
	};
	function Chrome() {
		const owner = useOwnerDocument();
		return <span data-chrome-owner={owner === document ? 'main' : 'popout'} />;
	}
	const host = { getPage: () => page, renderChrome: async () => <Chrome /> };
	fixture.controller = {
		app: { workspace: { containerEl: document.body, on: vi.fn(), offref: vi.fn() } },
		browserHost: () => host,
		workspace: { updateBrowser: vi.fn() },
	};
	const tab = {
		id: 'tab',
		pageId: 'page',
		kind: 'browser',
		url: 'https://example.com',
		profileId: 'default',
		zoom: 1,
	} as BrowserTabData;
	function Owner() {
		// Simulate an ancestor observer lost when its popout closes.
		const doc = document;
		return (
			<TestProviders ownerDocument={doc}>
				<BrowserTabView tab={tab} active />
			</TestProviders>
		);
	}
	const view = render(<Owner />, { container });
	await waitFor(() => expect(mounted).toEqual([document]));
	await act(async () => {
		target.body.appendChild(container);
	});
	await waitFor(() => expect(mounted).toEqual([document, target]));
	await act(async () => {
		document.body.appendChild(container);
	});
	await waitFor(() => expect(mounted).toEqual([document, target, document]));
	await waitFor(() =>
		expect(container.querySelector('[data-chrome-owner]')?.getAttribute('data-chrome-owner')).toBe('main'),
	);
	view.unmount();
	iframe.remove();
	container.remove();
	expect(page.unmount).toHaveBeenCalledTimes(3);
});
