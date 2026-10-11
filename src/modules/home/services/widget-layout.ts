import type { BoardWidgetMember, DashboardSettings } from '../core/board/types/model';
import { widgetProviderKey } from '../core/board/widget-registry';
import { widgetPresentationKey } from '../core/board/widget-members';
import { buildStackedSpanSpecs, clampWidgetUnitHeight } from '../core/board/widget-span';
import { pixelsToRows, type TileDefaults } from '../core/board/board-tiles';
import { homeServices } from './instances';

/** Provider dimensions plus the board's previous widget height preference on first migration. */
export function widgetTileDefaults(member: BoardWidgetMember, settings: DashboardSettings, legacy = false): TileDefaults | undefined {
	const kind = homeServices.widgets?.byKey.get(widgetProviderKey(member.provider, member.kind))?.kind;
	if (!kind) return undefined;
	let h = kind.defaultSize.h;
	if (legacy && member.provider === 'home') {
		const span = buildStackedSpanSpecs([widgetPresentationKey(member)], { habit: settings.habitHeightRatio, reading: settings.readingHeightRatio, albums: settings.albums })[0]?.preferred ?? 6;
		h = pixelsToRows((clampWidgetUnitHeight(settings.widgetUnitHeight) - 30) * span / 6 + 6 * (span - 1) + 32);
	}
	return { ...kind.defaultSize, h, minW: kind.minSize.w, minH: kind.minSize.h };
}
