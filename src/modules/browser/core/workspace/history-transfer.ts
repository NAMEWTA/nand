import { BrowserError } from '../model';
import { officialConversationUrl, officialWorkspaceOrigin } from '../providers/official-url';
import { validateWorkspace } from './documents';
import { importedAnswerRecord, importedTurnRecord } from './imported';
import type { MaiwExchange, MaiwHistory, MaiwSession, MaiwTurn } from './maiw-format';
import { parseMaiwHistory } from './maiw-format';
import { emptyWorkspace, type HistoryImport, type TargetBinding, type WorkspaceData, type WorkspaceTask } from './model';
import { panelLayout } from './panel-layout';
import { snapshotJson } from './snapshot';

type Kind = 'sessions' | 'turns' | 'exchanges';
export interface HistoryImportPlan {
	additions: WorkspaceData;
	counts: Record<Kind, { added: number; duplicate: number }>;
	conflicts: Array<{ kind: Kind; sourceId: string }>;
}

/** Source IDs identify imports; the fingerprint records the imported version without overriding later local edits. */
export async function planHistoryImport(history: MaiwHistory, current: WorkspaceData, ports: {
	id(): string; hash(value: string): Promise<string>; accountLabel: string;
}): Promise<HistoryImportPlan> {
	const plan: HistoryImportPlan = { additions: emptyWorkspace(), counts: { sessions: { added: 0, duplicate: 0 }, turns: { added: 0, duplicate: 0 }, exchanges: { added: 0, duplicate: 0 } }, conflicts: [] };
	const existing = {
		sessions: new Map(current.tasks.filter(row => row.imported).map(row => [row.imported!.sourceId, row])),
		turns: new Map(current.turns.filter(row => row.imported).map(row => [row.imported!.sourceId, row])),
		exchanges: new Map(current.exchanges.filter(row => row.imported).map(row => [row.imported!.sourceId, row])),
	};
	const fingerprints = { sessions: new Map<string, string>(), turns: new Map<string, string>(), exchanges: new Map<string, string>() };
	for (const kind of ['sessions', 'turns', 'exchanges'] as const) for (const row of history[kind]) {
		const fingerprint = await ports.hash(snapshotJson(row)!); fingerprints[kind].set(row.id, fingerprint);
		const local = existing[kind].get(row.id);
		if (!local) plan.counts[kind].added++;
		else if (local.imported!.fingerprint === fingerprint) plan.counts[kind].duplicate++;
		else plan.conflicts.push({ kind, sourceId: row.id });
	}
	if (plan.conflicts.length) return plan;
	const source = <T extends { id: string }>(kind: Kind, row: T): HistoryImport<T> => ({ format: 'maiw-v3', sourceId: row.id, fingerprint: fingerprints[kind].get(row.id)!, record: structuredClone(row) });
	const tasks = new Map<string, string>(), turns = new Map<string, string>(), panels = new Map<string, string>();
	const panelId = async (sessionId: string, panelId: string): Promise<string> => {
		const key = JSON.stringify([sessionId, panelId]);
		if (!panels.has(key)) panels.set(key, 'maiw-panel-' + await ports.hash(key));
		return panels.get(key)!;
	};
	for (const row of history.sessions) tasks.set(row.id, existing.sessions.get(row.id)?.id ?? ports.id());
	for (const row of history.turns) turns.set(row.id, existing.turns.get(row.id)?.id ?? ports.id());
	for (const row of history.sessions) {
		if (existing.sessions.has(row.id)) continue;
		const targets: TargetBinding[] = [];
		for (const panel of row.workspace.panels.toSorted((a, b) => a.order - b.order)) targets.push({ id: await panelId(row.id, panel.panelId), provider: panel.providerId,
			profileId: 'unbound', accountLabel: ports.accountLabel, officialUrl: panel.url, status: 'unverified' });
		plan.additions.tasks.push({ id: tasks.get(row.id)!, title: row.title, pinned: row.pinnedAt !== undefined, createdAt: Date.parse(row.createdAt), updatedAt: Date.parse(row.contentUpdatedAt),
			draft: '', targets, selectedTargetIds: [], visibleTargetIds: [], imported: source('sessions', row) });
	}
	const sessions = new Map(history.sessions.map(row => [row.id, row]));
	const byTurn = new Map<string, MaiwExchange[]>();
	for (const row of history.exchanges) { const list = byTurn.get(row.turnId) ?? []; list.push(row); byTurn.set(row.turnId, list); }
	for (const row of history.turns) {
		if (existing.turns.has(row.id)) continue;
		const targets: TargetBinding[] = [];
		for (const exchange of (byTurn.get(row.id) ?? []).toSorted((a, b) => a.targetIndex - b.targetIndex)) {
			const panel = sessions.get(row.sessionId)!.workspace.panels.find(panel => panel.panelId === exchange.panelId && panel.providerId === exchange.providerId);
			targets.push({ id: await panelId(row.sessionId, exchange.panelId), provider: exchange.providerId, profileId: 'unbound', accountLabel: ports.accountLabel,
				officialUrl: panel?.url ?? officialConversationUrl(exchange.providerId), status: 'unverified' });
		}
		const { prompt, userQuestion, appliedPromptTemplates, ...record } = row;
		const templates = [];
		for (const [index, template] of (appliedPromptTemplates ?? []).entries()) templates.push({ id: 'maiw-template-' + await ports.hash(JSON.stringify([row.id, index, template.id])), revision: 1, title: template.name, body: template.content });
		plan.additions.turns.push({ id: turns.get(row.id)!, taskId: tasks.get(row.sessionId)!, sequence: row.sequence, question: userQuestion ?? prompt, finalPrompt: prompt, templates, targets, createdAt: Date.parse(row.createdAt),
			imported: { ...source('turns', record), hasQuestion: userQuestion !== undefined, ...(appliedPromptTemplates ? { templates: appliedPromptTemplates.map(({ id, order }) => ({ id, order })) } : {}) } });
	}
	for (const row of history.exchanges) {
		if (existing.exchanges.has(row.id)) continue;
		const { responseText, responseMarkdown, ...record } = row;
		plan.additions.exchanges.push({ id: ports.id(), turnId: turns.get(row.turnId)!, targetId: await panelId(row.sessionId, row.panelId), attempts: [], captures: [],
			submitState: row.submitStatus === 'submitted' ? 'submitted' : 'paused', acquisitionState: 'incomplete', saveState: 'saved',
			imported: { ...source('exchanges', record), ...(responseText !== undefined ? { text: responseText } : {}), ...(responseMarkdown !== undefined ? { markdown: responseMarkdown } : {}) } });
	}
	try { mergeHistoryImport(current, plan); }
	catch { throw new BrowserError('browser_workspace_import_local_conflict'); }
	return plan;
}

