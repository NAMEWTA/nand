import { Notice } from 'obsidian';
import type { PanelItem, PanelModel, WorkbenchTarget } from '../../../app/contracts/workbench';
import { getLanguage, t } from '../../../shared/i18n/index';
import type { AgentWorkbench } from '../api';
import { getAgent } from '../core/launch/catalog';
import { formatUsageChip } from '../core/launch/usage-format';
import type { AgentId } from '../core/launch/types';
import { activeTab } from '../core/terminal/layout';
import type { AgentController } from './controller';
import { statusLabel } from './terminal/status';

const HISTORY_IN_PANEL = 50;

function agentTitle(id: string): string {
	try {
		return getAgent(id as AgentId).title;
	} catch {
		return id;
	}
}

function age(ms: number): string {
	const minutes = Math.round((Date.now() - ms) / 60_000);
	if (minutes < 1) return t('agent.justNow');
	if (minutes < 60) return t('agent.minutesAgo', { count: minutes });
	const hours = Math.round(minutes / 60);
	if (hours < 24) return t('agent.hoursAgo', { count: hours });
	const days = Math.round(hours / 24);
	return days < 30 ? t('agent.daysAgo', { count: days }) : new Date(ms).toLocaleDateString(getLanguage() === 'zh' ? 'zh-CN' : 'en-US');
}

/** Opens the "new session" menu under the button that was just pressed. */
function showNewSessionMenu(controller: AgentController): void {
	const doc = controller.app.workspace.containerEl.doc;
	const anchor = doc.activeElement instanceof HTMLElement ? doc.activeElement : undefined;
	const rect = anchor?.getBoundingClientRect();
	const menu = controller.newSessionMenu();
	if (rect) menu.showAtPosition({ x: rect.left, y: rect.bottom + 4 }, doc);
	else menu.showAtPosition({ x: 120, y: 120 }, doc);
}

export function agentPanel(controller: AgentController, target: WorkbenchTarget): PanelModel {
	const section = target.section ?? 'running';
	const focused = activeTab(controller.sessions.tabs)?.focused;
	const sessions: PanelItem[] = controller.sessions
		.list()
		.filter((session) => !session.automated)
		.map((session) => ({
			id: session.id,
			label: session.title,
			icon: session.agentId ? 'bot' : 'terminal',
			meta: statusLabel(session),
			target: { feature: 'terminal', section: 'running', resourceId: session.id },
			select: () => controller.show(session.id),
			active: section === 'running' && focused === session.id,
			menu: () => [
				{ title: t('agent.copyId'), icon: 'fingerprint', run: () => navigator.clipboard.writeText(session.id).then(() => { new Notice(t('agent.copiedId')); }) },
				{ title: session.running ? t('agent.end') : t('agent.closePane'), icon: 'square-x', danger: true, run: () => controller.closeSession(session.id) },
			],
		}));
	const rows = controller.recentHistory();
	const history: PanelItem[] = rows.slice(0, HISTORY_IN_PANEL).map((row) => ({
		id: `history-${row.key}`,
		label: controller.history().meta(row.key).title || row.title || agentTitle(row.agentId),
		icon: controller.history().meta(row.key).favorite ? 'star' : 'history',
		meta: `${agentTitle(row.agentId)} · ${age(row.modifiedAtMs)}`,
		target: { feature: 'terminal', section: 'history', resourceId: row.key },
		active: section === 'history' && target.resourceId === row.key,
	}));
	history.push({ id: 'history-all', label: t('agent.historyAll'), icon: 'list', target: { feature: 'terminal', section: 'history' }, active: section === 'history' && !target.resourceId });
	return {
		primary: { label: t('agent.newSession'), icon: 'plus', run: () => showNewSessionMenu(controller) },
		searchable: true,
		sections: [
			{ id: 'sessions', title: t('agent.sessions'), items: sessions, emptyText: t('agent.noSessions') },
			{
				id: 'history',
				title: t('agent.history'),
				items: history,
				emptyText: controller.historyState === 'error' ? controller.historyError : controller.historyState === 'ready' ? t('agent.historyEmpty') : t('agent.loading'),
			},
			{ id: 'usage', items: [{ id: 'usage', label: t('agent.usage'), icon: 'chart-no-axes-column', target: { feature: 'terminal', section: 'usage' }, active: section === 'usage' }] },
		],
	};
}

export function agentWorkbench(controller: AgentController): AgentWorkbench {
	return {
		panel: (target) => agentPanel(controller, target),
		title: (target) => {
			if (target.section === 'history') return t('agent.history');
			if (target.section === 'usage') return t('agent.usage');
			const session = target.resourceId ? controller.sessions.get(target.resourceId) : undefined;
			return session ? `${t('workbench.agent')} · ${session.title}` : undefined;
		},
		status: () => controller.status().filter((row) => !row.automated),
		usage: () => ({
			source: controller.usage,
			pinned: controller.usagePinned(),
			chips: () => controller.usage.getState().snapshots.flatMap((snapshot) => {
				const chip = formatUsageChip(snapshot);
				return chip ? [snapshot.provider + ' ' + chip] : [];
			}).join(' · '),
		}),
		subscribe: (listener) => controller.subscribe(listener),
	};
}
