import { ImmersiveWidgetFrame } from '../widgets/WidgetBackground';
import { widgetChoices } from '../../core/board/widget-choices';
import { observeBoardAction } from '../board/actions';
// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/immersive.ts
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { Plus, X, WandSparkles, Ellipsis, Maximize2, GripVertical } from 'lucide-react';
import type { NativeSurfaceContext } from '../../../../ui/native-surface';
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from '../../../../ui/components/context-menu';
import { Button } from '../../../../ui/components/button';
import { useT } from '../../../../ui/react/hooks';
import type { BoardStore } from '../../services/board-store';
import { boardTileSources, boardTiles, persistedBoardTiles, type BoardTileSource } from '../../core/board/board-tiles';
import { legacyBoardMembers, widgetPresentationKey } from '../../core/board/widget-members';
import { attachGridController } from '../immersive/layout-controller';
import type { GridTile } from '../../core/board/immersive-grid';
import { WIDGETS, widgetKind } from '../widgets/WidgetDeck';
import { Section } from '../sections/Section';
import { Card } from '../cards/Card';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { SectionTypePicker } from '../sections/SectionTypePicker';
import { WorkspaceSwitcher } from '../banner/WorkspaceSwitcher';
import { BannerEditDialog } from '../banner/BannerEditDialog';
import { QuickNotesBar } from '../quickbar/QuickNotesBar';
import { useClock, useImage } from '../board/hooks';
import { focalPosition } from '../../core/board/focal-point';
import { IconButton } from '../board/controls';
import { CountdownEditor } from '../widgets/CountdownWidget';
import { AnniversaryEditor } from '../widgets/AnniversaryEditor';
import type { CountdownConfig, AnniversaryConfig } from '../../core/board/types';
const defaults: Record<string, { w: number; h: number }> = {
	quickActions: { w: 4, h: 28 },
	calendar: { w: 4, h: 28 },
	weather: { w: 3, h: 19 },
	pomodoro: { w: 3, h: 15 },
	reading: { w: 3, h: 15 },
	habit: { w: 3, h: 19 },
	expense: { w: 3, h: 15 },
	lunar: { w: 3, h: 10 },
	yearProgress: { w: 3, h: 10 },
	quickCapture: { w: 2, h: 6 },
	fileSearch: { w: 2, h: 8 },
	skills: { w: 2, h: 6 },
};
export function ImmersiveLayout({ store, context }: { store: BoardStore; context: NativeSurfaceContext }) {
	const { data, settings, dialog } = useStore(store.state),
		t = useT(),
		grid = useRef<HTMLDivElement>(null),
		[editing, setEditing] = useState(false),
		[adding, setAdding] = useState(false),
		[creatingCountdown, setCreatingCountdown] = useState<CountdownConfig | null>(null),
		[creatingAnniversary, setCreatingAnniversary] = useState<AnniversaryConfig | null>(null),
		clock = useClock(1000);
	const sources = useMemo(
		() => boardTileSources(data!, data!.widgets ?? legacyBoardMembers(settings, true)),
		[data, settings],
	);
	const tiles = useMemo(
		() =>
			boardTiles(
				data!,
				sources,
				(member) => defaults[widgetKind(widgetPresentationKey(member))] ?? { w: 3, h: 10 },
			).map((tile) => {
				const source = sources.find((s) => s.id === tile.id);
				return source?.type === 'section' && !data!.immersive?.some((t) => t.id === tile.id)
					? { ...tile, w: 6, h: 80, cap: 80 }
					: tile;
			}),
		[data, sources],
	);
	const save = useCallback(
		(tiles: readonly GridTile[]) => {
			void observeBoardAction(store.sync.setBoardTiles(persistedBoardTiles(tiles)));
		},
		[store],
	);
	useLayoutEffect(() => (grid.current ? attachGridController(grid.current, tiles, save) : undefined), [tiles, save]);
	const images = data!.banner.images?.length ? data!.banner.images : [data!.banner.image],
		path = images[Math.floor(clock / 1800000) % images.length] ?? '',
		url = useImage(store, path);
	const remove = (source: BoardTileSource) => {
		if (source.type === 'widget')
			void observeBoardAction(
				store.sync.setBoardMembers(
					(data!.widgets ?? legacyBoardMembers(settings, true)).filter(
						(m) => m.memberId !== source.member.memberId,
					),
				),
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
	const addInstance = (kind: 'countdown' | 'anniversary', instanceId: string) => {
		const current = store.state.getState();
		return store.sync.setBoardMembers([
			...(current.data!.widgets ?? legacyBoardMembers(current.settings, true)),
			{ memberId: `home:${kind}:${instanceId}`, provider: 'home', kind, instanceId },
		]);
	};
	return (
		<div className="dashboard-imm relative isolate flex min-h-0 flex-1 flex-col">
			<div
				className="dashboard-imm-bg pointer-events-none absolute inset-0 -z-10 bg-cover bg-center"
				style={{
					backgroundImage: url ? `url(${JSON.stringify(url)})` : undefined,
					backgroundPosition: focalPosition(data!.banner.imagePos?.[path]),
				}}
			>
				<div className="dashboard-imm-bg-scrim absolute inset-0" />
			</div>
			<div className="dashboard-scroll-region flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-12 pb-6 max-[960px]:px-6">
				<div className="dashboard-imm-top flex w-full shrink-0 flex-col items-center gap-3 pt-7 pb-2">
					<time
						className="dashboard-imm-clock-time text-[5em] leading-none font-medium tracking-[.07em] text-[var(--db-text-inverse)]"
						style={{ fontFamily: "Didot, 'Bodoni MT', Georgia, serif" }}
					>
						{new Date(clock).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
					</time>
					{settings.quickNotesEnabled && <QuickNotesBar store={store} />}
					<Button
						variant="outline"
						className="dashboard-imm-add-btn size-8 border-0 bg-transparent p-0"
						aria-label={t('home.p1.addTile')}
						onClick={() => setAdding(true)}
					>
						<Plus />
					</Button>
				</div>
				<div className="nand-immersive-board">
					<p className="nand-immersive-projection" hidden>
						{t('renderer.projectedLayout')}
					</p>
					<div
						ref={grid}
						className="dashboard-kanban nand-immersive-grid grid auto-rows-[10px] grid-cols-12 content-start gap-x-2.5 gap-y-0"
					>
						<div className="nand-immersive-live sr-only" role="status" aria-live="polite" />
						{sources.map((source) => {
							const key = source.type === 'widget' ? widgetPresentationKey(source.member) : '',
								kind = widgetKind(key),
								Widget = WIDGETS[kind]?.component,
								label =
									source.type === 'section'
										? source.column.name
										: source.type === 'card'
											? source.card.title
											: t(`home.dashboard.widget.${kind}`);
							return (
								<ContextMenu key={source.id}>
									<ContextMenuTrigger asChild>
										<article
											data-widget-key={source.type === 'widget' ? key : undefined}
											data-tile={source.id}
											data-imm-id={source.id}
											className="nand-immersive-tile [&[data-fixed=true]_.nand-immersive-content]:h-full group/tile relative mb-2.5 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--db-radius-lg)] border border-[var(--db-border-card)] bg-[var(--db-bg-card)] shadow-[var(--db-shadow-card)]"
										>
											<div className="nand-immersive-toolbar absolute top-0 right-0 z-[var(--layer-content)] flex h-6 shrink-0 items-center gap-1 px-3 opacity-0 group-hover/tile:opacity-100 focus-within:opacity-100">
												<Button
													variant="ghost"
													data-grid-action="move"
													className="size-6 cursor-grab p-0"
													aria-label={t('renderer.moveTile', { name: label })}
												>
													<GripVertical className="size-3" />
												</Button>
												<IconButton data-grid-action="fit" label={t('renderer.fitTile')}>
													<Maximize2 />
												</IconButton>
												<IconButton
													className="opacity-0 group-hover/tile:opacity-100 focus-visible:opacity-100"
													label={t('home.widget.removeNamed', { name: label })}
													onClick={() => remove(source)}
												>
													<X />
												</IconButton>
											</div>
											<div className="min-h-0 flex-1 overflow-auto">
												<div className="nand-immersive-content">
													{source.type === 'widget' && Widget ? (
														<ImmersiveWidgetFrame store={store} kind={kind}>
															<Widget
																store={store}
																entryId={
																	source.member.instanceId === 'default'
																		? undefined
																		: source.member.instanceId
																}
															/>
														</ImmersiveWidgetFrame>
													) : source.type === 'section' ? (
														<Section
															store={store}
															column={{
																...source.column,
																half: false,
																height: undefined,
															}}
															index={data!.columns.findIndex(
																(c) =>
																	c.id === source.column.id ||
																	c.name === source.column.name,
															)}
															mobile
															immersive
														/>
													) : source.type === 'card' ? (
														<Card store={store} card={source.card} index={0} immersive />
													) : (
														<p>{t('renderer.missingTile')}</p>
													)}
												</div>
											</div>
											<Button
												variant="ghost"
												data-grid-action="resize"
												aria-label={t('renderer.resizeTile')}
												className="absolute right-0 bottom-0 size-6 cursor-se-resize p-0 opacity-0 group-hover/tile:opacity-100 focus-visible:opacity-100"
											>
												⌟
											</Button>
										</article>
									</ContextMenuTrigger>
									<ContextMenuContent>
										<ContextMenuItem onSelect={() => remove(source)}>
											{t('home.widget.remove')}
										</ContextMenuItem>
									</ContextMenuContent>
								</ContextMenu>
							);
						})}
						<div
							className="nand-immersive-ghost pointer-events-none rounded-lg border-2 border-dashed border-primary bg-primary/20"
							hidden
						/>
					</div>
				</div>
			</div>
			<WorkspaceSwitcher store={store} />
			<div className="absolute top-2 right-3 flex">
				<IconButton label={t('home.dashboard.pageMenu')} onClick={(e) => context.openPageMenu?.(e.nativeEvent)}>
					<Ellipsis />
				</IconButton>
				<IconButton label={t('banner.editLabel')} onClick={() => setEditing(true)}>
					<WandSparkles />
				</IconButton>
			</div>
			{editing && <BannerEditDialog store={store} banner={data!.banner} onClose={() => setEditing(false)} />}
			{adding && (
				<DashboardDialog title={t('home.p1.addTile')} onClose={() => setAdding(false)}>
					<div className="flex flex-wrap gap-2">
						{widgetChoices(settings, Object.keys(WIDGETS)).map(({ key, kind, instanceId, label }) => (
							<Button
								key={`${key}:${instanceId ?? 'create'}`}
								variant="outline"
								disabled={
									instanceId !== undefined &&
									sources.some(
										(source) =>
											source.type === 'widget' &&
											source.member.kind === kind &&
											source.member.instanceId === instanceId,
									)
								}
								onClick={() => {
									if (instanceId === undefined) {
										setAdding(false);
										if (kind === 'countdown')
											setCreatingCountdown({
												id: crypto.randomUUID(),
												label: '',
												targetDate: '',
												displayMode: 'days',
												reminderDays: 0,
											});
										else if (kind === 'anniversary')
											setCreatingAnniversary({
												id: crypto.randomUUID(),
												label: '',
												startDate: new Date().toLocaleDateString('sv-SE'),
												precision: 'ymd',
												calendar: 'solar',
												annualReminder: true,
											});
										return;
									}
									const members = data!.widgets ?? legacyBoardMembers(settings, true);
									void observeBoardAction(
										store.sync.setBoardMembers([
											...members,
											{
												memberId: `home:${kind}:${instanceId}`,
												provider: 'home',
												kind,
												instanceId,
											},
										]),
									);
									setAdding(false);
								}}
							>
								{label || t(`home.dashboard.widget.${key}`)}
								{instanceId === undefined ? ` · ${t('common.add')}` : ''}
							</Button>
						))}
						<Button
							onClick={() => {
								setAdding(false);
								store.setDialog('section');
							}}
						>
							{t('home.dashboard.addSection')}
						</Button>
						<Button variant="ghost" onClick={() => setAdding(false)}>
							{t('common.cancel')}
						</Button>
					</div>
				</DashboardDialog>
			)}
			{dialog === 'section' && <SectionTypePicker store={store} />}
			{creatingCountdown && (
				<CountdownEditor
					initial={creatingCountdown}
					onClose={() => setCreatingCountdown(null)}
					onSave={(value) => {
						void observeBoardAction(
							store
								.settings((s) => {
									s.countdowns = [...s.countdowns.filter((entry) => entry.id !== value.id), value];
								})
								.then(() => addInstance('countdown', value.id))
								.then(() => setCreatingCountdown(null)),
						);
					}}
				/>
			)}
			{creatingAnniversary && (
				<AnniversaryEditor
					initial={creatingAnniversary}
					onClose={() => setCreatingAnniversary(null)}
					onSave={(value) => {
						void observeBoardAction(
							store
								.settings((s) => {
									s.anniversaries = [
										...s.anniversaries.filter((entry) => entry.id !== value.id),
										value,
									];
								})
								.then(() => addInstance('anniversary', value.id))
								.then(() => setCreatingAnniversary(null)),
						);
					}}
				/>
			)}
		</div>
	);
}
