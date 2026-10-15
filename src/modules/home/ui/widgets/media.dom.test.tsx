import { afterEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { createStore } from 'zustand/vanilla';
import { memoryVault } from '../../../../../scripts/fixtures/memory-vault';
import { TestProviders } from '../../../../ui/react/test-providers';
import { VisibilityContext } from '../../../../ui/react/contexts';
import { DEFAULT_DASHBOARD_SETTINGS } from '../../core/board/types';
import type { BoardStore } from '../../services/board-store';
import { AlbumPanel, albumControllers } from './AlbumPanel';
import { AlbumWidget } from './AlbumWidget';
import { listAlbumImages } from './album-model';
import { MusicPanel } from '../music/MusicPanel';
import type { MusicService } from '../../platform/music/music-service';
import { musicMediaBlob } from '../../platform/music/media-bytes';
import { t } from '../../../../shared/i18n';
afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});
vi.mock('../banner/image-resource', () => ({
	resolveVaultImage: (_app: unknown, path: string) => `app://vault/${path}`,
}));
vi.mock('../../platform/music/media-bytes', () => ({ musicMediaBlob: vi.fn() }));
vi.mock('../../platform/music/netease-client', () => ({
	fetchLyric: vi.fn(async () => []),
	isPlayableByFee: () => true,
	searchMusic: vi.fn(async () => []),
}));
function fixture() {
	const vault = memoryVault(
		{
			'Photos/a2.png': 'image',
			'Photos/a10.jpg': 'image',
			'Photos/deep/b.png': 'image',
			'Photos/readme.md': 'text',
		},
		window,
	);
	const settings = {
		...structuredClone(DEFAULT_DASHBOARD_SETTINGS),
		widgetAlbumFolder: 'Photos',
		widgetAlbumRecursive: false,
		widgetAlbumIntervalSec: 8,
	};
	return { vault, settings };
}
test('album filters recursion and extensions, preserves photo on refresh, pauses and releases owner-window timer', async () => {
	const { vault, settings } = fixture();
	expect(listAlbumImages(vault.app, 'Photos', false)).toEqual(['Photos/a2.png', 'Photos/a10.jpg']);
	expect(listAlbumImages(vault.app, 'Photos', true)).toHaveLength(3);
	const interval = vi.spyOn(window, 'setInterval'),
		clear = vi.spyOn(window, 'clearInterval');
	let host: HTMLDivElement | null = null;
	function Scene() {
		const [root, setRoot] = useState<HTMLDivElement | null>(null);
		host = root;
		return <div ref={setRoot}>{root && <AlbumPanel root={root} app={vault.app} settings={settings} />}</div>;
	}
	const view = render(
		<TestProviders>
			<Scene />
		</TestProviders>,
	);
	expect(interval).toHaveBeenCalled();
	const before = host!.querySelector('img')!.getAttribute('src');
	act(() => albumControllers.get(host!)!.setImages(['Photos/a2.png', 'Photos/a10.jpg']));
	expect(host!.querySelector('img')!.getAttribute('src')).toBe(before);
	fireEvent.mouseEnter(host!.querySelector('.dashboard-sidebar-album-frame')!);
	const tick = interval.mock.calls.at(-1)![0] as () => void;
	act(() => tick());
	expect(host!.querySelector('img')!.getAttribute('src')).toBe(before);
	fireEvent.click(screen.getByRole('button', { name: t('album.next') }));
	expect(host!.querySelector('img')!.getAttribute('src')).not.toBe(before);
	view.unmount();
	expect(clear).toHaveBeenCalled();
	expect(albumControllers.get(host!)).toBeUndefined();
});
test('hiding an album page releases its rotation interval', () => {
	const { vault, settings } = fixture();
	settings.albums = [
		{
			id: 1,
			folder: 'Photos',
			recursive: false,
			intervalSec: 8,
			ratio: '1:1',
			transition: 'fade',
			heightRatio: 'full',
		},
	];
	const store = { host: { app: vault.app }, state: createStore(() => ({ settings })) } as unknown as BoardStore;
	const clear = vi.spyOn(window, 'clearInterval'),
		view = render(
			<TestProviders>
				<VisibilityContext value={true}>
					<AlbumWidget store={store} entryId="1" />
				</VisibilityContext>
			</TestProviders>,
		);
	view.rerender(
		<TestProviders>
			<VisibilityContext value={false}>
				<AlbumWidget store={store} entryId="1" />
			</VisibilityContext>
		</TestProviders>,
	);
	expect(clear).toHaveBeenCalled();
});
test('music controls and floating search release subscription and portal on unmount', async () => {
	const stop = vi.fn(),
		service = {
			subscribe: vi.fn(() => stop),
			getState: () => ({
				current: null,
				positionSec: 0,
				durationSec: 0,
				status: 'paused',
				mode: 'list',
				volume: 0.5,
				playlist: [],
				currentIndex: -1,
			}),
			account: { loggedIn: false },
			togglePlay: vi.fn(),
			prev: vi.fn(),
			next: vi.fn(),
			setMode: vi.fn(),
		} as unknown as MusicService;
	const root = document.createElement('div');
	document.body.append(root);
	const view = render(
		<TestProviders>
			<MusicPanel root={root} service={service} />
		</TestProviders>,
	);
	fireEvent.click(screen.getByRole('button', { name: t('music.play') }));
	expect(service.togglePlay).toHaveBeenCalledOnce();
	fireEvent.click(screen.getByRole('button', { name: t('music.next') }));
	expect(service.next).toHaveBeenCalledWith(false);
	fireEvent.click(screen.getByRole('button', { name: t('music.search') }));
	await waitFor(() =>
		expect(document.querySelector('.nand-portal-root .dashboard-sidebar-music-popover')).not.toBeNull(),
	);
	expect(root.querySelector('.dashboard-sidebar-music-popover')).toBeNull();
	view.unmount();
	expect(document.querySelector('.dashboard-sidebar-music-popover')).toBeNull();
	expect(stop).toHaveBeenCalledOnce();
	root.remove();
});

