/** Browser AI workbench rules. Live site support is never inferred from these fixtures. */

export type BrowserFocus = 'address' | 'toolbar' | 'find' | 'page' | 'outside';

/** Mod+F opens find from the address or toolbar. Mod+L selects the address. Each chord is one action. */
export function browserShortcut(event: { key: string; mod: boolean; target: BrowserFocus }): 'find' | 'address' | 'none' {
	if (!event.mod || event.target === 'outside' || event.target === 'page') return 'none';
	const key = event.key.toLowerCase();
	if (key === 'f' && (event.target === 'address' || event.target === 'toolbar' || event.target === 'find')) return 'find';
	if (key === 'l') return 'address';
	return 'none';
}

export const DEFAULT_PARTITION = 'persist:nand-browser';

export interface BrowserProfile {
	id: string;
	kind: 'default' | 'isolated';
	partition: string;
}

export function defaultProfile(): BrowserProfile {
	return { id: 'default', kind: 'default', partition: DEFAULT_PARTITION };
}

export function createIsolatedProfile(profiles: readonly BrowserProfile[], id: string): BrowserProfile[] {
	if (profiles.some((profile) => profile.id === id)) return [...profiles];
	return [...profiles, { id, kind: 'isolated', partition: `persist:nand-browser-${id}` }];
}

/** Deleting an isolated profile lists the guests to close. The default partition cannot be deleted. */
export function deleteIsolatedProfile(profiles: readonly BrowserProfile[], id: string, guests: readonly { id: string; profileId: string }[]): { profiles: BrowserProfile[]; closedGuestIds: string[]; refused: boolean } {
	const target = profiles.find((profile) => profile.id === id);
	if (!target || target.kind === 'default') return { profiles: [...profiles], closedGuestIds: [], refused: true };
	return {
		profiles: profiles.filter((profile) => profile.id !== id),
		closedGuestIds: guests.filter((guest) => guest.profileId === id).map((guest) => guest.id),
		refused: false,
	};
}

export type BindingState = 'ready' | 'login-required' | 'challenge' | 'busy' | 'disconnected' | 'unverified';
export type SendPhase = 'idle' | 'queued' | 'checking' | 'staged' | 'submitting' | 'submitted' | 'unknown' | 'failed' | 'cancelled';
export type CapturePhase = 'idle' | 'generating' | 'complete' | 'incomplete' | 'failed';

export interface ExchangeTarget {
	id: string;
	binding: BindingState;
	send: SendPhase;
	capture: CapturePhase;
	attempt: number;
	answer?: string;
}

export const AI_SITES = ['deepseek', 'kimi', 'chatgpt', 'claude', 'qwen', 'doubao', 'coze', 'minimax'] as const;
export type AiSite = (typeof AI_SITES)[number];

/** Official home pages. A row here is not a live-support record. */
export const SITE_HOME: Record<AiSite, string> = {
	deepseek: 'https://chat.deepseek.com/',
	kimi: 'https://www.kimi.com/',
	chatgpt: 'https://chatgpt.com/',
	claude: 'https://claude.ai/',
	qwen: 'https://www.tongyi.com/',
	doubao: 'https://www.doubao.com/',
	coze: 'https://www.coze.cn/',
	minimax: 'https://www.minimaxi.com/',
};

/** A source fixture is not a live support record. */
export function siteSupport(verifiedIds: readonly string[] = []): { id: AiSite; verified: boolean }[] {
	const verified = new Set(verifiedIds);
	return AI_SITES.map((id) => ({ id, verified: verified.has(id) }));
}

export function canSubmit(target: ExchangeTarget): boolean {
	return target.binding === 'ready' && target.send !== 'submitting';
}

/** Logged out, busy, disconnected, or unverified targets are not submitted. */
export function queueTargets(targets: readonly ExchangeTarget[]): ExchangeTarget[] {
	return targets.map((target) => (canSubmit(target) ? { ...target, send: 'queued' } : target));
}

