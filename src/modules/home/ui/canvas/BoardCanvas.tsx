// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/immersive.ts
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { Check, Ellipsis, PanelLeft, Pencil, Plus } from 'lucide-react';
import type { NativeSurfaceContext } from '../../../../ui/native-surface';
import { Button } from '../../../../ui/components/button';
import { ObsidianIcon } from '../../../../ui/components/nand/ObsidianIcon';
import { useOwnerDocument } from '../../../../ui/react/contexts';
import { useT } from '../../../../ui/react/hooks';
import type { BoardStore } from '../../services/board-store';
import { homeServices } from '../../services/instances';
import { widgetTileDefaults } from '../../services/widget-layout';
import { boardTileSources, boardTiles, persistedBoardTiles, type BoardTileSource } from '../../core/board/board-tiles';
import { resizeTile, type GridTile } from '../../core/board/immersive-grid';
import type { BoardWidgetMember } from '../../core/board/types/model';
import { bannerOf } from '../../core/board/banner';
import { WidgetLifetime } from '../../core/board/widget-lifetime';
import { widgetProviderKey } from '../../core/board/widget-registry';
import { exactTier, supportedTiers, tierSize } from '../../core/board/widget-catalog';
import type { HomeWidgetTier } from '../../core/board/widget-tiers';
import { attachGridController } from '../immersive/layout-controller';
import { observeBoardAction } from '../board/actions';
import { IconButton } from '../board/controls';
import { BannerEditDialog } from '../banner/BannerEditDialog';
import { WorkspaceSwitcher } from '../banner/WorkspaceSwitcher';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { QuickNotesBar } from '../quickbar/QuickNotesBar';
import { Section } from '../sections/Section';
import { Card } from '../cards/Card';
import { ImmersiveWidgetFrame } from '../widgets/WidgetBackground';
import { AddWidgetPanel, type AddRequest, type PanelEntry } from './AddWidgetPanel';
import { ExternalWidget } from './ExternalWidget';
import { kindOfSource, sourceWidgetKey, hasTiers } from './canvas-model';
import { OWN_TITLE, WIDGET_COMPONENTS } from './widget-components';
import { widgetContext } from './widget-context';
import { TileToolbar } from './TileToolbar';
import { useCatalogRevision } from './use-catalog';

/** Whether a provider is registered and, when an instance is named, still lists it. */
const providerHas = (module: string, kind: string, instance?: string): boolean => {
	const entry = homeServices.widgets?.byKey.get(widgetProviderKey(module, kind));
	return !!entry && (instance === undefined || entry.kind.instances().some((item) => item.id === instance));
};

const memberOf = (module: string, kind: string, instanceId: string): BoardWidgetMember => ({
	memberId: `${module}:${kind}:${instanceId}`,
	provider: module,
	kind,
	instanceId,
});

/** The board: a free grid of widgets. Edit mode adds, moves, resizes and removes them; outside it nothing drags. */
/**
 * The canvas for the board generation the page is on. A switch bumps the generation: the whole subtree is replaced
 * (every dialog, menu and pending confirmation is closed, not hidden) and the new subtree gets a view of the store
 * whose writers refuse calls from older generations.
 */
export function BoardCanvas(props: { store: BoardStore; context: NativeSurfaceContext; mobile: boolean }) {
	const generation = useStore(props.store.state, (s) => s.generation);
	return <BoardCanvasView key={generation} {...props} store={props.store.view(generation)} />;
}