/** One validated store edit owns the whole addition; filesystem failures use the workspace recovery contract. */
export function mergeHistoryImport(current: WorkspaceData, plan: HistoryImportPlan): WorkspaceData {
	if (plan.conflicts.length) throw new BrowserError('browser_workspace_import_conflict');
	return validateWorkspace(structuredClone({ ...current, tasks: [...current.tasks, ...plan.additions.tasks], turns: [...current.turns, ...plan.additions.turns], exchanges: [...current.exchanges, ...plan.additions.exchanges] }));
}

/** Emits only the supported v3 contract; NAND receipts, profiles, capture histories and independent template library are not included. */
export function exportMaiwHistory(data: WorkspaceData, taskIds: readonly string[], exportedAt: string): string {
	if (!taskIds.length || new Set(taskIds).size !== taskIds.length || taskIds.some(id => !data.tasks.some(task => task.id === id))) throw new BrowserError('browser_workspace_export_scope');
	const selected = new Set(taskIds), tasks = data.tasks.filter(task => selected.has(task.id)), turns = data.turns.filter(turn => selected.has(turn.taskId));
	const exportedTasks = new Map(tasks.map(task => [task.id, task.imported?.sourceId ?? task.id])), exportedTurns = new Map(turns.map(turn => [turn.id, turn.imported?.sourceId ?? turn.id]));
	const currentPanels = (task: WorkspaceTask) => {
		const layout = panelLayout(task), bindings = new Map(task.targets.map(target => [target.id, target]));
		return layout.order.map(id => bindings.get(id)!).filter((target, index, targets) => targets.findIndex(row => row.provider === target.provider) === index).map((target, order) => ({
			panelId: target.id, providerId: target.provider, url: officialConversationUrl(target.provider, target.conversationId) ?? (target.officialUrl && officialWorkspaceOrigin(target.provider, target.officialUrl) ? new URL(target.officialUrl).origin + '/' : officialConversationUrl(target.provider)!),
			order, selected: task.selectedTargetIds.includes(target.id), widthRatio: layout.widths[target.id] ?? 1,
		}));
	};
	const sessions: MaiwSession[] = tasks.map(task => task.imported ? { ...structuredClone(task.imported.record), title: task.title,
		...(task.pinned ? { pinnedAt: task.imported.record.pinnedAt ?? new Date(task.updatedAt).toISOString() } : { pinnedAt: undefined }) } : {
		id: task.id, title: task.title, source: 'local', createdAt: new Date(task.createdAt).toISOString(), contentUpdatedAt: new Date(task.updatedAt).toISOString(), lastOpenedAt: new Date(task.updatedAt).toISOString(),
		...(task.pinned ? { pinnedAt: new Date(task.updatedAt).toISOString() } : {}), workspace: { layoutMode: 'tiles', updatedAt: new Date(task.updatedAt).toISOString(), panels: currentPanels(task) },
	});
	const answerGroups = new Map<string, WorkspaceData['exchanges']>();
	for (const exchange of data.exchanges) { const rows = answerGroups.get(exchange.turnId) ?? []; rows.push(exchange); answerGroups.set(exchange.turnId, rows); }
	const status = (id: string): MaiwTurn['status'] => {
		const rows = answerGroups.get(id) ?? [];
		if (rows.some(row => ['waiting', 'collecting'].includes(row.acquisitionState) || ['staging', 'staged', 'submitting'].includes(row.submitState))) return 'waiting';
		if (rows.length && rows.every(row => row.captures.find(capture => capture.id === row.currentCaptureId)?.complete)) return 'completed';
		if (rows.length && rows.every(row => row.submitState === 'not-sent' || row.acquisitionState === 'failed')) return 'failed';
		return 'partial';
	};
	const records: MaiwTurn[] = turns.toSorted((a, b) => a.createdAt - b.createdAt || a.sequence - b.sequence).map(turn => turn.imported ? importedTurnRecord(turn) : ({ id: turn.id, sessionId: exportedTasks.get(turn.taskId)!, sequence: turn.sequence,
		prompt: turn.finalPrompt, userQuestion: turn.question, appliedPromptTemplates: turn.templates.map((template, order) => ({ id: template.id, name: template.title, content: template.body, order })), createdAt: new Date(turn.createdAt).toISOString(),
		status: status(turn.id),
	}));
	const byTurn = new Map(turns.map(turn => [turn.id, turn]));
	const exchanges: MaiwExchange[] = data.exchanges.filter(exchange => byTurn.has(exchange.turnId)).map(exchange => {
		if (exchange.imported) return importedAnswerRecord(exchange);
		const turn = byTurn.get(exchange.turnId)!, targetIndex = turn.targets.findIndex(target => target.id === exchange.targetId), target = turn.targets[targetIndex]!;
		const capture = exchange.captures.find(capture => capture.id === exchange.currentCaptureId);
		return { id: exchange.id, sessionId: exportedTasks.get(turn.taskId)!, turnId: exportedTurns.get(turn.id)!, panelId: target.id, providerId: target.provider, providerName: target.provider, targetIndex,
			submitStatus: exchange.submitState === 'submitted' ? 'submitted' : exchange.submitState === 'not-sent' ? 'failed' : exchange.submitState === 'unknown' ? 'unavailable'
				: ['staging', 'staged'].includes(exchange.submitState) ? 'prepared' : ['idle', 'submitting'].includes(exchange.submitState) ? 'pending' : 'aborted',
			responseStatus: capture?.complete ? 'completed' : capture ? 'partial' : exchange.acquisitionState === 'failed' ? 'failed' : 'unsupported',
			...(capture ? { responseMarkdown: capture.markdown, captureId: capture.id, responseRevision: capture.revision, responseObservedAt: new Date(capture.capturedAt).toISOString(),
				captureSource: capture.source === 'scoped-dom' ? 'dom' : capture.source, terminalReason: capture.complete ? 'completed' as const : 'uncertain-final' as const } : {}) };
	});
	const lines = [{ type: 'manifest', format: 'multi-ai-workspace-history', version: 3, exportedAt, counts: { sessions: sessions.length, turns: records.length, exchanges: exchanges.length } },
		...sessions.map(data => ({ type: 'session', data })), ...records.map(data => ({ type: 'turn', data })), ...exchanges.map(data => ({ type: 'exchange', data }))];
	const result = lines.map(line => JSON.stringify(line)).join('\n') + '\n';
	try { parseMaiwHistory(result); } catch { throw new BrowserError('browser_workspace_export_v3_limits'); } return result;
}