/** A lost channel stays unknown. Successful answers remain. Nothing is auto-resent. */
export function channelLost(targets: readonly ExchangeTarget[]): ExchangeTarget[] {
	return targets.map((target) => {
		if (target.send === 'submitting' || target.send === 'submitted' || target.send === 'checking' || target.send === 'staged') {
			return { ...target, send: 'unknown', capture: target.capture === 'complete' ? 'complete' : target.capture };
		}
		return { ...target };
	});
}

/** Recollect reads the current answer and does not create an attempt. */
export function recollect(target: ExchangeTarget): ExchangeTarget {
	return { ...target, capture: target.answer ? 'complete' : target.capture };
}

export function explicitResend(target: ExchangeTarget): ExchangeTarget {
	return { ...target, send: 'queued', capture: 'idle', attempt: target.attempt + 1, answer: undefined };
}

export interface MaiwReject {
	ok: false;
	reason: 'version' | 'size' | 'orphan' | 'url';
}

export interface MaiwPreview {
	ok: true;
	sessions: number;
	turns: number;
}

const OFFICIAL_HOSTS = new Set([
	'chat.deepseek.com',
	'kimi.moonshot.cn',
	'www.kimi.com',
	'chatgpt.com',
	'chat.openai.com',
	'claude.ai',
	'www.tongyi.com',
	'tongyi.aliyun.com',
	'www.doubao.com',
	'www.coze.cn',
	'www.coze.com',
	'www.minimaxi.com',
	'chat.minimaxi.com',
]);

export const MAIW_MAX_BYTES = 50 * 1024 * 1024;

/** Reject a bad archive before any record is written. */
export function previewMaiw(raw: string, bytes = new TextEncoder().encode(raw).length): MaiwPreview | MaiwReject {
	if (bytes > MAIW_MAX_BYTES) return { ok: false, reason: 'size' };
	let rows: unknown[];
	try {
		rows = raw.split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line) as unknown);
	} catch {
		return { ok: false, reason: 'version' };
	}
	const sessions = new Set<string>();
	let turns = 0;
	for (const row of rows) {
		if (!row || typeof row !== 'object') return { ok: false, reason: 'version' };
		const record = row as { v?: unknown; version?: unknown; sessionId?: unknown; turnId?: unknown; parentId?: unknown; url?: unknown };
		const version = record.v ?? record.version;
		if (version !== 3 && version !== '3') return { ok: false, reason: 'version' };
		if (typeof record.url === 'string') {
			try {
				if (!OFFICIAL_HOSTS.has(new URL(record.url).hostname)) return { ok: false, reason: 'url' };
			} catch {
				return { ok: false, reason: 'url' };
			}
		}
		if (typeof record.sessionId !== 'string') return { ok: false, reason: 'orphan' };
		sessions.add(record.sessionId);
		if (typeof record.turnId === 'string') {
			turns += 1;
			if (typeof record.parentId === 'string' && record.parentId && !rows.some((item) => (item as { turnId?: string }).turnId === record.parentId)) {
				return { ok: false, reason: 'orphan' };
			}
		}
	}
	return { ok: true, sessions: sessions.size, turns };
}

export function importMaiw(raw: string, store: readonly { id: string }[]): { store: { id: string }[]; written: boolean; reason?: MaiwReject['reason'] } {
	const preview = previewMaiw(raw);
	if (!preview.ok) return { store: [...store], written: false, reason: preview.reason };
	const ids = new Set(store.map((item) => item.id));
	const added = raw
		.split(/\r?\n/)
		.filter((line) => line.trim())
		.map((line) => JSON.parse(line) as { sessionId: string })
		.filter((row) => !ids.has(row.sessionId))
		.map((row) => ({ id: row.sessionId }));
	const unique = added.filter((row, index) => added.findIndex((item) => item.id === row.id) === index);
	return { store: [...store, ...unique], written: true };
}

export interface AssistantGrant {
	scope: readonly string[];
	highConsequence: boolean;
	confirmed: boolean;
}

/** Page text is data. It cannot widen a grant. A refused high-consequence action does nothing. */
export function authorizeAssistant(grant: AssistantGrant, requested: readonly string[], pageText: string): { allowed: boolean; reason?: 'widened' | 'refused' | 'unconfirmed' } {
	void pageText;
	if (requested.some((item) => !grant.scope.includes(item))) return { allowed: false, reason: 'widened' };
	if (grant.highConsequence && !grant.confirmed) return { allowed: false, reason: 'unconfirmed' };
	return { allowed: true };
}

