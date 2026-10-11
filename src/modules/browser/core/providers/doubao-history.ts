// Chain envelope/content reference: MAIW b6b83ca90f0f67fbf25a676e7a8f6b8b34327800 (MIT).
// Copyright (c) 2026 NAMEWTA. See docs/third-party/maiw-LICENSE.txt.
import type { ProviderRequestIdentity } from './contracts';
import { snapshotJson } from '../workspace/snapshot';

export interface DoubaoMessage { id: string; parentId?: string; parentKnown: boolean; role: 'user' | 'assistant'; markdown: string; finished: boolean }
export interface DoubaoPage {
	conversationId: string; requestCursor?: string; nextCursor?: string; exhausted: boolean; total?: number; messages: DoubaoMessage[]; reasons: string[];
}
export interface DoubaoHistory {
	conversationId: string; currentMessageId?: string; messages: DoubaoMessage[]; branch: string[]; reasons: string[]; terminalEvidence: string[];
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const own = (row: Record<string, unknown>, key: string): boolean => Object.prototype.hasOwnProperty.call(row, key);
const identifier = (value: unknown): string | undefined => typeof value === 'string' && /^[\w-]{1,100}$/.test(value) ? value : undefined;
const normalized = (value: unknown): string => typeof value === 'string' ? value.toLowerCase() : '';
const cursor = (value: unknown): string | undefined => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? String(value)
	: typeof value === 'string' && /^\d{1,20}$/.test(value) ? value : undefined;

export function doubaoHistoryEndpoint(url: URL): boolean {
	return url.origin === 'https://www.doubao.com' && !url.username && !url.password && url.pathname === '/im/chain/single';
}
export function projectDoubaoRequest(body: string, method: string): ProviderRequestIdentity | undefined {
	if (method !== 'POST' || body.length > 16384) return undefined;
	try {
		const row = record(JSON.parse(body)), conversationId = identifier(row.conversation_id ?? row.conversationId);
		if (!conversationId || (own(row, 'anchor') && !cursor(row.anchor)) || (own(row, 'direction') && row.direction !== 1)) return undefined;
		return { conversationId, cursor: cursor(row.anchor) };
	} catch { return undefined; }
}
function publicParts(value: unknown, reasons: Set<string>, depth = 0): string[] {
	if (depth > 8) { reasons.add('unsupported-public-content'); return []; }
	if (typeof value === 'string') {
		if (/^\s*[[{]/.test(value)) {
			try {
				const parsed: unknown = JSON.parse(value), rows = Array.isArray(parsed) ? parsed : [parsed];
				if (rows.some(item => ['type', 'block_type', 'kind', 'text', 'markdown', 'content', 'blocks'].some(key => own(record(item), key))))
					return publicParts(parsed, reasons, depth + 1);
			} catch { /* Preserve literal public text. */ }
		}
		return [value];
	}
	if (Array.isArray(value)) return value.flatMap(part => publicParts(part, reasons, depth + 1));
	const row = record(value), kind = normalized(row.type ?? row.block_type ?? row.kind);
	if (['thinking', 'reasoning', 'search', 'search_status', 'tool', 'tool_use', 'tool_result', 'status', 'suggestion'].includes(kind)) return [];
	const keys = ['text', 'markdown', 'content', 'blocks'].filter(key => own(row, key));
	if ((kind && !['text', 'markdown', 'paragraph'].includes(kind)) || keys.length !== 1) { reasons.add('unsupported-public-content'); return []; }
	return publicParts(row[keys[0]!], reasons, depth + 1);
}
export function projectDoubaoPage(raw: unknown, conversationId: string, request?: ProviderRequestIdentity): DoubaoPage | undefined {
	if (!identifier(conversationId) || !request || request.conversationId !== conversationId) return undefined;
	const root = record(raw), data = record(root.data), containers = [record(root.downlink_body), record(data.downlink_body), data, root];
	const envelope = containers.flatMap(row => [record(row.pull_singe_chain_downlink_body), record(row.pull_single_chain_downlink_body), row])
		.find(row => Array.isArray(row.messages));
	if (!envelope || (typeof root.code === 'number' && ![0, 200].includes(root.code))) return undefined;
	const declared = envelope.conversation_id ?? envelope.conversationId ?? root.conversation_id;
	if (declared !== undefined && declared !== conversationId) return undefined;
	const rows = envelope.messages as unknown[]; if (rows.length > 10000) return undefined;
	const messages: DoubaoMessage[] = [], ids = new Set<string>(), reasons = new Set<string>();
	for (const value of rows) {
		const row = record(value), id = identifier(row.message_id ?? row.id ?? row.server_message_id ?? row.local_message_id);
		if (!id || ids.has(id)) return undefined; ids.add(id);
		const roleName = normalized(row.role ?? row.sender_role ?? record(row.sender).role), sender = row.sender_type ?? row.user_type;
		const role = ['user', 'human', 'request'].includes(roleName) || (!roleName && sender === 1) ? 'user'
			: ['assistant', 'bot', 'model', 'response'].includes(roleName) || (!roleName && sender === 2) ? 'assistant' : undefined;
		if (!role) { reasons.add('unrecognized-public-message'); continue; }
		const parentKey = ['parent_id', 'parent_message_id', 'reply_to_message_id'].find(key => own(row, key)), parent = parentKey ? row[parentKey] : undefined;
		if (parentKey && parent !== null && parent !== '' && !identifier(parent)) return undefined;
		const markdown = publicParts(row.content_block ?? row.content_obj ?? row.message_content ?? row.content ?? row.text, reasons).join('\n\n');
		if (!markdown.trim()) reasons.add('empty-answer');
		messages.push({ id, parentId: identifier(parent), parentKnown: !!parentKey, role, markdown,
			finished: role === 'user' || ['finished', 'complete', 'completed'].includes(normalized(row.status ?? row.message_status)) });
	}
	const nextKey = ['next_index_in_conv', 'next_anchor_index', 'next_cursor'].find(key => own(envelope, key)), rawNext = nextKey ? envelope[nextKey] : undefined;
	const nextCursor = cursor(rawNext), exhausted = envelope.has_more === false;
	if (envelope.has_more !== true && !exhausted || (envelope.has_more === true && !nextCursor)
		|| (nextKey && rawNext !== null && rawNext !== '' && !nextCursor) || (exhausted && nextCursor !== undefined && nextCursor !== '0')) reasons.add('pagination-unverified');
	const rawTotal = envelope.total_count ?? envelope.message_count;
	const total = typeof rawTotal === 'number' && Number.isSafeInteger(rawTotal) && rawTotal >= 0 ? rawTotal : undefined;
	if (rawTotal !== undefined && total === undefined) reasons.add('message-count-invalid');
	return { conversationId, requestCursor: request.cursor, nextCursor, exhausted, total, messages, reasons: [...reasons] };
}

/** Start at the latest observed page containing the visible active tip; never borrow older pagination or issue requests. */
export function doubaoHistory(pages: readonly DoubaoPage[], conversationId: string, current?: string): DoubaoHistory | undefined {
	const matching = pages.filter(page => page.conversationId === conversationId); if (!matching.length) return undefined;
	const start = matching.findLastIndex(page => page.messages.some(message => message.id === current));
	const source = matching.slice(start < 0 ? -1 : start), byId = new Map<string, DoubaoMessage>(), reasons = new Set<string>(), cursors = new Set<string>();
	if (start < 0) reasons.add('active-branch-unverified');
	let index = 0, exhausted = false, total: number | undefined;
	while (index >= 0 && index < source.length) {
		const page = source[index]!, key = page.requestCursor ?? '';
		if (cursors.has(key)) { reasons.add('duplicate-cursor'); break; }
		if (cursors.size >= 32 || byId.size + page.messages.length > 10000) { reasons.add('history-bound-reached'); break; }
		cursors.add(key); for (const reason of page.reasons) reasons.add(reason);
		if (page.total !== undefined) { if (total !== undefined && total !== page.total) reasons.add('message-count-changed'); total = page.total; }
		for (const message of page.messages) {
			const previous = byId.get(message.id);
			if (previous && snapshotJson(previous) !== snapshotJson(message)) reasons.add('conflicting-message'); else byId.set(message.id, message);
		}
		if (page.exhausted) { exhausted = true; break; }
		if (!page.nextCursor) { reasons.add('pagination-unverified'); break; }
		if (cursors.has(page.nextCursor)) { reasons.add('duplicate-cursor'); break; }
		const next = source.findLastIndex((candidate: DoubaoPage, candidateIndex: number) => candidateIndex > index && candidate.requestCursor === page.nextCursor);
		if (next < 0) reasons.add('missing-page'); index = next;
	}
	if (!exhausted) reasons.add('pagination-unverified');
	if (total !== undefined && total !== byId.size) reasons.add('message-count-mismatch');
	const currentMessageId = identifier(current), branch: string[] = [], seen = new Set<string>(); let tip = currentMessageId, reachedRoot = false;
	while (tip) {
		if (seen.has(tip)) { reasons.add('cyclic-parent-chain'); break; }
		seen.add(tip); const message = byId.get(tip);
		if (!message) { reasons.add('missing-parent-message'); break; }
		branch.unshift(message.id); if (!message.parentKnown) { reasons.add('parent-identity-unverified'); break; }
		tip = message.parentId; if (!tip) reachedRoot = true;
	}
	if (!reachedRoot) reasons.add('history-beginning-unverified');
	const messages = branch.map(id => byId.get(id)!);
	if (!messages.length || messages.some((message, messageIndex) => message.role !== (messageIndex % 2 ? 'assistant' : 'user'))) reasons.add('invalid-role-order');
	if (messages.some(message => message.role === 'assistant' && !message.finished)) reasons.add('unfinished-assistant');
	const answer = messages.at(-1), terminalEvidence = answer?.role === 'assistant' && answer.finished ? ['provider-message-finished'] : [];
	if (!terminalEvidence.length) reasons.add('terminal-message-unverified');
	return { conversationId, currentMessageId, messages, branch, reasons: [...reasons], terminalEvidence };
}
