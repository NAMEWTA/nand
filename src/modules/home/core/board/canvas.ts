import { boardTileSources, boardTiles, persistedBoardTiles, type TileDefaults } from './board-tiles';
import type { BoardWidgetMember, DashboardData } from './types/model';
import { defaultCellSize } from './widget-catalog';
import { BUILTIN_WIDGETS } from './widget-table';

const member = (kind: string, instanceId = 'default'): BoardWidgetMember => ({
	memberId: `home:${kind}:${instanceId}`,
	provider: 'home',
	kind,
	instanceId,
});

/** Starting geometry of a built-in widget, from the same table the add-widget panel reads. */
export function builtinTileDefaults(widget: BoardWidgetMember): TileDefaults | undefined {
	const spec = widget.provider === 'home' ? BUILTIN_WIDGETS.find((item) => item.key === widget.kind) : undefined;
	return spec ? { ...defaultCellSize(spec), minW: spec.minSize.w, minH: spec.minSize.h } : undefined;
}

/** The widgets of a fresh board; content sections (notes, todo, projects) come from the board's columns. */
export function defaultCanvasMembers(): BoardWidgetMember[] {
	return [member('banner'), member('calendar'), member('quick-actions'), member('pomodoro')];
}

/**
 * A board is a canvas once it carries `canvas: 1`. The old immersive layout also wrote `widgets` and `immersive`
 * but kept the banner outside the grid, so it converts too; only this version mark tells a board whose banner was
 * never a widget from one whose user removed it.
 */
export function needsCanvasConversion(data: Pick<DashboardData, 'canvas'>): boolean {
	return data.canvas !== 1;
}

/**
 * Opens an old board (side, stacked or undeclared layout) as a widget canvas once. Cards, columns and the
 * banner stay as they are; the banner becomes a widget at the top, the sidebar widgets the user had
 * enabled become members, and tiles are packed in that order with columns below them.
 */
export function convertToCanvas(
	data: DashboardData,
	legacyMembers: readonly BoardWidgetMember[] | undefined,
	defaults: (widget: BoardWidgetMember) => TileDefaults | undefined = builtinTileDefaults,
): DashboardData {
	const known =
		data.widgets ??
		(legacyMembers ?? defaultCanvasMembers().filter((item) => item.kind !== 'banner')).map((item) => ({ ...item }));
	const widgets = known.some((item) => item.provider === 'home' && item.kind === 'banner')
		? [...known]
		: [member('banner'), ...known];
	const next: DashboardData = { ...data, layout: 'immersive', canvas: 1, legacyLayout: undefined, widgets };
	next.immersive = persistedBoardTiles(boardTiles(next, boardTileSources(next, widgets), defaults), true);
	return next;
}

const WIDGET_SLOTS: Record<string, readonly [number, number, number, number]> = {
	banner: [0, 0, 12, 12],
	calendar: [0, 12, 4, 50],
	'quick-actions': [0, 62, 4, 28],
	pomodoro: [4, 62, 3, 24],
};
/** x, y, w, cap for the default sections in column order: memo, to-do, projects, library. */
const SECTION_SLOTS: readonly (readonly [number, number, number, number])[] = [
	[4, 12, 4, 50],
	[8, 12, 4, 50],
	[7, 62, 5, 28],
	[0, 90, 12, 50],
];

/** A new board: the default widgets and sections laid out as one composed page (banner, calendar, notes, tools). */
export function defaultCanvas(data: DashboardData): DashboardData {
	const board = convertToCanvas(data, undefined);
	const tiles = board.immersive ?? [];
	const sources = boardTileSources(board, board.widgets ?? []);
	let section = 0;
	board.immersive = sources.flatMap((source) => {
		const base = tiles.find((tile) => tile.id === source.id);
		const slot =
			source.type === 'widget'
				? WIDGET_SLOTS[source.member.kind]
				: source.type === 'section'
					? SECTION_SLOTS[section++]
					: undefined;
		if (!slot) return base ? [base] : [];
		return [
			{
				id: source.id,
				w: slot[2],
				cap: slot[3],
				...(source.type === 'widget' ? { fixed: true } : {}),
				x: slot[0],
				y: slot[1],
			},
		];
	});
	return board;
}
