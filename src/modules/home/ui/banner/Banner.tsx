// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/banner.ts, src/view.ts
import { useState, type CSSProperties } from 'react';
import { useStore } from 'zustand';
import { Bookmark, Pin, PinOff, WandSparkles, Ellipsis, PanelLeft } from 'lucide-react';
import type { NativeSurfaceContext } from '../../../../ui/native-surface';
import { useT } from '../../../../ui/react/hooks';
import type { BoardStore } from '../../services/board-store';
import { focalPosition } from '../../core/board/focal-point';
import { IconButton } from '../board/controls';
import { useClock, useImage } from '../board/hooks';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { BannerEditDialog } from './BannerEditDialog';
import { p1Classes } from '../theme/p1-classes';
import { BannerStats } from './BannerStats';
export function Banner({
	store,
	context,
	mobile,
}: {
	store: BoardStore;
	context: NativeSurfaceContext;
	mobile: boolean;
}) {
	const { data, settings } = useStore(store.state),
		t = useT(),
		clock = useClock(30000),
		[edit, setEdit] = useState(false);
	const banner = data!.banner,
		imageList = banner.images?.length ? banner.images : [banner.image],
		path = imageList[Math.floor(clock / 1800000) % imageList.length] ?? '',
		url = useImage(store, path);
	const quotes = banner.quotes?.length ? banner.quotes : [{ quote: banner.quote, author: banner.author }],
		quote = quotes[Math.floor(clock / 30000) % quotes.length];
	return (
		<>
			<header
				className={`${banner.mode === 'stats' ? p1Classes('dashboard-banner--stats') : ''} dashboard-banner group relative mx-4 mb-2 shrink-0 rounded-[var(--db-radius-lg)] ${banner.mode === 'stats' ? '' : 'bg-[var(--db-bg-banner)]'} bg-cover bg-center ${settings.bannerCollapsed ? 'h-1' : 'h-[120px] overflow-hidden'}`}
				style={
					{
						backgroundImage: url ? `url(${JSON.stringify(url)})` : undefined,
						backgroundPosition: focalPosition(banner.imagePos?.[path]),
						'--banner-blur': mobile ? '0px' : `${banner.statsConfig?.blur ?? 2}px`,
						'--banner-bright': Math.max(0.3, 1 - ((banner.statsConfig?.darkness ?? 20) / 100) * 0.7),
						'--banner-scrim': 0.25 + ((banner.statsConfig?.darkness ?? 20) / 100) * 0.5,
						'--banner-stat-accent': banner.statsConfig?.accent ?? 'var(--db-banner-stat-default-accent)',
					} as CSSProperties
				}
			>
				{!settings.bannerCollapsed && banner.mode === 'stats' && (
					<>
						<BannerStats store={store} />
					</>
				)}
				{!settings.bannerCollapsed && banner.mode !== 'stats' && (
					<div className="dashboard-banner-overlay absolute inset-0 flex items-center justify-center px-12 py-5 text-center">
						<div>
							<p
								className="m-0 mb-2 text-[1.2em] leading-[1.4] text-[var(--db-text-inverse)] italic"
								style={{ color: banner.quoteColor, fontFamily: banner.quoteFont }}
							>
								{quote?.quote}
							</p>
							<cite
								className="text-[.8em] text-[var(--db-text-inverse-muted)] not-italic"
								style={{ color: banner.quoteColor, fontFamily: banner.quoteFont }}
							>
								{quote?.author}
							</cite>
						</div>
					</div>
				)}
				<WorkspaceSwitcher store={store} />
				<div className="absolute top-1 right-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
					<IconButton label={t('home.dashboard.togglePanel')} onClick={() => context.togglePanel?.()}>
						<PanelLeft />
					</IconButton>
					<IconButton
						label={t('home.dashboard.pageMenu')}
						onClick={(e) => context.openPageMenu?.(e.nativeEvent)}
					>
						<Ellipsis />
					</IconButton>
					<IconButton
						label={t('home.dashboard.collapseBanner')}
						onClick={() => {
							void store.settings((s) => {
								s.bannerCollapsed = !s.bannerCollapsed;
							});
						}}
					>
						<Bookmark />
					</IconButton>
				</div>
				{!settings.bannerCollapsed && (
					<>
						<IconButton
							label={t('banner.editLabel')}
							className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
							onClick={() => setEdit(true)}
						>
							<WandSparkles />
						</IconButton>
						{!mobile && (
							<IconButton
								label={t('home.dashboard.pin')}
								className="absolute bottom-2 left-2"
								onClick={() => {
									void store.settings((s) => {
										s.sidebarPinned = !s.sidebarPinned;
									});
								}}
							>
								{settings.sidebarPinned ? <Pin /> : <PinOff />}
							</IconButton>
						)}
					</>
				)}
			</header>
			{edit && <BannerEditDialog store={store} banner={banner} onClose={() => setEdit(false)} />}
		</>
	);
}
