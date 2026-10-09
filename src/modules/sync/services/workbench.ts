import { moment } from 'obsidian';
import type { PanelItem, PanelModel, WorkbenchTarget } from '../../../app/contracts/workbench';
import { t } from '../../../shared/i18n/index';
import type { SyncStatusRow, SyncWorkbench } from '../api';
import { changeCount } from '../core/status';
import { errorText, lastRunText } from './report';
import type { SyncService } from './sync-service';

const sectionOf = (target: WorkbenchTarget) => (target.section === 'history' ? 'history' : 'changes');

function relativeTime(at: number): string {
	return moment(at).fromNow();
}

/** Status rows: a run in progress, conflicts, a failed last run, automatic sync paused after failures, unpushed commits. */
export function syncStatus(service: SyncService | undefined): SyncStatusRow[] {
	const snapshot = service?.snapshot;
	if (!snapshot || snapshot.phase !== 'ready') return [];
	const rows: SyncStatusRow[] = [];
	if (snapshot.running && snapshot.running !== 'refresh')
		rows.push({ id: 'running', kind: 'running', label: t('sync.status.running', { action: t(`sync.action.${snapshot.running}`) }), section: 'changes' });
	const conflicts = snapshot.status?.conflicted.length ?? 0;
	if (snapshot.operation || conflicts) rows.push({ id: 'conflict', kind: 'error', label: t('sync.status.conflict', { count: conflicts }), section: 'changes' });
	else if (snapshot.last && !snapshot.last.ok) rows.push({ id: 'failed', kind: 'error', label: t('sync.status.failed'), section: 'changes' });
	if (snapshot.device.paused === 'failures') rows.push({ id: 'paused', kind: 'error', label: t('sync.status.pausedFailures'), section: 'changes' });
	const ahead = snapshot.status?.ahead ?? 0;
	if (ahead && !snapshot.running) rows.push({ id: 'ahead', kind: 'info', label: t('sync.status.ahead', { count: ahead }), section: 'changes' });
	return rows;
}

/** The side panel: where the repository stands, the last run, and the two pages. */
export function syncPanel(service: SyncService | undefined, target: WorkbenchTarget): PanelModel {
	const snapshot = service?.snapshot;
	const section = sectionOf(target);
	const pages: PanelItem[] = [
		{ id: 'changes', label: t('workbench.syncChanges'), icon: 'file-diff', badge: snapshot?.status ? changeCount(snapshot.status) || undefined : undefined, target: { feature: 'sync', section: 'changes' }, active: section === 'changes' },
		{ id: 'history', label: t('workbench.history'), icon: 'history', target: { feature: 'sync', section: 'history' }, active: section === 'history' },
	];
	if (!service || !snapshot || snapshot.phase !== 'ready') {
		const label = !snapshot || snapshot.phase === 'starting' ? t('sync.starting') : snapshot.phase === 'no-git' ? t('sync.noGitShort') : t('sync.noRepoShort');
		return { sections: [{ id: 'state', items: [{ id: 'phase', label, icon: 'info', target: { feature: 'sync', section: 'changes' } }] }, { id: 'pages', items: pages }] };
	}
	const status = snapshot.status;
	const state: PanelItem[] = [];
	if (status) {
		const branch = status.branch ?? t('sync.detached');
		const meta = status.upstream ? (status.upstreamGone ? t('sync.upstreamGone') : `↑${status.ahead} ↓${status.behind}`) : t('sync.noUpstream');
		state.push({ id: 'branch', label: status.upstream ? `${branch} → ${status.upstream}` : branch, icon: 'git-branch', meta, target: { feature: 'sync', section: 'changes' } });
	} else if (snapshot.error) state.push({ id: 'error', label: errorText(snapshot.error.kind), icon: 'alert-triangle', target: { feature: 'sync', section: 'changes' } });
	const last = snapshot.last;
	state.push({
		id: 'last',
		label: snapshot.running && snapshot.running !== 'refresh' ? t('sync.status.running', { action: t(`sync.action.${snapshot.running}`) }) : lastRunText(last),
		icon: snapshot.running && snapshot.running !== 'refresh' ? 'loader' : !last ? 'clock' : last.ok ? 'check' : 'alert-triangle',
		meta: last ? relativeTime(last.at) : undefined,
		target: { feature: 'sync', section: 'changes' },
	});
	if (snapshot.device.paused)
		state.push({ id: 'paused', label: snapshot.device.paused === 'failures' ? t('sync.status.pausedFailures') : t('sync.paused'), icon: 'pause', select: () => service.setPaused(false), meta: t('sync.resume') });
	return {
		primary: { label: t('sync.commitAndSync'), icon: 'refresh-cw', run: () => service.commitAndSync('all').then(() => undefined) },
		sections: [
			{ id: 'state', title: t('sync.panelState'), items: state },
			{ id: 'pages', items: pages },
		],
	};
}

/** The `sync.workbench` service. */
export function syncWorkbench(service: () => SyncService | undefined, subscribe: (listener: () => void) => () => void): SyncWorkbench {
	return {
		panel: (target) => syncPanel(service(), target),
		title: (target) => `${t('workbench.sync')} · ${sectionOf(target) === 'history' ? t('workbench.history') : t('workbench.syncChanges')}`,
		status: () => syncStatus(service()),
		subscribe,
	};
}
