import { BrowserError } from '../model';
import { validateMaiwExchange, validateMaiwSession, validateMaiwTurn, type MaiwExchange, type MaiwTurn } from './maiw-format';
import type { HistoryImport, WorkspaceExchange, WorkspaceTask, WorkspaceTurn } from './model';

function origin(value: HistoryImport<{ id: string }>): void {
	if (!value || value.format !== 'maiw-v3' || typeof value.sourceId !== 'string' || !value.sourceId
		|| typeof value.fingerprint !== 'string' || !/^[a-f\d]{64}$/.test(value.fingerprint) || !value.record || value.record.id !== value.sourceId) throw new BrowserError('browser_workspace_storage');
}

export function importedTurnRecord(turn: WorkspaceTurn): MaiwTurn {
	const source = turn.imported!;
	return { ...source.record, prompt: turn.finalPrompt, ...(source.hasQuestion ? { userQuestion: turn.question } : {}),
		...(source.templates ? { appliedPromptTemplates: source.templates.map((row, index) => ({ ...row, name: turn.templates[index]!.title, content: turn.templates[index]!.body })) } : {}) };
}
export function importedAnswerRecord(exchange: WorkspaceExchange): MaiwExchange {
	const source = exchange.imported!;
	return { ...source.record, ...(source.text !== undefined ? { responseText: source.text } : {}), ...(source.markdown !== undefined ? { responseMarkdown: source.markdown } : {}) };
}

/** Imported transcripts cannot acquire the authority of native submission receipts or verified captures. */
export function validateImportedTask(task: WorkspaceTask): void {
	if (task.imported === undefined) return;
	try { origin(task.imported); validateMaiwSession(structuredClone(task.imported.record)); }
	catch { throw new BrowserError('browser_workspace_storage'); }
}
export function validateImportedTurn(turn: WorkspaceTurn): void {
	if (turn.imported === undefined) return;
	try {
		const source = turn.imported; origin(source);
		if (typeof source.hasQuestion !== 'boolean' || (source.templates !== undefined && (!Array.isArray(source.templates) || source.templates.length !== turn.templates.length))
			|| (source.templates === undefined && turn.templates.length)) throw new Error('Invalid template metadata');
		validateMaiwTurn(importedTurnRecord(turn));
		if (turn.targets.some(target => target.page || target.conversationId || target.verifiedAt !== undefined || target.status !== 'unverified')) throw new Error('Imported target is not verified');
	} catch { throw new BrowserError('browser_workspace_storage'); }
}
export function validateImportedExchange(exchange: WorkspaceExchange, turn: WorkspaceTurn): void {
	if (exchange.imported === undefined) { if (turn.imported) throw new BrowserError('browser_workspace_storage'); return; }
	try {
		origin(exchange.imported); const source = validateMaiwExchange(importedAnswerRecord(exchange));
		if (!turn.imported || source.turnId !== turn.imported.sourceId || source.sessionId !== turn.imported.record.sessionId
			|| turn.targets.find(target => target.id === exchange.targetId)?.provider !== source.providerId
			|| exchange.receipt || exchange.attempts.length || exchange.captures.length || exchange.acquisitionState === 'complete') throw new Error('Invalid imported relation');
	} catch { throw new BrowserError('browser_workspace_storage'); }
}
