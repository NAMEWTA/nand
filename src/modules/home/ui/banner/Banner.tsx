// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/banner.ts, src/view.ts
import { useState, type CSSProperties } from 'react';
import { useStore } from 'zustand';
import { WandSparkles } from 'lucide-react';
import { useT } from '../../../../ui/react/hooks';
import type { BoardStore } from '../../services/board-store';
import { bannerOf } from '../../core/board/banner';
import { focalPosition } from '../../core/board/focal-point';
import { IconButton } from '../board/controls';
import { useClock, useImage } from '../board/hooks';
import { BannerEditDialog } from './BannerEditDialog';
import { p1Classes } from '../theme/p1-classes';
import { BannerStats } from './BannerStats';
/** The banner as a canvas widget: it fills its tile with the cover image and either the quote or the stats. */
export function Banner({ store, entryId, mobile = false }: { store: BoardStore; entryId?: string; mobile?: boolean }) {
	const { data } = useStore(store.state),
		t = useT(),
		clock = useClock(30000),
		[edit, setEdit] = useState(false);
	const banner = bannerOf(data!, entryId),
		imageList = banner.images?.length ? banner.images : [banner.image],
		path = imageList[Math.floor(clock / 1800000) % imageList.length] ?? '',
		url = useImage(store, path);
	const quotes = banner.quotes?.length ? banner.quotes : [{ quote: banner.quote, author: banner.author }],
		quote = quotes[Math.floor(clock / 30000) % quotes.length];
	return (
		<>
			<header
				className={`${banner.mode === 'stats' ? p1Classes('dashboard-banner--stats') : ''} dashboard-banner group relative h-full min-h-[48px] overflow-hidden rounded-[inherit] ${banner.mode === 'stats' ? '' : 'bg-[var(--db-bg-banner)]'} bg-cover bg-center`}
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
				{banner.mode === 'stats' ? (
					<BannerStats store={store} banner={banner} />
				) : (
					<div className="dashboard-banner-overlay absolute inset-0 flex items-center justify-center px-12 py-3 text-center">
						<div>
							<p
								className={`m-0 mb-2 text-[1.2em] leading-[1.4] italic ${url ? 'text-[var(--db-text-inverse)]' : 'text-[var(--db-text)]'}`}
								style={{ color: banner.quoteColor, fontFamily: banner.quoteFont }}
							>
								{quote?.quote}
							</p>
							<cite
								className={`text-[.8em] not-italic ${url ? 'text-[var(--db-text-inverse-muted)]' : 'text-[var(--db-text-muted)]'}`}
								style={{ color: banner.quoteColor, fontFamily: banner.quoteFont }}
							>
								{quote?.author}
							</cite>
						</div>
					</div>
				)}
				<IconButton
					label={t('banner.editLabel')}
					className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
					onClick={() => setEdit(true)}
				>
					<WandSparkles />
				</IconButton>
			</header>
			{edit && <BannerEditDialog store={store} banner={banner} instanceId={entryId} onClose={() => setEdit(false)} />}
		</>
	);
}