/** Keep the Markdown of one turn. Earlier turns are not stored as the answer. */
export function currentTurnMarkdown(events: readonly { role: 'user' | 'assistant'; text: string; turn: number }[]): string {
	if (!events.length) return '';
	const turn = events[events.length - 1]!.turn;
	return events.filter((event) => event.turn === turn).map((event) => event.text).join('\n\n');
}

/**
 * After every target is prechecked, decide whether this round may write.
 * One site that is not ready blocks the round unless the user asked for ready targets only.
 * Acquisition never calls a model.
 */
export function chooseAcquisition(input: {
	prompt: string;
	shots: readonly { binding: ExchangeTarget['binding'] }[];
	readyOnly?: boolean;
}): { mode: 'current-turn' | 'skip'; calls: 0; reason?: 'empty' | 'blocked' } {
	if (!input.prompt.trim()) return { mode: 'skip', calls: 0, reason: 'empty' };
	const waiting = input.shots.filter((shot) => shot.binding !== 'ready');
	if (input.shots.length > 0 && waiting.length === input.shots.length) return { mode: 'skip', calls: 0, reason: 'blocked' };
	if (waiting.length > 0 && !input.readyOnly) return { mode: 'skip', calls: 0, reason: 'blocked' };
	return { mode: 'current-turn', calls: 0 };
}

/** Opt-in synthesis asks the shared runner once, and only when a completed answer exists. */
export function synthesisPlan(optIn: boolean, captures: readonly { capture: CapturePhase; answer?: string }[]): { calls: 0 | 1 } {
	if (!optIn) return { calls: 0 };
	return { calls: captures.some((item) => item.capture === 'complete' && !!item.answer?.trim()) ? 1 : 0 };
}

export function freezePrompt(prompt: string, at: number): { prompt: string; frozenAt: number } {
	return { prompt, frozenAt: at };
}

export interface LocalTask {
	id: string;
	prompt: string;
	at: number;
	status: 'done' | 'cancelled' | 'failed';
}

export function rememberTask(history: readonly LocalTask[], task: LocalTask): LocalTask[] {
	return [...history, task];
}

export function compareCaptures(rows: readonly { site: string; answer?: string; capture: CapturePhase }[]): { sites: string[]; complete: string[] } {
	return {
		sites: rows.map((row) => row.site),
		complete: rows.filter((row) => row.capture === 'complete' && row.answer).map((row) => row.site),
	};
}

/** One run, one receipt. Cancel uses the caller's existing cancel flag. */
export function automationReceipt(id: string, cancelled: boolean): { id: string; state: 'done' | 'cancelled' } {
	return { id, state: cancelled ? 'cancelled' : 'done' };
}

/** Methods the local bridge may run. Anything else is out of scope. */
export const BRIDGE_SCOPE = [
	'tab.list', 'tab.create', 'tab.close', 'tab.switch',
	'snapshot', 'goto', 'back', 'forward', 'reload', 'stop', 'screenshot', 'console', 'network', 'viewport', 'scroll', 'wait',
	'click', 'dblclick', 'hover', 'drag', 'fill', 'type', 'focus', 'select', 'check', 'get', 'keypress',
] as const;

/** The bridge is off unless enabled. Expired, revoked and out-of-scope calls do nothing. */
export function admitBridge(input: {
	enabled: boolean;
	tokenOk: boolean;
	scope: readonly string[];
	method: string;
	expiresAt: number;
	revoked: boolean;
	now: number;
}): { allowed: boolean; reason?: 'disabled' | 'unauthorized' | 'expired' | 'revoked' | 'scope' } {
	if (!input.enabled) return { allowed: false, reason: 'disabled' };
	if (input.revoked) return { allowed: false, reason: 'revoked' };
	if (input.now >= input.expiresAt) return { allowed: false, reason: 'expired' };
	if (!input.tokenOk) return { allowed: false, reason: 'unauthorized' };
	if (!input.scope.includes(input.method)) return { allowed: false, reason: 'scope' };
	return { allowed: true };
}
