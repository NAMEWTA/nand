// Adapted from MAIW b6b83ca90f0f67fbf25a676e7a8f6b8b34327800 (MIT).
// Copyright (c) 2026 NAMEWTA. See docs/third-party/maiw-LICENSE.txt.
export interface DeepSeekMessage { id: string; parentId?: string; parentKnown: boolean; role: 'user' | 'assistant'; markdown: string }
export interface DeepSeekHistory { conversationId: string; title?: string; messages: DeepSeekMessage[]; currentMessageId?: string; branch: string[]; reasons: string[] }
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const identifier = (value: unknown): string | undefined => (typeof value === 'string' || (typeof value === 'number' && Number.isSafeInteger(value))) && /^[\w-]{1,100}$/.test(String(value)) ? String(value) : undefined;
const own = (value: Record<string, unknown>, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);
const word = (value: unknown): string => typeof value === 'string' ? value.toLowerCase() : '';

export function deepseekHistoryEndpoint(url: URL): string | undefined {
	return url.origin === 'https://chat.deepseek.com' && !url.username && !url.password && url.pathname === '/api/v0/chat/history_messages'
		? identifier(url.searchParams.get('chat_session_id')) : undefined;
}

function content(value: unknown, role: 'user' | 'assistant'): string | undefined {
	if (typeof value === 'string') return value;
	if (!Array.isArray(value)) return undefined;
	const result: string[] = [];
	for (const fragment of value) {
		const item = record(fragment), kind = word(item.type);
		if (!['text', 'markdown', role === 'user' ? 'request' : 'response'].includes(kind)) continue;
		const text = item.content ?? item.markdown ?? item.text;
		if (typeof text === 'string') result.push(text);
	}
	// Repeated prose is meaningful; unlike the reference parser, do not deduplicate fragments.
	return result.length ? result.join('\n\n') : undefined;
}

/** Projects only public message content and branch identity. History alone supplies no completion proof. */
export function projectDeepSeekHistory(raw: unknown, conversationId: string): DeepSeekHistory | undefined {
	if (!identifier(conversationId)) return undefined;
	const root = record(raw), data = record(root.data);
	const envelope = [record(data.biz_data), record(root.biz_data), data, root].find(value => Array.isArray(value.chat_messages) || Array.isArray(value.messages));
	if (!envelope) return undefined;
	const rows = (envelope.chat_messages ?? envelope.messages) as unknown[];
	if (rows.length > 10000) return undefined;
	const session = record(envelope.chat_session), declaredId = identifier(session.id ?? session.chat_session_id ?? envelope.chat_session_id);
	if (declaredId !== undefined && declaredId !== conversationId) return undefined;
	const messages: DeepSeekMessage[] = [], reasons: string[] = [], ids = new Set<string>();
	for (const rawMessage of rows) {
		const row = record(rawMessage), id = identifier(row.message_id ?? row.messageId ?? row.id ?? row.uuid);
		if (!id || ids.has(id)) return undefined;
		ids.add(id);
		const fragments = Array.isArray(row.fragments) ? row.fragments : undefined;
		const fragmentTypes = fragments?.map(value => word(record(value).type)) ?? [];
		const roleName = word(row.role ?? row.sender);
		const role = ['user', 'human'].includes(roleName) || fragmentTypes.includes('request') ? 'user'
			: ['assistant', 'model', 'bot'].includes(roleName) || fragmentTypes.includes('response') ? 'assistant' : undefined;
		if (!role) { reasons.push('unrecognized-message-role'); continue; }
		const parentKey = ['parent_id', 'parentId', 'parent_message_id'].find(key => own(row, key));
		if (!parentKey) reasons.push('parent-identity-unverified');
		const parent = parentKey ? row[parentKey] : undefined;
		const parentId = parent === null || parent === undefined || parent === 0 ? undefined : identifier(parent);
		if (parent !== null && parent !== undefined && parent !== 0 && !parentId) return undefined;
		const markdown = content(fragments ?? row.content ?? row.text, role);
		if (markdown === undefined) { reasons.push('missing-public-content'); continue; }
		messages.push({ id, parentId, parentKnown: !!parentKey, role, markdown });
	}
	const declaredCurrent = session.current_message_id ?? envelope.current_message_id;
	let currentMessageId = identifier(declaredCurrent);
	if (!currentMessageId) {
		const parents = new Set(messages.map(message => message.parentId)), leaves = messages.filter(message => !parents.has(message.id));
		if (leaves.length === 1) currentMessageId = leaves[0]!.id;
		reasons.push('active-branch-unverified');
	}
	const byId = new Map(messages.map(message => [message.id, message])), branch: string[] = [], visited = new Set<string>();
	let cursor = currentMessageId;
	while (cursor) {
		if (visited.has(cursor)) { reasons.push('cyclic-parent-chain'); break; }
		visited.add(cursor); const message = byId.get(cursor);
		if (!message) { reasons.push('missing-parent-message'); break; }
		branch.unshift(message.id); cursor = message.parentId;
	}
	const exhausted = envelope.has_more !== true && (envelope.next_cursor === undefined || envelope.next_cursor === null)
		&& (envelope.has_more === false || (own(envelope, 'next_cursor') && envelope.next_cursor === null));
	if (!exhausted) reasons.push('pagination-unverified');
	const total = envelope.total_count ?? envelope.message_count ?? envelope.total;
	if (total !== undefined && (!Number.isInteger(total) || total !== rows.length)) reasons.push('message-count-mismatch');
	return { conversationId, title: typeof session.title === 'string' && session.title.length <= 1024 ? session.title : undefined,
		messages, currentMessageId, branch, reasons: [...new Set(reasons)] };
}