function BoardCanvasView({
	store,
	context,
	mobile,
}: {
	store: BoardStore;
	context: NativeSurfaceContext;
	mobile: boolean;
}) {
	const { data, settings, dialog, switching, switchError } = useStore(store.state),
		path = useStore(store.state, (s) => s.path),
		catalog = useCatalogRevision(),
		t = useT(),
		doc = useOwnerDocument(),
		grid = useRef<HTMLDivElement>(null),
		[editing, setEditing] = useState(false),
		[adding, setAdding] = useState(false),
		[bannerEdit, setBannerEdit] = useState<string | null>(null),
		[failure, setFailure] = useState(''),
		[removing, setRemoving] = useState<BoardTileSource | null>(null),
		[columns, setColumns] = useState(12);
	const sources = useMemo(() => boardTileSources(data!, data!.widgets ?? []), [data]);
	// Geometry follows board edits and provider registration only; timer ticks must not rebuild the controller.
	// eslint-disable-next-line react-hooks/exhaustive-deps -- `catalog` is the provider registry's change counter
	const tiles = useMemo(() => boardTiles(data!, sources, widgetTileDefaults), [data, sources, catalog]);
	const save = useCallback(
		(next: readonly GridTile[]) => {
			// A page that is moving to another board must not write: the engine already points at the target.
			if (store.state.getState().switching) return;
			void observeBoardAction(store.sync.setBoardTiles(persistedBoardTiles(next)));
		},
		[store],
	);
	useLayoutEffect(
		() =>
			grid.current
				? attachGridController(grid.current, tiles, save, {
						interactive: () => editing && !switching,
						onColumns: setColumns,
					})
				: undefined,
		[tiles, save, editing, switching],
	);
	const projected = columns !== 12;
	// Provider lifetimes started here (create / configure) end with the canvas, the board or the provider.
	const open = useRef(new Map<WidgetLifetime, { module: string; kind: string; instance?: string }>());
	const begin = (module: string, kind: string, instance?: string) => {
		const lifetime = new WidgetLifetime(console.error);
		open.current.set(lifetime, { module, kind, instance });
		return {
			lifetime,
			end: () => {
				open.current.delete(lifetime);
				lifetime.dispose();
			},
		};
	};
	useEffect(() => {
		const lifetimes = open.current;
		return () => {
			for (const lifetime of lifetimes.keys()) lifetime.dispose();
			lifetimes.clear();
		};
	}, [path]);
	// Moving to another board: in-flight provider work belongs to the board being left and must not reach the next one.
	useEffect(() => {
		if (!switching) return;
		for (const lifetime of open.current.keys()) lifetime.dispose();
		open.current.clear();
	}, [switching]);
	useEffect(() => {
		for (const [lifetime, owner] of open.current)
			if (!providerHas(owner.module, owner.kind, owner.instance)) {
				lifetime.dispose();
				open.current.delete(lifetime);
			}
	}, [catalog]);
	const fail = (error: unknown) => setFailure(error instanceof Error ? error.message : String(error));
	const remove = (source: BoardTileSource) => {
		if (store.state.getState().switching) return;
		if (source.type === 'widget')
			void observeBoardAction(
				store.sync.setBoardMembers((data!.widgets ?? []).filter((m) => m.memberId !== source.member.memberId)),
			);
		else if (source.type === 'section')
			void observeBoardAction(
				store.sync.deleteColumn(
					source.column.name,
					data!.columns.findIndex((c) => c.id === source.column.id || c.name === source.column.name),
				),
			);
		else if (source.type === 'card') void observeBoardAction(store.sync.deleteCard(source.card.id));
		else
			void observeBoardAction(
				store.sync.setBoardTiles((data!.immersive ?? []).filter((tile) => tile.id !== source.id)),
			);
	};
	const setTier = (source: BoardTileSource, tier: HomeWidgetTier) => {
		const kind = kindOfSource(source);
		if (!kind || projected) return;
		const size = tierSize(kind, tier);
		save(resizeTile(tiles, source.id, size.w, size.h));
	};
	const fit = (id: string) => {
		if (projected) return;
		save(tiles.map((tile) => (tile.id === id ? { ...tile, fixed: !tile.fixed } : tile)));
	};
	const configure = (source: BoardTileSource, kind: ReturnType<typeof kindOfSource>) => {
		if (source.type !== 'widget' || store.state.getState().switching) return;
		if (source.member.provider === 'home' && source.member.kind === 'banner')
			return setBannerEdit(source.member.instanceId);
		if (kind?.configure) {
			const { lifetime, end } = begin(source.member.provider, source.member.kind, source.member.instanceId);
			const ctx = widgetContext(store, source.member, doc, lifetime, fail);
			void kind
				.configure(ctx)
				.catch((error) => !lifetime.signal.aborted && fail(error))
				.finally(end);
		} else store.host.openSettings();
	};
	const entries = useMemo<PanelEntry[]>(() => {
		const placed = new Set((data!.widgets ?? []).map((member) => member.memberId));
		return [...(homeServices.widgets?.byKey.values() ?? [])].map(({ module, kind }) => {
			const instances = kind.section ? [] : kind.instances();
			const multi = !!kind.multiple && !kind.section;
			return {
				module,
				kind,
				title: t(kind.titleKey),
				placed: !kind.section && !multi && placed.has(`${module}:${kind.key}:default`),
				available: multi
					? instances
							.filter((item) => !placed.has(`${module}:${kind.key}:${item.id}`))
							.map((item) => ({ id: item.id, label: item.label ?? '' }))
					: [],
			};
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps -- `catalog` counts registry changes
	}, [data, settings, catalog, t]);
	const add = async (request: AddRequest) => {
		if (store.state.getState().switching) return;
		const size = tierSize(request.kind, request.tier);
		setAdding(false);
		store.setDialog(null);
		if (request.kind.section) {
			await observeBoardAction(
				store.sync.addToCanvas(
					{ section: { name: t(request.kind.titleKey), type: request.kind.section } },
					size,
				),
			);
			return;
		}
		let instanceId = request.instanceId ?? 'default';
		if (request.create && request.kind.create) {
			const { lifetime, end } = begin(request.module, request.kind.key);
			try {
				const created = await request.kind.create(
					widgetContext(
						store,
						{ memberId: memberOf(request.module, request.kind.key, 'new').memberId, instanceId: 'new' },
						doc,
						lifetime,
						fail,
					),
				);
				// The board or provider may be gone by now: a late result must not land on another board.
				if (!created || lifetime.signal.aborted) return;
				instanceId = created.id;
			} catch (error) {
				if (!lifetime.signal.aborted) fail(error);
				return;
			} finally {
				end();
			}
		}
		await observeBoardAction(
			store.sync.addToCanvas({ member: memberOf(request.module, request.kind.key, instanceId) }, size),
		);
	};
	return (
		<div className="dashboard-canvas relative isolate flex min-h-0 flex-1 flex-col">
			<div
				inert={switching || undefined}
				aria-busy={switching || undefined}
				className="dashboard-scroll-region flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 pb-6 max-[960px]:px-3"
			>
				<div className="dashboard-canvas-bar flex w-full shrink-0 flex-wrap items-center justify-end gap-1 pt-2">
					{context.togglePanel && (
						<IconButton label={t('home.dashboard.togglePanel')} onClick={() => context.togglePanel?.()}>
							<PanelLeft />
						</IconButton>
					)}
					<IconButton
						label={t('home.dashboard.pageMenu')}
						onClick={(e) => context.openPageMenu?.(e.nativeEvent)}
					>
						<Ellipsis />
					</IconButton>
					{editing ? (
						<>
							<Button size="sm" variant="outline" onClick={() => setAdding(true)}>
								<Plus />
								{t('canvas.addWidget')}
							</Button>
							<Button size="sm" onClick={() => setEditing(false)}>
								<Check />
								{t('canvas.done')}
							</Button>
						</>
					) : (
						<Button size="sm" variant="outline" onClick={() => setEditing(true)}>
							<Pencil />
							{t('canvas.edit')}
						</Button>
					)}
				</div>
				{settings.quickNotesEnabled && <QuickNotesBar store={store} />}
				<div className="nand-immersive-board">
					<p className="nand-immersive-projection text-xs text-[var(--db-text-muted)]" hidden>
						{t('renderer.projectedLayout')}
					</p>
					<div
						ref={grid}
						data-editing={editing}
						className="dashboard-kanban nand-immersive-grid grid auto-rows-[10px] grid-cols-12 content-start gap-x-2.5 gap-y-0"
					>
						<div className="nand-immersive-live sr-only" role="status" aria-live="polite" />
						{sources.map((source) => {
							const kind = kindOfSource(source),
								widgetKey = sourceWidgetKey(source),
								tile = tiles.find((item) => item.id === source.id),
								label =
									source.type === 'section'
										? source.column.name
										: source.type === 'card'
											? source.card.title
											: kind
												? source.type === 'widget' && source.member.label
													? source.member.label
													: t(kind.titleKey)
												: t('renderer.missingTile');
							const current =
								kind && tile ? exactTier(kind, { w: tile.w, h: tile.cap ?? tile.h }) : undefined;
							const titled =
								source.type === 'widget' &&
								!(source.member.provider === 'home' && OWN_TITLE.has(source.member.kind));
							return (
								<article
									key={source.id}
									data-widget-key={widgetKey}
									data-tile={source.id}
									data-imm-id={source.id}
									className="nand-immersive-tile [&[data-fixed=true]_.nand-immersive-content]:h-full group/tile dashboard-widget-card relative mb-2.5 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--db-radius-lg)] border border-[var(--db-border-card)] bg-[var(--db-bg-card)] shadow-[var(--db-shadow-card)]"
								>
									{editing && (
										<TileToolbar
											label={label}
											icon={kind?.icon}
											tiers={kind && hasTiers(source) ? supportedTiers(kind) : []}
											current={current}
											projected={projected}
											fitting={!tile?.fixed}
											canConfigure={
												source.type === 'widget' &&
												(source.member.kind === 'banner' ||
													!!kind?.configure ||
													source.member.provider === 'home')
											}
											onTier={(tier) => setTier(source, tier)}
											onFit={() => fit(source.id)}
											onConfigure={() => configure(source, kind)}
											onRemove={() =>
												source.type === 'widget' ? remove(source) : setRemoving(source)
											}
										/>
									)}
									{!editing && titled && (
										<div className="flex h-7 shrink-0 items-center gap-1.5 px-3 pt-2 text-xs font-semibold text-[var(--db-text-muted)]">
											{kind && <ObsidianIcon name={kind.icon} className="size-3.5" />}
											<h3 className="m-0 truncate text-xs font-semibold">{label}</h3>
										</div>
									)}
									<div className="nand-immersive-body min-h-0 flex-1 overflow-auto">
										<div className="nand-immersive-content">
											<TileContent
												store={store}
												source={source}
												kind={kind}
												mobile={mobile}
												catalog={catalog}
											/>
										</div>
									</div>
									{editing && (
										<Button
											variant="ghost"
											data-grid-action="resize"
											aria-label={t('renderer.resizeTile')}
											className="absolute right-0 bottom-0 size-6 cursor-se-resize p-0"
										>
											⌟
										</Button>
									)}
								</article>
							);
						})}
						<div
							className="nand-immersive-ghost pointer-events-none rounded-lg border-2 border-dashed border-primary bg-primary/20"
							hidden
						/>
					</div>
					{sources.length === 0 && (
						<p className="p-6 text-center text-sm text-[var(--db-text-muted)]">{t('canvas.noWidgets')}</p>
					)}
				</div>
			</div>
			<WorkspaceSwitcher store={store} />
			{!switching && bannerEdit !== null && (
				<BannerEditDialog
					store={store}
					banner={bannerOf(data!, bannerEdit)}
					instanceId={bannerEdit}
					onClose={() => setBannerEdit(null)}
				/>
			)}
			{switching && (
				<div
					role={switchError ? 'alert' : 'status'}
					className="absolute inset-0 z-[var(--layer-content)] flex items-center justify-center bg-[color-mix(in_srgb,var(--db-bg)_70%,transparent)] p-6 text-center text-sm"
				>
					{switchError ? t('canvas.switchBroken', { detail: switchError }) : t('canvas.switching')}
				</div>
			)}
			{!switching && switchError && (
				<p
					role="alert"
					className="absolute bottom-3 left-1/2 m-0 -translate-x-1/2 rounded-md border border-[var(--db-border-card)] bg-[var(--db-bg-modal)] px-3 py-2 text-xs text-[var(--db-danger)]"
				>
					{t('canvas.switchFailed', { detail: switchError })}
				</p>
			)}
			{failure && (
				<p
					role="alert"
					className="absolute bottom-3 left-1/2 m-0 -translate-x-1/2 rounded-md border border-[var(--db-border-card)] bg-[var(--db-bg-modal)] px-3 py-2 text-xs text-[var(--db-danger)]"
				>
					{t('home.widget.failed', { detail: failure })}
				</p>
			)}
			{!switching && (adding || dialog === 'section') && (
				<AddWidgetPanel
					entries={entries}
					onAdd={(request) => void add(request)}
					onClose={() => {
						setAdding(false);
						store.setDialog(null);
					}}
				/>
			)}
			{!switching && removing && (
				<DashboardDialog
					title={t('home.widget.remove')}
					danger
					confirmLabel={t('common.delete')}
					onClose={() => setRemoving(null)}
					onSave={() => {
						remove(removing);
						setRemoving(null);
					}}
				>
					<p>
						{t('canvas.removeConfirm', {
							name:
								removing.type === 'section'
									? removing.column.name
									: removing.type === 'card'
										? removing.card.title
										: '',
						})}
					</p>
				</DashboardDialog>
			)}
		</div>
	);
}

function TileContent({
	store,
	source,
	kind,
	mobile,
	catalog,
}: {
	store: BoardStore;
	source: BoardTileSource;
	kind: ReturnType<typeof kindOfSource>;
	mobile: boolean;
	/** Provider registry revision: the view re-resolves its provider when it changes. */
	catalog: number;
}) {
	const t = useT();
	const data = useStore(store.state, (s) => s.data)!;
	if (source.type === 'section')
		return (
			<Section
				store={store}
				column={{ ...source.column, half: false, height: undefined }}
				index={data.columns.findIndex((c) => c.id === source.column.id || c.name === source.column.name)}
				mobile
				immersive
			/>
		);
	if (source.type === 'card') return <Card store={store} card={source.card} index={0} immersive />;
	if (source.type === 'widget') {
		const { member } = source;
		const entryId = member.instanceId === 'default' ? undefined : member.instanceId;
		const Component = member.provider === 'home' ? WIDGET_COMPONENTS[member.kind] : undefined;
		if (Component)
			return member.kind === 'banner' ? (
				<Component store={store} entryId={entryId} />
			) : (
				<ImmersiveWidgetFrame
					store={store}
					kind={
						member.kind === 'quick-actions'
							? 'quickActions'
							: member.kind === 'year-progress'
								? 'yearProgress'
								: member.kind
					}
				>
					<Component store={store} entryId={entryId} />
				</ImmersiveWidgetFrame>
			);
		// `catalog` is the provider registry's change counter: it is what makes this lookup re-run.
		const live =
			catalog < 0
				? undefined
				: homeServices.widgets?.byKey.get(widgetProviderKey(member.provider, member.kind))?.kind;
		const listed = catalog >= 0 && !!live?.instances().some((item) => item.id === member.instanceId);
		// An instance the provider no longer lists keeps its place on the board but its view is released.
		if (live && listed)
			return (
				<ExternalWidget store={store} kind={live} memberId={member.memberId} instanceId={member.instanceId} />
			);
		void mobile;
		return (
			<p className="m-0 p-3 text-xs text-[var(--db-text-muted)]">
				{t(kind ? 'home.widget.instanceMissing' : 'home.widget.unavailable')}
			</p>
		);
	}
	return <p className="m-0 p-3 text-xs text-[var(--db-text-muted)]">{t('renderer.missingTile')}</p>;
}
