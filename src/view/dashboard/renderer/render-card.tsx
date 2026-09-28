import type { App } from 'obsidian';
import type { DashboardCard, DashboardData, DashboardSettings } from '../../../core/dashboard/types/index';
import { CardPanel, cardKind } from '../cards/CardPanel';
import type { RenderCallbacks } from '../render-contract';
import {
	bindRenderContext,
	getRenderContext,
	mountDashboardPanel,
	type DashboardRenderContext,
} from './render-context';

/** Native layout integration: the card root remains the section's direct child. */
export function renderCard(
	card: DashboardCard,
	columnName: string,
	sectionType: string,
	callbacks: RenderCallbacks,
	app: App,
	data?: DashboardData,
	settings?: DashboardSettings,
	context?: DashboardRenderContext,
): HTMLElement {
	const root = context ? context.root.ownerDocument.createElement('div') : createDiv();
	if (context) bindRenderContext(root, context);
	root.classList.add('dashboard-card', `dashboard-card--${card.type}`);
	root.dataset.cardId = card.id;
	root.dataset.cardType = card.type;
	root.setAttribute('role', 'article');
	root.setAttribute('aria-label', card.title);
	if (card.color) {
		root.dataset.hasColor = 'true';
		root.style.setProperty('--db-card-accent', card.color);
	}
	const widget = card.type === 'weather' || card.type === 'tracker';
	const kind = cardKind(sectionType, card.type);
	if (
		!widget &&
		kind === 'project' &&
		sectionType !== 'dashboard' &&
		sectionType !== 'notes' &&
		(sectionType !== 'sticky' || card.noteStyle !== 'plain')
	)
		root.classList.add('dashboard-card--cover');
	if (widget && sectionType === 'dashboard') {
		root.style.gridColumn = `span ${card.size === 'S' ? 1 : 2}`;
		root.style.gridRow = `span ${card.size === 'L' ? 2 : 1}`;
	} else if (!widget && card.width > 0) {
		const width = Math.max(200, Math.min(kind === 'memo' ? 600 : 500, card.width));
		root.style.flex = `0 0 ${width}px`;
		root.style.minWidth = root.style.maxWidth = width + 'px';
	}
	mountDashboardPanel(
		root,
		<CardPanel
			card={card}
			callbacks={callbacks}
			app={app}
			context={getRenderContext(root)}
			root={root}
			sectionType={sectionType}
		/>,
	);
	return root;
}
