import type { App } from 'obsidian';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { DashboardSettings } from '../../../core/dashboard/types';
import { t } from '../../../shared/i18n';
import { Icon } from '../../primitives/Icon';
import { resolveVaultImage } from '../banner/banner';
import {
	ALBUM_FADE_MS,
	TRANSITION_CLASSES,
	basename,
	clampIntervalSec,
	listAlbumImages,
	normalizeAlbumFolder,
	normalizeTransition,
} from './album-model';
export const albumControllers = new WeakMap<HTMLElement, { setImages: (images: string[]) => void }>();
export function AlbumPanel({ root, settings, app }: { root: HTMLElement; settings: DashboardSettings; app: App }) {
	const interval = clampIntervalSec(settings.widgetAlbumIntervalSec) * 1000,
		transition = normalizeTransition(settings.widgetAlbumTransition);
	const [images, setImages] = useState(() =>
		listAlbumImages(app, settings.widgetAlbumFolder, settings.widgetAlbumRecursive),
	);
	const [index, setIndex] = useState(() => (images.length ? Math.floor(Date.now() / interval) % images.length : 0));
	const [previous, setPrevious] = useState<string | null>(null),
		[phase, setPhase] = useState<'idle' | 'start' | 'run'>('idle');
	const paused = useRef(false),
		changing = useRef(false),
		[reset, resetTimer] = useState(0);
	const win = root.ownerDocument.defaultView!;
	const current = images[index],
		src = current ? resolveVaultImage(app, current) : null;
	const state = useRef({ images, index });
	state.current = { images, index };
	useLayoutEffect(() => {
		albumControllers.set(root, {
			setImages: (next) => {
				const old = state.current;
				if (next.length === old.images.length && next.every((path, i) => path === old.images[i])) return;
				const at = next.indexOf(old.images[old.index] ?? '');
				setImages(next);
				setIndex(at >= 0 ? at : Math.max(0, Math.min(old.index, next.length - 1)));
				setPhase('idle');
				setPrevious(null);
				changing.current = false;
			},
		});
		return () => albumControllers.delete(root);
	}, [root]);
	const advance = (delta: number) => {
		const live = state.current;
		if (changing.current || live.images.length < 2) return;
		let target = (live.index + delta + live.images.length) % live.images.length;
		for (let i = 0; i < live.images.length; i++) {
			const candidate = (target + i) % live.images.length;
			if (resolveVaultImage(app, live.images[candidate]!)) {
				target = candidate;
				break;
			}
		}
		if (target === live.index) return;
		changing.current = true;
		setPrevious(live.images[live.index] ?? null);
		setIndex(target);
		setPhase('start');
	};
	useLayoutEffect(() => {
		if (images.length < 2) return;
		const timer = win.setInterval(() => {
			if (!root.isConnected) {
				win.clearInterval(timer);
				return;
			}
			if (!paused.current) advance(1);
		}, interval);
		return () => win.clearInterval(timer);
	}, [win, interval, images, reset]);
	useLayoutEffect(() => {
		if (phase === 'idle') return;
		if (phase === 'start') {
			const frame = win.requestAnimationFrame(() => {
				root.getBoundingClientRect();
				setPhase('run');
			});
			return () => win.cancelAnimationFrame(frame);
		}
		const timer = win.setTimeout(() => {
			setPhase('idle');
			setPrevious(null);
			changing.current = false;
		}, ALBUM_FADE_MS);
		return () => win.clearTimeout(timer);
	}, [phase, win]);
	useLayoutEffect(() => {
		root.toggleClass('dashboard-sidebar-album--empty', !src);
		root.toggleClass('dashboard-sidebar-album--single', images.length < 2);
		if (images.length > 1) {
			const next = resolveVaultImage(app, images[(index + 1) % images.length]!);
			if (next) {
				const image = root.ownerDocument.createElement('img');
				image.src = next;
			}
		}
	}, [src, images, index, root]);
	const anim = TRANSITION_CLASSES[transition];
	return (
		<div class="dashboard-sidebar-album-body">
			{!src ? (
				<div class="dashboard-sidebar-album-placeholder">
					<Icon className="dashboard-sidebar-album-placeholder-icon" name="image" />
					<div class="dashboard-sidebar-album-placeholder-text">
						{t(
							normalizeAlbumFolder(settings.widgetAlbumFolder)
								? 'album.placeholderEmpty'
								: 'album.placeholderUnset',
						)}
					</div>
				</div>
			) : (
				<div
					class={`dashboard-sidebar-album-frame dashboard-sidebar-album-frame--${transition}`}
					onMouseEnter={() => {
						paused.current = true;
					}}
					onMouseLeave={() => {
						paused.current = false;
					}}
				>
					<img
						class={`dashboard-sidebar-album-layer dashboard-sidebar-album-layer--top${phase === 'start' ? ` dashboard-sidebar-album-layer--instant ${anim.start}` : ''}`}
						src={src}
						alt={basename(current!)}
						draggable={false}
					/>
					<img
						class={`dashboard-sidebar-album-layer dashboard-sidebar-album-layer--bottom${previous ? (phase === 'run' && anim.out ? ` ${anim.out}` : '') : ' dashboard-sidebar-album-layer--instant dashboard-sidebar-album-layer--start-fade'}`}
						src={previous ? (resolveVaultImage(app, previous) ?? undefined) : undefined}
						draggable={false}
					/>
					<div class="dashboard-sidebar-album-index">
						{index + 1}/{images.length}
					</div>
					{([-1, 1] as const).map((delta) => (
						<button
							key={delta}
							class={`dashboard-sidebar-album-nav dashboard-sidebar-album-nav--${delta < 0 ? 'prev' : 'next'}`}
							aria-label={t(delta < 0 ? 'album.prev' : 'album.next')}
							onClick={(e) => {
								e.stopPropagation();
								advance(delta);
								resetTimer((n) => n + 1);
							}}
						>
							<Icon name={delta < 0 ? 'chevron-left' : 'chevron-right'} />
						</button>
					))}
				</div>
			)}
		</div>
	);
}
