// Detail/alternate/partial envelope reference: MAIW b6b83ca90f0f67fbf25a676e7a8f6b8b34327800 (MIT).
// Copyright (c) 2026 NAMEWTA. See docs/third-party/maiw-LICENSE.txt.
export interface QwenMessage { id: string; parentId?: string; parentKnown: boolean; role: 'user' | 'assistant'; markdown: string; finished: boolean }
export interface QwenHistory {
	conversationId: string; title?: string; currentMessageId?: string; messages: QwenMessage[]; branch: string[]; reasons: string[]; terminalEvidence: string[];
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const identifier = (value: unknown): string | undefined => typeof value === 'string' && /^[\w-]{1,100}$/.test(value) ? value : undefined;
const own = (value: Record<string, unknown>, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);
const normalized = (value: unknown): string => typeof value === 'string' ? value.toLowerCase() : '';
const privateKinds = ['think', 'thinking', 'reasoning', 'search', 'tool', 'tool_use', 'tool_result', 'status', 'suggestion'];

export function qwenHistoryEndpoint(url: URL): string | undefined {
	return url.origin === 'https://www.qianwen.com' && !url.username && !url.password
		? url.pathname.match(/^\/api\/v2\/conversation\/([\w-]{1,100})\/?$/)?.[1] : undefined;
}

function publicParts(value: unknown, reasons: Set<string>, depth = 0): string[] {
	if (depth > 8) { reasons.add('unsupported-public-content'); return []; }
	if (typeof value === 'string') {
		if (/^\s*[[{]/.test(value)) {
			try {
				const parsed: unknown = JSON.parse(value), rows = Array.isArray(parsed) ? parsed : [parsed];
				if (rows.some(item => ['type', 'kind', 'phase', 'text', 'markdown', 'content', 'parts', 'blocks'].some(key => own(record(item), key))))
					return publicParts(parsed, reasons, depth + 1);
			} catch { /* Literal text is not a serialized content block. */ }
		}
		return [value];
	}
	if (Array.isArray(value)) return value.flatMap(part => publicParts(part, reasons, depth + 1));
	const row = record(value), kind = normalized(row.type ?? row.kind), phase = normalized(row.phase ?? row.stage);
	if (privateKinds.includes(kind) || privateKinds.includes(phase)) return [];
	if ((kind && !['text', 'markdown'].includes(kind)) || (phase && !['answer', 'final', 'output', 'response'].includes(phase))) {
		reasons.add('unsupported-public-content'); return [];
	}
	const keys = ['text', 'markdown', 'content', 'parts', 'blocks'].filter(key => own(row, key));
	if (keys.length !== 1) { reasons.add('unsupported-public-content'); return []; }
	return publicParts(row[keys[0]!], reasons, depth + 1);
}

/** The endpoint binds the conversation; payload IDs, explicit parents and the declared active tip must agree. */
export function projectQwenHistory(raw: unknown, conversationId: string): QwenHistory | undefined {
	if (!identifier(conversationId)) return undefined;
	const root = record(raw), outer = own(root, 'data') ? record(root.data) : own(root, 'result') ? record(root.result) : root;
	if (root.success === false || root.ok === false || (typeof (root.code ?? outer.code) === 'number' && ![0, 200].includes((root.code ?? outer.code) as number))) return undefined;
	const chat = record(outer.chat), conversation = record(outer.conversation), detail = record(chat.history);
	const envelope = own(detail, 'messages') ? detail : own(conversation, 'messages') ? conversation : outer;
	const collection = envelope.messages, isArray = Array.isArray(collection);
	const entries: Array<[string | undefined, unknown]> = isArray ? collection.map(value => [undefined, value]) : Object.entries(record(collection));
	if (!entries.length || entries.length > 10000) return undefined;
	const declared = chat.id ?? conversation.id ?? outer.conversation_id;
	if (declared !== undefined && declared !== conversationId) return undefined;
	const byId = new Map<string, QwenMessage>(), ids = new Set<string>(), reasons = new Set<string>();
	for (const [key, value] of entries) {
		const row = record(value), explicit = row.message_id ?? row.messageId ?? row.id;
		const id = identifier(explicit ?? key);
		if (!id || (key !== undefined && id !== key) || ids.has(id)) return undefined;
		ids.add(id);
		const name = normalized(row.role), role = ['user', 'human'].includes(name) ? 'user' : ['assistant', 'model'].includes(name) ? 'assistant' : undefined;
		if (!role) { reasons.add('unrecognized-public-message'); continue; }
		const parentKey = ['parent_id', 'parentId', 'parent_message_id', 'parentMessageId'].find(key => own(row, key)), parent = parentKey ? row[parentKey] : undefined;
		if (parentKey && parent !== null && parent !== '' && !identifier(parent)) return undefined;
		const parts = publicParts(row.content_list ?? row.contentList ?? row.content ?? row.text, reasons);
		// Without a declared fragment mode, prefix overlap can be either revisions or meaningful text. Keep both and report uncertainty.
		if (parts.some((part, index) => part && parts.slice(index + 1).some(next => next !== part && next.startsWith(part)))) reasons.add('ambiguous-public-content');
		const markdown = parts.join('\n\n'); if (!markdown.trim()) reasons.add('empty-answer');
		byId.set(id, { id, parentId: identifier(parent), parentKnown: !!parentKey, role, markdown,
			finished: role === 'user' || ['finished', 'complete', 'completed'].includes(normalized(row.status)) || row.finish_reason === 'stop' });
	}
	const hasMore = envelope.has_more ?? outer.has_more ?? root.has_more;
	if (hasMore !== false) reasons.add('pagination-unverified');
	const count = envelope.message_count ?? outer.message_count ?? root.message_count;
	if (count !== undefined && (!Number.isSafeInteger(count) || count !== entries.length)) reasons.add('message-count-mismatch');
	const currentMessageId = identifier(envelope.current_id ?? envelope.current_message_id ?? outer.current_message_id), branch: string[] = [], seen = new Set<string>();
	if (!currentMessageId) reasons.add('active-branch-unverified');
	let cursor = currentMessageId, reachedRoot = false;
	while (cursor) {
		if (seen.has(cursor)) { reasons.add('cyclic-parent-chain'); break; }
		seen.add(cursor); const message = byId.get(cursor);
		if (!message) { reasons.add('missing-parent-message'); break; }
		branch.unshift(message.id);
		if (!message.parentKnown) { reasons.add('parent-identity-unverified'); break; }
		cursor = message.parentId; if (!cursor) reachedRoot = true;
	}
	if (!reachedRoot) reasons.add('history-beginning-unverified');
	const messages = branch.map(id => byId.get(id)!);
	if (!messages.length || messages.some((message, index) => message.role !== (index % 2 ? 'assistant' : 'user'))) reasons.add('invalid-role-order');
	if (messages.some(message => message.role === 'assistant' && !message.finished)) reasons.add('unfinished-assistant');
	const answer = messages.at(-1), terminalEvidence = answer?.role === 'assistant' && answer.finished ? ['provider-message-finished'] : [];
	if (!terminalEvidence.length) reasons.add('terminal-message-unverified');
	const title = chat.title ?? conversation.title ?? outer.title;
	return { conversationId, title: typeof title === 'string' && title.length <= 1024 ? title : undefined,
		currentMessageId, messages, branch, reasons: [...reasons], terminalEvidence };
}
