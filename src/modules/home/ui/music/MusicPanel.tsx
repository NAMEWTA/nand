import { Notice } from 'obsidian';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { MusicTrack } from '../../core/board/types';
import type { MusicService } from '../../platform/music/music-service';
import {
	fetchLyric,
	isPlayableByFee,
	searchMusic,
	type LyricLine,
} from '../../platform/music/netease-client';
import { t } from '../../../../shared/i18n';
import { Icon } from '../../../../ui/primitives/Icon';
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
	const [, refresh] = useState(0),
		[panel, setPanel] = useState<'none' | 'playlist' | 'search'>('none'),
		[volume, setVolume] = useState(false),
		[lyrics, setLyrics] = useState<LyricLine[]>([]),
		[failedCover, setFailedCover] = useState('');
	useLayoutEffect(() => service.subscribe(() => refresh((n) => n + 1)), [service]);
	const state = service.getState(),
		track = state.current,
		trackId = track?.id;
	useLayoutEffect(() => {
		let active = true;
		setLyrics([]);
		if (trackId != null)
			void fetchLyric(trackId)
				.then((lines) => {
					if (active) setLyrics(lines);
				})
				.catch(() => {});
		return () => {
			active = false;
		};
	}, [trackId]);
	let lyric = '';
	for (const line of lyrics) {
		if (line.timeMs > state.positionSec * 1000) break;
		lyric = line.text;
	}
	const duration = Math.max(0, state.durationSec),
		position = Math.min(state.positionSec, duration),
		playing = state.status === 'playing';
	const button = (icon: string, label: string, action: () => void, extra = '') => (
		<div
			class={`dashboard-sidebar-music-icon-btn${extra}`}
			role="button"
			aria-label={t(label)}
			onClick={(e) => {
				e.stopPropagation();
				action();
			}}
		>
			<Icon name={icon} />
		</div>
	);
	return (
		<>
			<div class="dashboard-sidebar-music-top">
				<Icon className="dashboard-sidebar-music-title-icon" name="music" />
				<div class="dashboard-sidebar-music-lyric">{lyric}</div>
				{button('search', 'music.search', () => setPanel(panel === 'search' ? 'none' : 'search'))}
				{button('list', 'music.playlist', () => setPanel(panel === 'playlist' ? 'none' : 'playlist'))}
				{background && (
					<div
						class="dashboard-widget-inline-cfg-btn"
						role="button"
						aria-label={t('wbg.title')}
						onClick={background}
					>
						<Icon name="settings" />
					</div>
				)}
			</div>
			<div class="dashboard-sidebar-music-now">
				<div class="dashboard-sidebar-music-cover">
					<img
						class="dashboard-sidebar-music-cover-img"
						src={track?.picUrl || undefined}
						loading="lazy"
						hidden={!track?.picUrl || failedCover === track.picUrl}
						onError={() => setFailedCover(track?.picUrl ?? '')}
					/>
					<Icon className="dashboard-sidebar-music-cover-glyph" name="music" />
				</div>
				<div class="dashboard-sidebar-music-info">
					<div class="dashboard-sidebar-music-name">{track?.name ?? t('music.noTrack')}</div>
					<div class="dashboard-sidebar-music-artist">{track?.artist ?? t('music.emptyHint')}</div>
				</div>
			</div>
			<div class="dashboard-sidebar-music-progress">
				<div class="dashboard-sidebar-music-time">{time(position)}</div>
				<div
					class="dashboard-progress dashboard-sidebar-music-bar"
					onClick={(e) => {
						e.stopPropagation();
						const rect = e.currentTarget.getBoundingClientRect();
						if (rect.width > 0)
							service.seek(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) * duration);
					}}
				>
					<div class="dashboard-progress-bar">
						<div
							class="dashboard-progress-fill"
							style={{ width: `${duration > 0 ? (position / duration) * 100 : 0}%` }}
						/>
					</div>
				</div>
				<div class="dashboard-sidebar-music-time">{duration > 0 ? time(duration) : '--:--'}</div>
			</div>
			<div class="dashboard-sidebar-music-controls">
				{button('skip-back', 'music.prev', () => service.prev())}
				{button(
					playing ? 'pause' : 'play',
					playing ? 'music.pause' : 'music.play',
					() => service.togglePlay(),
					' dashboard-sidebar-music-play',
				)}
				{button('skip-forward', 'music.next', () => service.next(false))}
				<div class="dashboard-sidebar-music-top-spacer" />
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
				<div class="dashboard-sidebar-music-vol-area">
					{volume && (
						<input
							type="range"
							min="0"
							max="100"
							value={Math.round(state.volume * 100)}
							onInput={(e) => service.setVolume(Number(e.currentTarget.value) / 100)}
						/>
					)}
				</div>
			</div>
			<div class="dashboard-sidebar-music-panel">
				{panel === 'playlist' ? (
					<>
						{!state.playlist.length && (
							<div class="dashboard-sidebar-music-empty">{t('music.emptyPlaylist')}</div>
						)}
						{state.playlist.map((item, index) => (
							<div
								key={`${item.id}:${index}`}
								class={`dashboard-sidebar-music-row${index === state.currentIndex ? ' dashboard-sidebar-music-row--active' : ''}${isPlayableByFee(item.fee, service.account.loggedIn) ? '' : ' dashboard-sidebar-music-row--vip'}`}
								onClick={() => service.play(index)}
							>
								{index === state.currentIndex && (
									<Icon
										className="dashboard-sidebar-music-row-play"
										name={playing ? 'volume-2' : 'pause'}
									/>
								)}
								<TrackLabel track={item} />
								<div
									class="dashboard-sidebar-music-row-del"
									role="button"
									onClick={(e) => {
										e.stopPropagation();
										service.removeFromPlaylist(index);
									}}
								>
									<Icon name="x" />
								</div>
							</div>
						))}
						<div class="dashboard-sidebar-music-panel-foot">
							<div
								class="dashboard-sidebar-music-text-btn"
								role="button"
								onClick={() => service.clearPlaylist()}
							>
								{t('music.clear')}
							</div>
						</div>
					</>
				) : panel === 'search' ? (
					<MusicSearch service={service} win={root.ownerDocument.defaultView!} playingId={trackId} />
				) : null}
			</div>
		</>
	);
}
function TrackLabel({ track }: { track: MusicTrack }) {
	return (
		<>
			<div class="dashboard-sidebar-music-row-label">
				<div class="dashboard-sidebar-music-row-name">{track.name}</div>
				<div class="dashboard-sidebar-music-row-sub">{track.artist}</div>
			</div>
			{!isPlayableByFee(track.fee) && <div class="dashboard-sidebar-music-vip-badge">VIP</div>}
		</>
	);
}
function MusicSearch({ service, win, playingId }: { service: MusicService; win: Window; playingId?: number }) {
	const [query, setQuery] = useState(''),
		[results, setResults] = useState<MusicTrack[]>([]),
		[source, setSource] = useState(''),
		[busy, setBusy] = useState(false),
		pending = useRef(false),
		input = useRef<HTMLInputElement>(null);
	useLayoutEffect(() => {
		input.current?.focus();
	}, []);
	useLayoutEffect(() => {
		let active = true;
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
		}, 400);
		return () => {
			active = false;
			win.clearTimeout(timer);
		};
	}, [query, win]);
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
			<input
				ref={input}
				class="dashboard-sidebar-music-search-input"
				placeholder={t('music.searchPlaceholder')}
				value={query}
				onInput={(e) => setQuery(e.currentTarget.value)}
			/>
			<div class="dashboard-sidebar-music-results">
				{results.slice(0, 30).map((track) => (
					<div key={track.id} class="dashboard-sidebar-music-row" onClick={() => service.addAndPlay([track])}>
						<TrackLabel track={track} />
						<div
							class="dashboard-sidebar-music-row-del"
							role="button"
							onClick={(e) => {
								e.stopPropagation();
								service.addToPlaylist([track]);
								new Notice(t('music.added'));
							}}
						>
							<Icon name={track.id === playingId ? 'check' : 'plus'} />
						</div>
					</div>
				))}
			</div>
			<div class="dashboard-sidebar-music-import-row">
				<input
					class="dashboard-sidebar-music-import-input"
					placeholder={t('music.importPlaceholder')}
					value={source}
					onInput={(e) => setSource(e.currentTarget.value)}
				/>
				<button class="dashboard-sidebar-music-text-btn" disabled={busy} onClick={() => void load()}>
					{t('music.import')}
				</button>
			</div>
		</>
	);
}
