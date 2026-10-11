// Message/block and pagination reference adapted from MAIW b6b83ca90f0f67fbf25a676e7a8f6b8b34327800 (MIT).
// Copyright (c) 2026 NAMEWTA. See docs/third-party/maiw-LICENSE.txt.
import type { ProviderRequestIdentity } from './contracts';
import { snapshotJson } from '../workspace/snapshot';

export interface KimiMessage {
	id: string; parentId?: string; parentKnown: boolean; role: 'user' | 'assistant'; markdown: string; finished: boolean;
}
export interface KimiPage {
	conversationId: string; requestCursor?: string; nextCursor?: string; exhausted: boolean; total?: number;
	messages: KimiMessage[]; reasons: string[];
}
export interface KimiHistory {
	conversationId: string; messages: KimiMessage[]; currentMessageId?: string; branch: string[]; reasons: string[]; terminalEvidence: string[];
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const own = (value: Record<string, unknown>, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);
const identifier = (value: unknown): string | undefined => typeof value === 'string' && /^[\w-]{1,100}$/.test(value) ? value : undefined;
const cursor = (value: unknown): string | undefined => typeof value === 'string' && value.length > 0 && value.length <= 1024
	&& ![...value].some(character => character.charCodeAt(0) < 32) ? value : undefined;
const normalize = (value: unknown): string => typeof value === 'string' ? value.toLowerCase() : '';

export function kimiHistoryEndpoint(url: URL): boolean {
	return url.origin === 'https://www.kimi.com' && !url.username && !url.password
		&& url.pathname === '/apiv2/kimi.gateway.chat.v1.ChatService/ListMessages';
}
/** Only stable conversation identity and a bounded pagination cursor survive the native request callback. */
export function projectKimiRequest(body: string, method: string): ProviderRequestIdentity | undefined {
	if (method !== 'POST' || body.length > 16384) return undefined;
	try {
		const row = record(JSON.parse(body)), conversationId = identifier(row.chat_id ?? row.chatId);
		const rawCursor = row.page_token ?? row.pageToken;
		if (!conversationId || (rawCursor !== undefined && rawCursor !== '' && !cursor(rawCursor))) return undefined;
		return { conversationId, cursor: cursor(rawCursor) };
	} catch { return undefined; }
}
function publicText(row: Record<string, unknown>): string | undefined {
	if (!Array.isArray(row.blocks)) return typeof row.content === 'string' ? row.content : typeof row.text === 'string' ? row.text : undefined;
	const parts: string[] = [];
	for (const raw of row.blocks) {
		const block = record(raw), kind = normalize(block.type ?? block.kind);
		if (kind && !['text', 'markdown', 'message_block_type_text'].includes(kind)) continue;
		const value = record(block.text).content ?? block.markdown;
		if (typeof value === 'string') parts.push(value);
	}
	// Repeated blocks are meaningful content; never deduplicate the answer's text.
	return parts.length ? parts.join('\n\n') : undefined;
}
export function projectKimiPage(raw: unknown, conversationId: string, request?: ProviderRequestIdentity): KimiPage | undefined {
	if (!identifier(conversationId) || !request || request.conversationId !== conversationId) return undefined;
	const root = record(raw), data = record(root.data);
	const envelope = [root, data, record(root.result), record(data.result)].find(value => Array.isArray(value.messages));
	if (!envelope) return undefined;
	const declared = envelope.chat_id ?? envelope.chatId;
	if (declared !== undefined && declared !== conversationId) return undefined;
	const rows = envelope.messages as unknown[]; if (rows.length > 10000) return undefined;
	const messages: KimiMessage[] = [], ids = new Set<string>(), reasons: string[] = [];
	for (const rawMessage of rows) {
		const row = record(rawMessage), id = identifier(row.id ?? row.messageId ?? row.message_id), roleName = normalize(row.role ?? row.senderRole ?? row.sender_role);
		if (!id || ids.has(id)) return undefined; ids.add(id);
		const role = ['user', 'role_user'].includes(roleName) ? 'user' : ['assistant', 'role_assistant'].includes(roleName) ? 'assistant' : undefined;
		const markdown = publicText(row);
		if (!role || markdown === undefined) { reasons.push('unrecognized-public-message'); continue; }
		const parentKey = ['parentId', 'parent_id'].find(key => own(row, key)), parent = parentKey ? row[parentKey] : undefined;
		if (parent !== undefined && parent !== null && parent !== '' && !identifier(parent)) return undefined;
		const finished = role === 'user' || ['message_status_finished', 'finished', 'complete', 'completed', 'success']
			.includes(normalize(row.status ?? row.messageStatus ?? row.message_status));
		messages.push({ id, parentId: identifier(parent), parentKnown: !!parentKey, role, markdown, finished });
	}
	const nextKey = ['nextPageToken', 'next_page_token'].find(key => own(envelope, key)), rawNext = nextKey ? envelope[nextKey] : undefined;
	const nextCursor = cursor(rawNext), hasMore = envelope.hasMore ?? envelope.has_more;
	const exhausted = !nextCursor && hasMore !== true && ((!!nextKey && rawNext === '') || (!nextKey && hasMore === false));
	if ((!nextKey && hasMore !== false) || (nextKey && rawNext !== '' && !nextCursor) || (nextCursor && hasMore === false)) reasons.push('pagination-unverified');
	const rawTotal = envelope.totalCount ?? envelope.total_count ?? envelope.messageCount ?? envelope.message_count;
	const total = typeof rawTotal === 'number' && Number.isSafeInteger(rawTotal) && rawTotal >= 0 ? rawTotal : undefined;
	if (rawTotal !== undefined && total === undefined) reasons.push('message-count-invalid');
	return { conversationId, requestCursor: request.cursor, nextCursor, exhausted, total, messages, reasons };
}

/** Assemble only an observed cursor chain for this conversation. This function never issues a request. */
export function kimiHistory(pages: readonly KimiPage[], conversationId: string, current?: string): KimiHistory | undefined {
	const matching = pages.filter(page => page.conversationId === conversationId); if (!matching.length) return undefined;
	const root = matching.findLastIndex(page => page.requestCursor === undefined), source = matching.slice(Math.max(0, root));
	const reasons = new Set<string>(), byId = new Map<string, KimiMessage>(), cursors = new Set<string>();
	if (root < 0) reasons.add('initial-page-missing');
	let page: KimiPage | undefined = source[0], total: number | undefined, exhausted = false, count = 0;
	while (page) {
		const key = page.requestCursor ?? '';
		if (cursors.has(key)) { reasons.add('duplicate-cursor'); break; }
		if (++count > 32 || byId.size + page.messages.length > 10000) { reasons.add('history-bound-reached'); break; }
		cursors.add(key); for (const reason of page.reasons) reasons.add(reason);
		if (page.total !== undefined) {
			if (total !== undefined && total !== page.total) reasons.add('message-count-changed');
			total = page.total;
		}
		for (const message of page.messages) {
			const previous = byId.get(message.id);
			if (previous && snapshotJson(previous) !== snapshotJson(message)) reasons.add('conflicting-message');
			else byId.set(message.id, message);
		}
		if (page.exhausted) { exhausted = true; break; }
		if (!page.nextCursor) { reasons.add('pagination-unverified'); break; }
		const nextCursor: string = page.nextCursor;
		page = source.findLast(candidate => candidate.requestCursor === nextCursor);
		if (!page) reasons.add('missing-page');
	}
	if (!exhausted) reasons.add('pagination-unverified');
	if (total !== undefined && total !== byId.size) reasons.add('message-count-mismatch');
	const messages = [...byId.values()], parents = new Set(messages.map(message => message.parentId));
	let currentMessageId = identifier(current);
	if (!currentMessageId) {
		const leaves = messages.filter(message => !parents.has(message.id));
		if (leaves.length === 1) currentMessageId = leaves[0]!.id;
		reasons.add('active-branch-unverified');
	}
	const branch: string[] = [], visited = new Set<string>(); let tip = currentMessageId;
	while (tip) {
		if (visited.has(tip)) { reasons.add('cyclic-parent-chain'); break; }
		visited.add(tip); const message = byId.get(tip);
		if (!message) { reasons.add('missing-parent-message'); break; }
		if (!message.parentKnown) reasons.add('parent-identity-unverified');
		branch.unshift(message.id); tip = message.parentId;
	}
	const chain = branch.map(id => byId.get(id)!);
	if (!chain.length || chain.some((message, index) => message.role !== (index % 2 ? 'assistant' : 'user'))) reasons.add('invalid-role-order');
	if (chain.some(message => message.role === 'assistant' && !message.finished)) reasons.add('unfinished-assistant');
	const answer = byId.get(currentMessageId ?? ''), terminalEvidence = answer?.role === 'assistant' && answer.finished ? ['provider-message-finished'] : [];
	if (!terminalEvidence.length) reasons.add('terminal-message-unverified');
	return { conversationId, messages, currentMessageId, branch, reasons: [...reasons], terminalEvidence };
}
