import type { HomeWidgetKind } from '../../api';
import type { BoardTileSource } from '../../core/board/board-tiles';
import type { GridTile } from '../../core/board/immersive-grid';
import { widgetPresentationKey } from '../../core/board/widget-members';
import { widgetProviderKey } from '../../core/board/widget-registry';
import { BUILTIN_WIDGETS, SECTION_WIDGETS, type BuiltinWidgetSpec } from '../../core/board/widget-table';
import { homeServices } from '../../services/instances';

export type TileKind = Pick<HomeWidgetKind, 'icon' | 'sizes' | 'defaultTier' | 'minSize' | 'titleKey'> & {
	key: string;
	configure?: HomeWidgetKind['configure'];
	render?: HomeWidgetKind['render'];
};

const staticKind = (spec: BuiltinWidgetSpec): TileKind => ({
	key: spec.key,
	icon: spec.icon,
	sizes: spec.sizes,
	defaultTier: spec.defaultTier,
	minSize: spec.minSize,
	titleKey: spec.section ? `home.dashboard.section.${spec.section}` : `home.widget.${spec.key}`,
});

/** The kind behind a tile: the live registry first (contributed kinds), the static table for the built-ins. */
export function kindOfSource(source: BoardTileSource): TileKind | undefined {
	if (source.type === 'widget') {
		const live = homeServices.widgets?.byKey.get(
			widgetProviderKey(source.member.provider, source.member.kind),
		)?.kind;
		if (live) return live;
		const spec =
			source.member.provider === 'home' && BUILTIN_WIDGETS.find((item) => item.key === source.member.kind);
		return spec ? staticKind(spec) : undefined;
	}
	if (source.type === 'section') {
		const type = source.column.sectionType ?? source.column.name.toLowerCase();
		const spec =
			SECTION_WIDGETS.find((item) => item.section === type) ??
			SECTION_WIDGETS.find((item) => item.section === 'sticky');
		return spec && staticKind(spec);
	}
	return undefined;
}

/** `data-widget-key` hook of a widget tile (the presentation key styles and acceptance scripts address). */
export const sourceWidgetKey = (source: BoardTileSource): string | undefined =>
	source.type === 'widget' ? widgetPresentationKey(source.member) : undefined;

/** Tiles of the canvas that a size tier applies to; cards and unavailable references keep free sizing. */
export const hasTiers = (source: BoardTileSource): boolean => source.type === 'widget' || source.type === 'section';

export const tileById = (tiles: readonly GridTile[], id: string): GridTile | undefined =>
	tiles.find((tile) => tile.id === id);
