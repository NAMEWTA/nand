// Public content/endpoint reference: MAIW b6b83ca90f0f67fbf25a676e7a8f6b8b34327800 (MIT).
// Copyright (c) 2026 NAMEWTA. See docs/third-party/maiw-LICENSE.txt.
export interface ClaudeMessage {
	id: string; parentId?: string; parentKnown: boolean; role: 'user' | 'assistant'; markdown: string; finished: boolean;
}
export interface ClaudeConversation {
	conversationId: string; title?: string; currentMessageId?: string; messages: ClaudeMessage[]; reasons: string[];
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const identifier = (value: unknown): string | undefined => typeof value === 'string' && /^[\w-]{1,100}$/.test(value) ? value : undefined;
const own = (value: Record<string, unknown>, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);
const rootId = '00000000-0000-0000-0000-000000000000';

export function claudeHistoryEndpoint(url: URL): string | undefined {
	return url.origin === 'https://claude.ai' && !url.username && !url.password
		? url.pathname.match(/^\/api\/organizations\/[\w-]{1,100}\/chat_conversations\/([\w-]{1,100})\/?$/)?.[1] : undefined;
}

/** No synthetic IDs, timestamp sorting, private blocks or text deduplication. */
export function projectClaudeConversation(raw: unknown, conversationId: string): ClaudeConversation | undefined {
	if (!identifier(conversationId)) return undefined;
	const root = record(raw), envelope = Array.isArray(root.chat_messages) ? root : record(root.data);
	if (!Array.isArray(envelope.chat_messages) || envelope.chat_messages.length > 10000) return undefined;
	if (envelope.uuid !== undefined && envelope.uuid !== conversationId) return undefined;
	const messages: ClaudeMessage[] = [], ids = new Set<string>(), reasons = new Set<string>();
	for (const value of envelope.chat_messages) {
		const row = record(value), id = identifier(row.uuid), role = row.sender === 'human' ? 'user' : row.sender === 'assistant' ? 'assistant' : undefined;
		if (!id || id === rootId || ids.has(id)) return undefined;
		ids.add(id);
		if (!role) { reasons.add('unrecognized-public-message'); continue; }
		const parts: string[] = [];
		if (Array.isArray(row.content)) {
			for (const rawBlock of row.content) {
				const block = record(rawBlock);
				if (block.type === 'text' && typeof block.text === 'string') parts.push(block.text);
				else if (!['thinking', 'redacted_thinking', 'tool_use', 'tool_result', 'server_tool_use', 'web_search_tool_result'].includes(String(block.type))) reasons.add('unsupported-public-content');
			}
		} else if (typeof row.text === 'string') parts.push(row.text);
		else reasons.add('missing-public-content');
		const parent = row.parent_message_uuid, parentKnown = own(row, 'parent_message_uuid') && (parent === null || parent === rootId || !!identifier(parent));
		if (own(row, 'parent_message_uuid') && !parentKnown) return undefined;
		const markdown = parts.join('\n\n');
		if (!markdown.trim()) reasons.add('empty-answer');
		messages.push({ id, parentId: parent === rootId ? undefined : identifier(parent), parentKnown, role, markdown,
			finished: role === 'user' || row.stop_reason === 'end_turn' });
	}
	if (envelope.has_more === true || record(envelope.pagination).has_more === true || record(envelope.page_info).has_more === true
		|| envelope.is_truncated === true) reasons.add('pagination-unverified');
	const current = envelope.current_leaf_message_uuid;
	if (current !== undefined && !identifier(current)) reasons.add('active-branch-unverified');
	return { conversationId, title: typeof envelope.name === 'string' && envelope.name.length <= 1024 ? envelope.name : undefined,
		currentMessageId: identifier(current), messages, reasons: [...reasons] };
}

/** A visible stable message may identify the active tip; only explicit API parent edges establish ancestry. */
export function claudeHistory(value: ClaudeConversation, visibleTip?: string) {
	const currentMessageId = value.currentMessageId ?? visibleTip, reasons = new Set(value.reasons), branch: string[] = [];
	if (!currentMessageId || (visibleTip && value.currentMessageId && visibleTip !== value.currentMessageId)) reasons.add('active-branch-unverified');
	const byId = new Map(value.messages.map(message => [message.id, message])), visited = new Set<string>();
	let cursor = currentMessageId, reachedRoot = false;
	while (cursor) {
		if (visited.has(cursor)) { reasons.add('cyclic-parent-chain'); break; }
		visited.add(cursor); const message = byId.get(cursor);
		if (!message) { reasons.add('missing-parent-message'); break; }
		branch.unshift(message.id);
		if (!message.parentKnown) { reasons.add('parent-identity-unverified'); break; }
		cursor = message.parentId; if (!cursor) reachedRoot = true;
	}
	if (!reachedRoot) reasons.add('history-beginning-unverified');
	const messages = branch.map(id => byId.get(id)!);
	if (!messages.length || messages.some((message, index) => message.role !== (index % 2 ? 'assistant' : 'user'))) reasons.add('invalid-role-order');
	if (messages.some(message => message.role === 'assistant' && !message.finished)) reasons.add('unfinished-assistant');
	const answer = messages.at(-1), terminalEvidence = answer?.role === 'assistant' && answer.finished ? ['provider-end-turn'] : [];
	if (!terminalEvidence.length) reasons.add('terminal-message-unverified');
	return { conversationId: value.conversationId, title: value.title, currentMessageId, branch, messages, reasons: [...reasons], terminalEvidence };
}
