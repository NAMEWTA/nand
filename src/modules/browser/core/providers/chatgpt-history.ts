// Mapping/current-branch reference adapted from MAIW b6b83ca90f0f67fbf25a676e7a8f6b8b34327800 (MIT).
// Copyright (c) 2026 NAMEWTA. See docs/third-party/maiw-LICENSE.txt.
export interface ChatGptMessage { id: string; parentId?: string; parentKnown: boolean; role: 'user' | 'assistant'; markdown: string; finished: boolean }
export interface ChatGptHistory {
	conversationId: string; title?: string; currentMessageId?: string; branch: string[]; messages: ChatGptMessage[]; reasons: string[]; terminalEvidence: string[];
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const own = (value: Record<string, unknown>, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);
const identifier = (value: unknown): string | undefined => typeof value === 'string' && /^[\w-]{1,100}$/.test(value) ? value : undefined;

export function chatGptHistoryEndpoint(url: URL): string | undefined {
	return url.origin === 'https://chatgpt.com' && !url.username && !url.password
		? url.pathname.match(/^\/backend-api\/conversation\/([\w-]{1,100})$/)?.[1] : undefined;
}

/** Retains only the active branch's public text. Private channels and unrelated branches never enter stored evidence. */
export function projectChatGptHistory(raw: unknown, conversationId: string): ChatGptHistory | undefined {
	if (!identifier(conversationId)) return undefined;
	const root = record(raw), envelope = own(root, 'mapping') ? root : record(root.data), mapping = record(envelope.mapping);
	const entries = Object.entries(mapping); if (!entries.length || entries.length > 10000) return undefined;
	const declared = envelope.conversation_id ?? envelope.id;
	if (declared !== undefined && declared !== conversationId) return undefined;
	const nodes = new Map<string, Record<string, unknown>>();
	for (const [id, value] of entries) {
		const node = record(value);
		if (!identifier(id) || (node.id !== undefined && node.id !== id)) return undefined;
		nodes.set(id, node);
	}
	const current = identifier(envelope.current_node ?? envelope.currentNode), reasons = new Set<string>();
	if (!current) reasons.add('active-branch-unverified');
	const reversed: Array<{ id: string; node: Record<string, unknown> }> = [], visited = new Set<string>();
	let cursor = current, reachedRoot = false;
	while (cursor) {
		if (visited.has(cursor)) { reasons.add('cyclic-parent-chain'); break; }
		visited.add(cursor); const node = nodes.get(cursor);
		if (!node) { reasons.add('missing-parent-message'); break; }
		reversed.push({ id: cursor, node });
		if (!own(node, 'parent')) { reasons.add('parent-identity-unverified'); break; }
		if (node.parent === null) { reachedRoot = true; break; }
		cursor = identifier(node.parent);
		if (!cursor) { reasons.add('parent-identity-unverified'); break; }
	}
	const messages: ChatGptMessage[] = []; let publicParentKnown = true;
	for (const { id, node } of reversed.reverse()) {
		if (node.message === null) continue;
		const message = record(node.message), author = record(message.author), metadata = record(message.metadata), content = record(message.content);
		if (message.id !== undefined && message.id !== id) return undefined;
		const role = author.role;
		if (role === 'system' || role === 'tool' || role === 'developer') continue;
		if (role !== 'user' && role !== 'assistant') { reasons.add('unrecognized-public-message'); publicParentKnown = false; continue; }
		if (metadata.is_visually_hidden_from_conversation === true) continue;
		if (role === 'assistant' && ((message.channel !== undefined && message.channel !== null && message.channel !== 'final')
			|| (message.recipient !== undefined && message.recipient !== null && message.recipient !== 'all'))) continue;
		if (content.content_type !== undefined && content.content_type !== 'text') {
			reasons.add('unsupported-public-content'); publicParentKnown = false; continue;
		}
		if (!Array.isArray(content.parts)) { reasons.add('missing-public-content'); publicParentKnown = false; continue; }
		const parts: string[] = [];
		for (const part of content.parts) {
			if (typeof part === 'string') parts.push(part);
			else reasons.add('unsupported-public-content');
		}
		const markdown = parts.join('\n\n');
		if (!markdown.trim()) { reasons.add('empty-answer'); publicParentKnown = false; continue; }
		const previous = messages.at(-1);
		// This relationship is backed by every traversed mapping edge, including non-public nodes.
		messages.push({ id, parentId: publicParentKnown ? previous?.id : undefined, parentKnown: publicParentKnown && (!!previous || reachedRoot), role, markdown,
			finished: role === 'user' || (message.status === 'finished_successfully' && message.end_turn === true) });
		publicParentKnown = true;
	}
	const branch = messages.map(message => message.id), answer = messages.find(message => message.id === current);
	if (!reachedRoot) reasons.add('history-beginning-unverified');
	if (!branch.length || messages.some((message, index) => message.role !== (index % 2 ? 'assistant' : 'user'))) reasons.add('invalid-role-order');
	if (messages.some(message => message.role === 'assistant' && !message.finished)) reasons.add('unfinished-assistant');
	if (envelope.has_more === true || envelope.is_truncated === true || (envelope.next_cursor !== undefined && envelope.next_cursor !== null && envelope.next_cursor !== '')) reasons.add('pagination-unverified');
	const terminalEvidence = answer?.role === 'assistant' && answer.finished ? ['provider-message-finished', 'provider-end-turn'] : [];
	if (!terminalEvidence.length) reasons.add('terminal-message-unverified');
	if (!answer) reasons.add('active-branch-unverified');
	return { conversationId, title: typeof envelope.title === 'string' && envelope.title.length <= 1024 ? envelope.title : undefined,
		currentMessageId: answer?.id, messages, branch, reasons: [...reasons], terminalEvidence };
}
