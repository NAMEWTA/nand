// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/music-widget.ts
import { RecordButton } from '../dialogs/RecordButton';
import { p2Classes } from '../theme/p2-classes';
import { Popover, PopoverAnchor, PopoverContent } from '../../../../ui/components/popover';
import { useDashboardAppearance, useDashboardTheme, useDashboardLayout } from '../theme/ThemeBridge';
import { Input } from '../../../../ui/components/input';
import { Slider } from '../../../../ui/components/slider';
import { Notice } from 'obsidian';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MusicTrack } from '../../core/board/types';
import type { MusicService } from '../../platform/music/music-service';
import { musicMediaBlob } from '../../platform/music/media-bytes';
import { fetchLyric, isPlayableByFee, searchMusic, type LyricLine } from '../../platform/music/netease-client';
import { t } from '../../../../shared/i18n';
import { ObsidianIcon as Icon } from '../../../../ui/components/nand/ObsidianIcon';
function time(sec: number): string {
	const s = Math.max(0, Math.floor(sec));
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export function MusicPanel({
	service,
	root,
	background,
}: {
	service: MusicService;
	root: HTMLElement;
	background?: () => void;
}) {
	const appearance = useDashboardAppearance(true),
		theme = useDashboardTheme(),
		layout = useDashboardLayout(),
		opener = useRef<HTMLElement | null>(null);
	const anchor = useMemo(
		() => ({
			current: {
				getBoundingClientRect: () =>
					(root.closest('.dashboard-sidebar-widget') ?? root).getBoundingClientRect(),
				contextElement: root,
			},
		}),
		[root],
	);
	const [, refresh] = useState(0),
		[panel, setPanel] = useState<'none' | 'playlist' | 'search'>('none'),
		[volume, setVolume] = useState(false),
		[lyricResult, setLyrics] = useState<{ id: number; lines: LyricLine[] } | null>(null),
		[failedCover, setFailedCover] = useState(''),
		[cover, setCover] = useState<{ source: string; url: string } | null>(null);
	useLayoutEffect(() => service.subscribe(() => refresh((n) => n + 1)), [service]);
	const state = service.getState(),
		track = state.current,
		trackId = track?.id;
	useLayoutEffect(() => {
		let active = true,
			objectUrl = '';
		if (track?.picUrl)
			void musicMediaBlob(track.picUrl, 'image/jpeg')
				.then((blob) => {
					if (!active) return;
					objectUrl = URL.createObjectURL(blob);
					setCover({ source: track.picUrl!, url: objectUrl });
					setFailedCover('');
				})
				.catch(() => {
					if (active) setFailedCover(track.picUrl!);
				});
		return () => {
			active = false;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, [track?.picUrl]);
	useLayoutEffect(() => {
		let active = true;
		if (trackId != null)
			void fetchLyric(trackId)
				.then((lines) => {
					if (active) setLyrics({ id: trackId, lines });
				})
				.catch(() => {});
		return () => {
			active = false;
		};
	}, [trackId]);
	const coverUrl = cover?.source === track?.picUrl ? (cover?.url ?? '') : '';
	const lyrics = lyricResult?.id === trackId ? (lyricResult?.lines ?? []) : [];
	let lyric = '';
	for (const line of lyrics) {
		if (line.timeMs > state.positionSec * 1000) break;
		lyric = line.text;
	}
	const duration = Math.max(0, state.durationSec),
		position = Math.min(state.positionSec, duration),
		playing = state.status === 'playing';
	const button = (icon: string, label: string, action: () => void, extra = '') => (
		<RecordButton
			variant="ghost"
			className={p2Classes(`dashboard-sidebar-music-icon-btn${extra}`)}
			role="button"
			aria-label={t(label)}
			onClick={(e) => {
				e.stopPropagation();
				opener.current = e.currentTarget;
				action();
			}}
		>
			<Icon name={icon} />
		</RecordButton>
	);
	return (
		<Popover
			open={panel !== 'none'}
			onOpenChange={(open) => {
				if (!open) setPanel('none');
			}}
		>
			<PopoverAnchor virtualRef={anchor} />
			<div className={p2Classes('dashboard-sidebar-music-top')}>
				<Icon className={p2Classes('dashboard-sidebar-music-title-icon')} name="music" />
				<div className={p2Classes('dashboard-sidebar-music-lyric')}>{lyric}</div>
				{button('search', 'music.search', () => setPanel(panel === 'search' ? 'none' : 'search'))}
				{button('list', 'music.playlist', () => setPanel(panel === 'playlist' ? 'none' : 'playlist'))}
				{background && (
					<RecordButton
						variant="ghost"
						className={p2Classes('dashboard-widget-inline-cfg-btn')}
						role="button"
						aria-label={t('wbg.title')}
						onClick={background}
					>
						<Icon name="settings" />
					</RecordButton>
				)}
			</div>
			<div className={p2Classes('dashboard-sidebar-music-now')}>
				<div className={p2Classes('dashboard-sidebar-music-cover')}>
					<img
						key={coverUrl}
						className={p2Classes('dashboard-sidebar-music-cover-img')}
						src={coverUrl || undefined}
						loading="lazy"
						alt={track?.name ?? ''}
						hidden={!coverUrl || failedCover === coverUrl}
						onError={() => setFailedCover(coverUrl)}
					/>
					<Icon className={p2Classes('dashboard-sidebar-music-cover-glyph')} name="music" />
				</div>
				<div className={p2Classes('dashboard-sidebar-music-info')}>
					<div className={p2Classes('dashboard-sidebar-music-name')}>{track?.name ?? t('music.noTrack')}</div>
					<div className={p2Classes('dashboard-sidebar-music-artist')}>
						{track?.artist ?? t('music.emptyHint')}
					</div>
				</div>
			</div>
			<div className={p2Classes('dashboard-sidebar-music-progress')}>
				<div className={p2Classes('dashboard-sidebar-music-time')}>{time(position)}</div>
				<div
					className={p2Classes('dashboard-progress dashboard-sidebar-music-bar')}
					role="slider"
					tabIndex={0}
					aria-label={t('music.play')}
					aria-valuemin={0}
					aria-valuemax={duration}
					aria-valuenow={position}
					onKeyDown={(e) => {
						if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
							e.preventDefault();
							service.seek(Math.max(0, Math.min(duration, position + (e.key === 'ArrowRight' ? 5 : -5))));
						}
					}}
					onClick={(e) => {
						e.stopPropagation();
						const rect = e.currentTarget.getBoundingClientRect();
						if (rect.width > 0)
							service.seek(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) * duration);
					}}
				>
					<div className={p2Classes('dashboard-progress-bar')}>
						<div
							className={p2Classes('dashboard-progress-fill')}
							style={{ width: `${duration > 0 ? (position / duration) * 100 : 0}%` }}
						/>
					</div>
				</div>
				<div className={p2Classes('dashboard-sidebar-music-time')}>
					{duration > 0 ? time(duration) : '--:--'}
				</div>
			</div>
			<div className={p2Classes('dashboard-sidebar-music-controls')}>
				{button('skip-back', 'music.prev', () => service.prev())}
				{button(
					playing ? 'pause' : 'play',
					playing ? 'music.pause' : 'music.play',
					() => service.togglePlay(),
					' dashboard-sidebar-music-play',
				)}
				{button('skip-forward', 'music.next', () => service.next(false))}
				<div className={p2Classes('dashboard-sidebar-music-top-spacer')} />
				{button(
					state.mode === 'one' ? 'repeat-1' : state.mode === 'shuffle' ? 'shuffle' : 'repeat',
					state.mode === 'one'
						? 'music.modeOne'
						: state.mode === 'shuffle'
							? 'music.modeShuffle'
							: 'music.modeList',
					() => {
						const modes = ['list', 'one', 'shuffle'] as const;
						service.setMode(modes[(modes.indexOf(state.mode) + 1) % 3]!);
					},
				)}
				{button('volume-2', 'music.volume', () => setVolume(!volume))}
				<div className={p2Classes('dashboard-sidebar-music-vol-area')}>
					{volume && (
						<Slider
							aria-label={t('music.volume')}
							min={0}
							max={100}
							value={[Math.round(state.volume * 100)]}
							onValueChange={(v) => service.setVolume((v[0] ?? 0) / 100)}
						/>
					)}
				</div>
			</div>
			<PopoverContent
				ref={appearance}
				data-theme={theme}
				data-dashboard-layout={layout}
				side="bottom"
				align="start"
				sideOffset={6}
				collisionPadding={8}
				className={p2Classes('nand-dashboard-root dashboard-sidebar-music-popover')}
				style={{
					position: 'relative',
					zIndex: 'var(--layer-popover)',
					width: 'var(--radix-popover-trigger-width)',
				}}
				onCloseAutoFocus={(event) => {
					event.preventDefault();
					if (opener.current?.isConnected) opener.current.focus();
				}}
			>
				<div className={p2Classes('dashboard-sidebar-music-popover-body')}>
					{panel === 'playlist' ? (
						<>
							{!state.playlist.length && (
								<div className={p2Classes('dashboard-sidebar-music-empty')}>
									{t('music.emptyPlaylist')}
								</div>
							)}
							{state.playlist.map((item, index) => (
								<div
									key={`${item.id}:${index}`}
									className={p2Classes(
										`dashboard-sidebar-music-row${index === state.currentIndex ? ' dashboard-sidebar-music-row--active' : ''}${isPlayableByFee(item.fee, service.account.loggedIn) ? '' : ' dashboard-sidebar-music-row--vip'}`,
									)}
								>
									{index === state.currentIndex && (
										<Icon
											className={p2Classes('dashboard-sidebar-music-row-play')}
											name={playing ? 'volume-2' : 'pause'}
										/>
									)}
									<RecordButton
										variant="ghost"
										className="flex min-w-0 flex-1 items-center"
										onClick={() => service.play(index)}
									>
										<TrackLabel track={item} />
									</RecordButton>
									<RecordButton
										variant="ghost"
										aria-label={t('common.delete')}
										className={p2Classes('dashboard-sidebar-music-row-del')}
										role="button"
										onClick={(e) => {
											e.stopPropagation();
											service.removeFromPlaylist(index);
										}}
									>
										<Icon name="x" />
									</RecordButton>
								</div>
							))}
							<div className={p2Classes('dashboard-sidebar-music-panel-foot')}>
								<RecordButton
									variant="ghost"
									className={p2Classes('dashboard-sidebar-music-text-btn')}
									role="button"
									onClick={() => service.clearPlaylist()}
								>
									{t('music.clear')}
								</RecordButton>
							</div>
						</>
					) : panel === 'search' ? (
						<MusicSearch service={service} win={root.ownerDocument.defaultView!} playingId={trackId} />
					) : null}
				</div>
			</PopoverContent>
		</Popover>
	);
}
function TrackLabel({ track }: { track: MusicTrack }) {
	return (
		<>
			<div className={p2Classes('dashboard-sidebar-music-row-label')}>
				<div className={p2Classes('dashboard-sidebar-music-row-name')}>{track.name}</div>
				<div className={p2Classes('dashboard-sidebar-music-row-sub')}>{track.artist}</div>
			</div>
			{!isPlayableByFee(track.fee) && <div className={p2Classes('dashboard-sidebar-music-vip-badge')}>VIP</div>}
		</>
	);
}
function MusicSearch({ service, win, playingId }: { service: MusicService; win: Window; playingId?: number }) {
	const [query, setQuery] = useState(''),
		[results, setResults] = useState<MusicTrack[]>([]),
		[source, setSource] = useState(''),
		[busy, setBusy] = useState(false),
		[submitted, setSubmitted] = useState(0),
		immediate = useRef(false),
		pending = useRef(false),
		input = useRef<HTMLInputElement>(null);
	useLayoutEffect(() => {
		input.current?.focus();
	}, []);
	useLayoutEffect(() => {
		let active = true;
		const wait = immediate.current ? 0 : 400;
		immediate.current = false;
		const timer = win.setTimeout(() => {
			if (!query.trim()) {
				setResults([]);
				return;
			}
			void searchMusic(query.trim())
				.then((tracks) => {
					if (active) setResults(tracks);
				})
				.catch(() => {
					if (active) new Notice(t('music.networkError'));
				});
		}, wait);
		return () => {
			active = false;
			win.clearTimeout(timer);
		};
	}, [query, submitted, win]);
	const load = async () => {
		if (pending.current || !source.trim()) return;
		pending.current = true;
		setBusy(true);
		try {
			const count = await service.importPlaylist(source.trim());
			new Notice(t('music.importSuccess', { count }));
			setSource('');
		} catch (error) {
			new Notice(t('music.importFailed', { message: error instanceof Error ? error.message : String(error) }));
		} finally {
			pending.current = false;
			setBusy(false);
		}
	};
	return (
		<>
			<Input
				ref={input}
				className={p2Classes('dashboard-sidebar-music-search-input')}
				placeholder={t('music.searchPlaceholder')}
				value={query}
				onInput={(e) => setQuery(e.currentTarget.value)}
				onKeyDown={(e) => {
					if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
						e.preventDefault();
						immediate.current = true;
						setSubmitted((n) => n + 1);
					}
				}}
			/>
			<div className={p2Classes('dashboard-sidebar-music-results')}>
				{results.slice(0, 30).map((track) => (
					<div key={track.id} className={p2Classes('dashboard-sidebar-music-row')}>
						<RecordButton
							variant="ghost"
							className="flex min-w-0 flex-1 items-center"
							onClick={() => service.addAndPlay([track])}
						>
							<TrackLabel track={track} />
						</RecordButton>
						<RecordButton
							variant="ghost"
							aria-label={t('common.add')}
							className={p2Classes('dashboard-sidebar-music-row-del')}
							role="button"
							onClick={(e) => {
								e.stopPropagation();
								service.addToPlaylist([track]);
								new Notice(t('music.added'));
							}}
						>
							<Icon name={track.id === playingId ? 'check' : 'plus'} />
						</RecordButton>
					</div>
				))}
			</div>
			<div className={p2Classes('dashboard-sidebar-music-import-row')}>
				<Input
					className={p2Classes('dashboard-sidebar-music-import-input')}
					placeholder={t('music.importPlaceholder')}
					value={source}
					onInput={(e) => setSource(e.currentTarget.value)}
				/>
				<RecordButton
					variant="ghost"
					className={p2Classes('dashboard-sidebar-music-text-btn')}
					disabled={busy}
					onClick={() => void load()}
				>
					{t('music.import')}
				</RecordButton>
			</div>
		</>
	);
}
