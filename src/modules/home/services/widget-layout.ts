import type { BoardWidgetMember } from '../core/board/types/model';
import { widgetProviderKey } from '../core/board/widget-registry';
import type { TileDefaults } from '../core/board/board-tiles';
import { defaultCellSize } from '../core/board/widget-catalog';
import { builtinTileDefaults } from '../core/board/canvas';
import { homeServices } from './instances';

/** A provider's starting geometry, from the kind's single size table. */
export function widgetTileDefaults(member: BoardWidgetMember): TileDefaults | undefined {
	const kind = homeServices.widgets?.byKey.get(widgetProviderKey(member.provider, member.kind))?.kind;
	return kind
		? { ...defaultCellSize(kind), minW: kind.minSize.w, minH: kind.minSize.h }
		: builtinTileDefaults(member);
}
