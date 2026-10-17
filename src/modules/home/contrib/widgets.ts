import type { HomeWidgetBundle, HomeWidgetContext, HomeWidgetInstance, HomeWidgetKind } from '../api';
import type { DashboardSettings } from '../core/board/types/model';
import { BUILTIN_WIDGETS, SECTION_WIDGETS, type BuiltinWidgetSpec } from '../core/board/widget-table';

const CONFIGURABLE = ['album', 'anniversary', 'countdown'];
/** Banners need no editor to be created: a new instance starts from the default poster and is edited in place. */
const NEW_INSTANCE = ['banner'];

/** All built-ins use the same lazy mount contract as module contributions. Sizes come from the one table in core. */
export function builtinHomeWidgets(
	settings: () => DashboardSettings,
	render: (key: string, ...args: Parameters<HomeWidgetKind['render']>) => ReturnType<HomeWidgetKind['render']>,
	configure?: (key: string, context: HomeWidgetContext, create: boolean) => Promise<HomeWidgetInstance | null>,
): HomeWidgetBundle {
	const singleton = [{ id: 'default' }];
	const kind = (spec: BuiltinWidgetSpec): HomeWidgetKind => {
		const { key, icon, category, sizes, defaultTier, minSize } = spec;
		const configurable = CONFIGURABLE.includes(key);
		return {
			key,
			icon,
			category,
			sizes,
			defaultTier,
			minSize,
			titleKey: spec.section ? `home.dashboard.section.${spec.section}` : `home.widget.${key}`,
			multiple: configurable || !!spec.section || spec.multiple,
			...(spec.section ? { section: spec.section } : {}),
			...(NEW_INSTANCE.includes(key)
				? { create: async () => ({ id: `banner-${crypto.randomUUID().slice(0, 8)}` }) }
				: {}),
			...(configure && configurable
				? {
						create: (context: HomeWidgetContext) => configure(key, context, true),
						configure: async (context: HomeWidgetContext) => {
							await configure(key, context, false);
						},
					}
				: {}),
			instances: () =>
				spec.section
					? []
					: key === 'album'
						? settings().albums.map((item) => ({ id: String(item.id), label: item.folder }))
						: key === 'anniversary'
							? settings().anniversaries.map((item) => ({ id: item.id, label: item.label }))
							: key === 'countdown'
								? settings().countdowns.map((item) => ({ id: item.id, label: item.label }))
								: singleton,
			render: (host, context) => render(key, host, context),
		};
	};
	return { kinds: [...BUILTIN_WIDGETS, ...SECTION_WIDGETS].map(kind) };
}
