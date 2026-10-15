// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/banner-stats.ts
import { useStore } from 'zustand';
import { useOwnerDocument } from '../../../../ui/react/contexts';
import type { BoardStore } from '../../services/board-store';
import { BannerStatsPanel } from './BannerStatsPanel';
import { computeBannerStats, resolveStatsConfig } from './stats-data';
import { p1Classes } from '../theme/p1-classes';
export function BannerStats({ store }: { store: BoardStore }) {
	const { data } = useStore(store.state),
		doc = useOwnerDocument();
	const config = data!.banner.statsConfig;
	const result = computeBannerStats(store.host.app, config);
	return (
		<div className={p1Classes('dashboard-banner-stats')}>
			<BannerStatsPanel
				app={store.host.app}
				config={resolveStatsConfig(config)}
				result={result}
				animate={false}
				win={doc.defaultView!}
			/>
		</div>
	);
}