test('failed cover A recovers after B then A succeeds, releasing object URLs', async () => {
	const blob = vi.mocked(musicMediaBlob);
	blob.mockRejectedValueOnce(Error('offline')).mockResolvedValue(new Blob(['image']));
	vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:B').mockReturnValueOnce('blob:A');
	const revoke = vi.spyOn(URL, 'revokeObjectURL');
	let current = { id: 1, name: 'A', artist: 'artist', picUrl: 'https://fixture/A' };
	const service = {
		subscribe: () => () => {},
		getState: () => ({
			current,
			positionSec: 0,
			durationSec: 0,
			status: 'paused',
			mode: 'list',
			volume: 0.5,
			playlist: [],
			currentIndex: 0,
		}),
		account: { loggedIn: false },
	} as unknown as MusicService;
	const root = document.createElement('div'),
		scene = () => (
			<TestProviders>
				<MusicPanel root={root} service={service} />
			</TestProviders>
		);
	const view = render(scene());
	await act(async () => {});
	expect(view.container.querySelector('img')!.hidden).toBe(true);
	current = { ...current, id: 2, name: 'B', picUrl: 'https://fixture/B' };
	view.rerender(scene());
	await waitFor(() => expect(view.container.querySelector('img')!.src).toBe('blob:B'));
	current = { ...current, id: 1, name: 'A', picUrl: 'https://fixture/A' };
	view.rerender(scene());
	await waitFor(() => expect(view.container.querySelector('img')!.src).toBe('blob:A'));
	expect(view.container.querySelector('img')!.hidden).toBe(false);
	expect(revoke).toHaveBeenCalledWith('blob:B');
	view.unmount();
	expect(revoke).toHaveBeenCalledWith('blob:A');
});
