// MAIW v3 field contract: src/db/history-transfer.ts at b6b83ca90f0f67fbf25a676e7a8f6b8b34327800 (MIT).
// Copyright (c) 2026 NAMEWTA. See docs/third-party/maiw-LICENSE.txt.
import { BrowserError } from '../model';
import { officialWorkspaceOrigin } from '../providers/official-url';
import { WORKSPACE_PROVIDERS, type WorkspaceProvider } from '../providers/ids';

export const MAX_HISTORY_IMPORT_BYTES = 50 * 1024 * 1024;
export interface MaiwPanel { panelId: string; providerId: WorkspaceProvider; url: string; order: number; selected: boolean; widthRatio: number }
export interface MaiwSession {
	id: string; title: string; createdAt: string; contentUpdatedAt: string; lastOpenedAt: string; pinnedAt?: string; source: 'local' | 'imported';
	workspace: { layoutMode: 'tiles' | 'adaptive'; panels: MaiwPanel[]; updatedAt: string };
}
export interface MaiwPrompt { id: string; name: string; content: string; order: number }
export interface MaiwTurn {
	id: string; sessionId: string; sequence: number; prompt: string; userQuestion?: string; appliedPromptTemplates?: MaiwPrompt[]; createdAt: string;
	status: 'preparing' | 'aborted' | 'waiting' | 'completed' | 'partial' | 'failed';
}
export interface MaiwExchange {
	id: string; sessionId: string; turnId: string; panelId: string; providerId: WorkspaceProvider; providerName: string; targetIndex: number;
	submitStatus: 'pending' | 'prepared' | 'submitted' | 'aborted' | 'failed' | 'unavailable';
	responseStatus: 'waiting' | 'streaming' | 'completed' | 'partial' | 'timeout' | 'failed' | 'unsupported';
	responseText?: string; responseMarkdown?: string; captureId?: string; responseRevision?: number; responseObservedAt?: string;
	terminalReason?: 'completed' | 'interrupted' | 'aborted' | 'timeout' | 'navigation' | 'verification' | 'uncertain-final' | 'failed' | 'unsupported';
	captureSource?: 'dom' | 'native-copy' | 'provider-api' | 'network' | 'virtual-dom';
	nativeMimeType?: 'text/markdown' | 'text/plain' | 'text/html'; submittedAt?: string; completedAt?: string; message?: string;
}
export interface MaiwHistory { exportedAt: string; sessions: MaiwSession[]; turns: MaiwTurn[]; exchanges: MaiwExchange[] }
export class HistoryImportError extends BrowserError {
	constructor(readonly line: number) { super('browser_workspace_import_format'); }
}
const invalid = (): never => { throw new Error('Invalid MAIW v3 field'); };
const object = (value: unknown, required: string, optional = ''): Record<string, unknown> => {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
	const row = value as Record<string, unknown>, mandatory = required.split(' '), allowed = new Set([...mandatory, ...optional.split(' ')]);
	if (mandatory.some(key => !(key in row)) || Object.keys(row).some(key => !allowed.has(key))) return invalid();
	return row;
};
const string = (value: unknown, max = Infinity, min = 0): string => {
	if (typeof value !== 'string' || value.length < min || value.length > max) return invalid(); return value;
};
const integer = (value: unknown, min = 0): number => {
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) return invalid(); return value;
};
const choice = (value: unknown, choices: readonly string[]): string => {
	if (typeof value !== 'string' || !choices.includes(value)) return invalid(); return value;
};
const iso = (value: unknown): string => {
	const text = string(value), time = Date.parse(text);
	if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(text) || !Number.isFinite(time)
		|| new Date(time).toISOString().slice(0, 19) !== text.slice(0, 19)) return invalid(); return text;
};
const array = (value: unknown, max = Infinity): unknown[] => { if (!Array.isArray(value) || value.length > max) return invalid(); return value; };
const unique = (values: readonly (string | number)[]): void => { if (new Set(values).size !== values.length) invalid(); };
function panel(value: unknown): MaiwPanel {
	const row = object(value, 'panelId providerId url order selected widthRatio');
	row.panelId = string(string(row.panelId).trim(), 500, 1);
	choice(row.providerId, WORKSPACE_PROVIDERS); string(row.url, 8192); integer(row.order);
	if (!officialWorkspaceOrigin(row.providerId as WorkspaceProvider, row.url as string) || typeof row.selected !== 'boolean'
		|| typeof row.widthRatio !== 'number' || !Number.isFinite(row.widthRatio) || row.widthRatio <= 0 || row.widthRatio > 1000) invalid();
	return row as unknown as MaiwPanel;
}
export function validateMaiwSession(value: unknown): MaiwSession {
	const row = object(value, 'id title createdAt contentUpdatedAt lastOpenedAt source workspace', 'pinnedAt');
	string(row.id, Infinity, 1); string(row.title, 500); choice(row.source, ['local', 'imported']);
	for (const key of ['createdAt', 'contentUpdatedAt', 'lastOpenedAt']) iso(row[key]);
	if (row.pinnedAt !== undefined) iso(row.pinnedAt);
	const workspace = object(row.workspace, 'layoutMode panels updatedAt');
	choice(workspace.layoutMode, ['tiles', 'adaptive']); iso(workspace.updatedAt);
	const panels = array(workspace.panels, WORKSPACE_PROVIDERS.length).map(panel);
	unique(panels.map(row => row.panelId)); unique(panels.map(row => row.providerId));
	return row as unknown as MaiwSession;
}
export function validateMaiwTurn(value: unknown): MaiwTurn {
	const row = object(value, 'id sessionId sequence prompt createdAt status', 'userQuestion appliedPromptTemplates');
	string(row.id, Infinity, 1); string(row.sessionId, Infinity, 1); integer(row.sequence, 1); string(row.prompt, 100000); iso(row.createdAt);
	choice(row.status, ['preparing', 'aborted', 'waiting', 'completed', 'partial', 'failed']);
	if (row.userQuestion !== undefined) string(row.userQuestion, 100000);
	if (row.appliedPromptTemplates !== undefined) for (const value of array(row.appliedPromptTemplates, 100)) {
		const prompt = object(value, 'id name content order'); string(prompt.id, 500, 1); string(prompt.name, 120, 1); string(prompt.content, 50000); integer(prompt.order);
	}
	return row as unknown as MaiwTurn;
}
export function validateMaiwExchange(value: unknown): MaiwExchange {
	const row = object(value, 'id sessionId turnId panelId providerId providerName targetIndex submitStatus responseStatus',
		'responseText responseMarkdown captureId responseRevision responseObservedAt terminalReason captureSource nativeMimeType submittedAt completedAt message');
	for (const key of ['id', 'sessionId', 'turnId', 'panelId']) string(row[key], Infinity, 1);
	choice(row.providerId, WORKSPACE_PROVIDERS); string(row.providerName, 200, 1); integer(row.targetIndex);
	choice(row.submitStatus, ['pending', 'prepared', 'submitted', 'aborted', 'failed', 'unavailable']);
	choice(row.responseStatus, ['waiting', 'streaming', 'completed', 'partial', 'timeout', 'failed', 'unsupported']);
	for (const key of ['responseText', 'responseMarkdown']) if (row[key] !== undefined) string(row[key], 2000000);
	for (const key of ['responseObservedAt', 'submittedAt', 'completedAt']) if (row[key] !== undefined) iso(row[key]);
	if (row.captureId !== undefined) string(row.captureId, 100, 1);
	if (row.responseRevision !== undefined) integer(row.responseRevision, 1);
	if (row.message !== undefined) string(row.message, 2000);
	if (row.terminalReason !== undefined) choice(row.terminalReason, ['completed', 'interrupted', 'aborted', 'timeout', 'navigation', 'verification', 'uncertain-final', 'failed', 'unsupported']);
	if (row.captureSource !== undefined) choice(row.captureSource, ['dom', 'native-copy', 'provider-api', 'network', 'virtual-dom']);
	if (row.nativeMimeType !== undefined) choice(row.nativeMimeType, ['text/markdown', 'text/plain', 'text/html']);
	return row as unknown as MaiwExchange;
}

