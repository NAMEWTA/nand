// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/settings/settings-page-renderer.tsx
import {
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
	type ComponentType,
} from 'react';
import type DashboardPlugin from '../../main';
import type { SettingsPageHost } from '../../contracts/module';
import type { WorkbenchTarget } from '../../contracts/workbench';
import { t } from '../../../shared/i18n';
import { useT } from '../../../ui/react/hooks';
import { Input } from '../../../ui/components/input';
import { SettingsSection } from '../../../ui/components/nand/SettingsSection';
import { settingsCategories } from '../../workbench/settings-categories';
import { PRODUCT_MODULES } from '../nav';
import { AppearanceSettings, AboutSettings } from './BuiltInSettings';
import { GeneralSettings } from './GeneralSettings';
import { SettingsSearchContext } from './SearchableSetting';
const ComponentGallery = lazy(() => import('../../../ui/react/gallery').then((m) => ({ default: m.ComponentGallery })));
function ModuleSettings({
	plugin,
	category,
	resourceId,
}: {
	plugin: DashboardPlugin;
	category: string;
	resourceId?: string;
}) {
	const [loaded, setLoaded] = useState<{
		loader?: () => Promise<ComponentType<SettingsPageHost>>;
		Component?: ComponentType<SettingsPageHost>;
		error?: string;
	}>({});
	const [, setRevision] = useState(0);
	const module = PRODUCT_MODULES[category as keyof typeof PRODUCT_MODULES];
	const load = module ? plugin.moduleInstance(module)?.settingsPage : undefined;
	useEffect(() => {
		let alive = true;
		if (load)
			void load().then(
				(value) => {
					if (alive) setLoaded({ loader: load, Component: value });
				},
				(error: unknown) => {
					if (alive)
						setLoaded({ loader: load, error: error instanceof Error ? error.message : String(error) });
				},
			);
		return () => {
			alive = false;
		};
	}, [load]);
	const kept = useRef(new Set<() => void>());
	useEffect(() => {
		const subscriptions = kept.current;
		return () => {
			for (const off of subscriptions) off();
			subscriptions.clear();
		};
	}, [load]);
	const host = useMemo(
		() => ({
			refresh: () => setRevision((r) => r + 1),
			keep: (off: () => void) => {
				kept.current.add(off);
			},
		}),
		[kept, setRevision],
	);
	if (loaded.loader === load && loaded.error)
		return (
			<p role="alert" data-settings-results="true" className="text-destructive">
				{loaded.error}
			</p>
		);
	if (loaded.loader === load && loaded.Component)
		return <loaded.Component key={resourceId} {...host} resourceId={resourceId} />;
	return (
		<p role="status" data-settings-pending className="text-xs text-muted-foreground">
			{t('workbench.loading')}
		</p>
	);
}
export function SettingsPage({
	plugin,
	category,
	resourceId,
	navigate,
}: {
	plugin: DashboardPlugin;
	category: string;
	resourceId?: string;
	navigate: (target: WorkbenchTarget) => void;
}) {
	const translate = useT();
	const [query, setQuery] = useState('');
	useSyncExternalStore(
		useCallback((listener) => plugin.onModuleChanged(listener), [plugin]),
		() =>
			plugin
				.moduleManifests()
				.map((m) => plugin.moduleState(m.id))
				.join(),
	);
	useSyncExternalStore(
		useCallback((listener) => plugin.appSettings.subscribe(listener), [plugin]),
		() => plugin.appSettings.get(),
	);
	const categories = settingsCategories(plugin);
	const sections = query.trim()
		? categories.filter((c) => !['components', 'about'].includes(c.id))
		: categories.filter((c) => c.id === category);
	return (
		<div className="nand-settings-page settings-view-shell flex h-full min-h-0 flex-1 overflow-hidden bg-background">
			<div className="flex min-h-0 min-w-0 flex-1 flex-col">
				<div className="min-h-0 flex-1 overflow-y-auto scrollbar-sleek" data-settings-scroll>
					<div className="group/settings-results mx-auto flex w-full max-w-4xl flex-col gap-10 px-8 pt-10 pb-24">
						<Input
							type="search"
							value={query}
							maxLength={512}
							onChange={(e) => setQuery(e.target.value)}
							aria-label={translate('shell.searchSettings')}
							placeholder={translate('shell.searchSettings')}
							className="sticky top-0 z-10 bg-background"
						/>
						<SettingsSearchContext.Provider value={query}>
							{sections.map((section) =>
								section.id === 'general' ? (
									<GeneralSettings key={section.id} plugin={plugin} navigate={navigate} />
								) : (
									<SettingsSection
										key={section.id}
										title={section.label}
										className={
											query.trim()
												? 'hidden has-[[data-searchable-setting]]:block has-[[data-settings-results=true]]:block has-[[data-settings-pending]]:block'
												: undefined
										}
									>
										{section.id === 'components' ? (
											<Suspense fallback={<p>{translate('workbench.loading')}</p>}>
												<ComponentGallery />
											</Suspense>
										) : section.id === 'appearance' || section.id === 'about' ? (
											section.id === 'appearance' ? (
												<AppearanceSettings plugin={plugin} />
											) : (
												<AboutSettings />
											)
										) : (
											<ModuleSettings
												plugin={plugin}
												category={section.id}
												resourceId={resourceId}
											/>
										)}
									</SettingsSection>
								),
							)}
							{query.trim() && (
								<div
									role="status"
									data-settings-empty
									className="flex min-h-[24rem] items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/30 text-sm text-muted-foreground group-has-[[data-searchable-setting]]/settings-results:hidden group-has-[[data-settings-results=true]]/settings-results:hidden group-has-[[data-settings-pending]]/settings-results:hidden"
								>
									{translate('shell.noSettingsFound', { query: query.trim() })}
								</div>
							)}
						</SettingsSearchContext.Provider>
					</div>
				</div>
			</div>
		</div>
	);
}
