import { h } from 'preact';
import type { App } from 'obsidian';
import { t } from '../../../../shared/i18n';
import { boardTileSources, boardTiles, persistedBoardTiles } from '../../core/board/board-tiles';
import { legacyBoardMembers } from '../../core/board/widget-members';
import { widgetProviderKey } from '../../core/board/widget-registry';
import type { DashboardData, DashboardSettings } from '../../core/board/types/model';
import { homeServices } from '../../services/instances';
import { widgetTileDefaults } from '../../services/widget-layout';
import type { RenderCallbacks } from '../render-contract';
import { ImmersiveBoard } from '../immersive/ImmersiveBoard';
import { mountWidgetHost } from '../widgets/WidgetHost';
import { widgetMemberLabel } from '../widgets/widget-label';
import { bindBuiltinWidgetEnvironment, type BuiltinWidgetEnvironment } from '../widgets/builtin-context';
import { renderSection } from './refresh-media-sections';
import { renderCard } from './render-card';
import { getSectionType } from './render-text-with-links';
import { bindRenderContext, DashboardRenderContext, destroyAllCharts, destroyDashboardPanels, getRenderContext, mountDashboardPanel } from './render-context';

export interface ImmersiveEnvironment { boardPath: string; openSettings(this: void): void; builtin: BuiltinWidgetEnvironment; }

/** Widgets, sections and standalone cards share one surface and one persisted geometry. */
export function renderImmersiveBoard(container: HTMLElement, data: DashboardData, callbacks: RenderCallbacks, app: App, settings: DashboardSettings, environment: ImmersiveEnvironment): void {
	const members = data.widgets ?? legacyBoardMembers(settings, true);
	const sources = boardTileSources(data, members);
	const tiles = boardTiles(data, sources, member => widgetTileDefaults(member, settings, data.widgets === undefined));
	const index = homeServices.widgets;
	const parent = getRenderContext(container);
	const root = container.createDiv({ cls: 'nand-immersive-host' });
	mountDashboardPanel(root, h(ImmersiveBoard, {
		sources, tiles, needsRepair: data.layoutNeedsRepair,
		label: source => source.type === 'widget' ? widgetMemberLabel(source.member, index?.byKey.get(widgetProviderKey(source.member.provider, source.member.kind))?.kind)
			: source.type === 'section' ? source.column.name : source.type === 'card' ? source.card.title : source.id,
		save: next => callbacks.onBoardTiles(persistedBoardTiles(next)),
		remove: memberId => callbacks.onBoardWidgetRemove?.(memberId),
		mount: (host, source) => {
			const own = new DashboardRenderContext(host);
			own.hoverParent = parent.hoverParent; own.noteOpener = parent.noteOpener; own.markdownComponent = parent.markdownComponent;
			bindRenderContext(host, own);
			let closed = false;
			const dispose = () => { if (closed) return; closed = true; parent.resources.delete(host); destroyDashboardPanels(host); destroyAllCharts(host); };
			parent.resources.set(host, dispose);
			const failed = (error: unknown) => queueMicrotask(() => { if (!closed) { destroyDashboardPanels(host); host.empty(); host.createDiv({ cls: 'nand-widget-status', text: t('home.widget.failed', { detail: String(error) }), attr: { role: 'status' } }); } });
			own.onError = failed;
			try {
				if (source.type === 'widget') {
					const descriptor = index?.byKey.get(widgetProviderKey(source.member.provider, source.member.kind))?.kind;
					const widget = host.createDiv({ cls: 'dashboard-sidebar-widget-mount' });
					widget.dataset.widgetMember = source.member.memberId;
					mountWidgetHost(widget, source.member, descriptor, environment.boardPath, environment.openSettings, context => bindBuiltinWidgetEnvironment(context, environment.builtin));
				} else if (source.type === 'section') {
					host.appendChild(renderSection({ ...source.column, height: undefined, half: false }, callbacks, app, data, settings, own));
				} else if (source.type === 'card') {
					host.appendChild(renderCard({ ...source.card, width: 0 }, source.column.name, getSectionType(source.column), callbacks, app, data, settings, own));
				} else host.createDiv({ cls: 'nand-widget-status', text: t('renderer.missingTile'), attr: { role: 'status' } });
			} catch (error) { failed(error); }
			return dispose;
		},
	}));
}
