/** Phone-widget size tiers; each maps to a w×h on the board grid (12 columns, 10px fine rows). */
export type HomeWidgetTier = 'S' | 'M' | 'L' | 'XL';
export const HOME_WIDGET_TIERS: readonly HomeWidgetTier[] = ['S', 'M', 'L', 'XL'];
/** Groups of the add-widget panel. */
export type HomeWidgetCategory =
	| 'overview'
	| 'time'
	| 'productivity'
	| 'record'
	| 'agent'
	| 'content'
	| 'media'
	| 'tools';
export const HOME_WIDGET_CATEGORIES: readonly HomeWidgetCategory[] = [
	'overview',
	'time',
	'productivity',
	'record',
	'agent',
	'content',
	'media',
	'tools',
];