/** Fully validates the bundle before any ID allocation or write. Removed historical panels remain valid. */
export function parseMaiwHistory(text: string): MaiwHistory {
	if (new TextEncoder().encode(text).byteLength > MAX_HISTORY_IMPORT_BYTES) throw new BrowserError('browser_workspace_import_size');
	const lines = text.split(/\r?\n/).map((text, index) => ({ text, line: index + 1 })).filter(row => row.text.trim());
	if (!lines.length) throw new HistoryImportError(1);
	let manifest: Record<string, unknown>;
	try {
		manifest = object(JSON.parse(lines[0]!.text), 'type format version exportedAt counts');
		if (manifest.type !== 'manifest' || manifest.format !== 'multi-ai-workspace-history' || manifest.version !== 3) invalid();
		iso(manifest.exportedAt); const counts = object(manifest.counts, 'sessions turns exchanges');
		for (const value of Object.values(counts)) integer(value);
	} catch { throw new HistoryImportError(lines[0]!.line); }
	const result: MaiwHistory = { exportedAt: manifest.exportedAt as string, sessions: [], turns: [], exchanges: [] };
	for (const line of lines.slice(1)) {
		try {
			const row = object(JSON.parse(line.text), 'type data');
			if (row.type === 'session') result.sessions.push(validateMaiwSession(row.data));
			else if (row.type === 'turn') result.turns.push(validateMaiwTurn(row.data));
			else if (row.type === 'exchange') result.exchanges.push(validateMaiwExchange(row.data));
			else invalid();
		} catch { throw new HistoryImportError(line.line); }
	}
	try {
		const counts = manifest.counts as Record<string, number>;
		for (const key of ['sessions', 'turns', 'exchanges'] as const) { if (result[key].length !== counts[key]) invalid(); unique(result[key].map(row => row.id)); }
		const sessions = new Set(result.sessions.map(row => row.id)), turns = new Map(result.turns.map(row => [row.id, row]));
		if (result.turns.some(row => !sessions.has(row.sessionId)) || result.exchanges.some(row => turns.get(row.turnId)?.sessionId !== row.sessionId)) invalid();
		// NAND rounds and targets have one stable position; ambiguous relations cannot be imported faithfully.
		unique(result.turns.map(row => JSON.stringify([row.sessionId, row.sequence])));
		unique(result.exchanges.map(row => JSON.stringify([row.turnId, row.panelId])));
		unique(result.exchanges.map(row => JSON.stringify([row.turnId, row.targetIndex])));
	} catch { throw new BrowserError('browser_workspace_import_relations'); }
	return result;
}
