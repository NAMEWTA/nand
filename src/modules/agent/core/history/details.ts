export interface ConversationTurn {
	role: 'user' | 'assistant' | 'tool';
	text: string;
}
export interface HistoryDetails {
	model: string | null;
	createdAt: number | null;
	firstPrompt: string;
	turns: ConversationTurn[];
	messageCount: number;
}
const record = (v: unknown): Record<string, unknown> =>
	v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
function content(v: unknown): string {
	if (typeof v === 'string') return v;
	if (Array.isArray(v)) return v.map(content).filter(Boolean).join('\n');
	const item = record(v);
	return typeof item.text === 'string' ? item.text : item.content ? content(item.content) : '';
}
function messageTurns(message: Record<string, unknown>, fallback: unknown): ConversationTurn[] {
	const kind = String(message.role ?? message.type ?? fallback);
	const role = ['user', 'user_message'].includes(kind)
		? 'user'
		: ['assistant', 'gemini', 'agent_message'].includes(kind)
			? 'assistant'
			: ['tool', 'toolResult', 'tool_result', 'function_call_output', 'custom_tool_call_output'].includes(kind)
				? 'tool'
				: null;
	if (!role) return [];
	const body = message.content ?? message.output ?? message.text ?? message.message;
	if (!Array.isArray(body)) return [{ role, text: content(body) }];
	// Claude wraps tool results in user messages. Keep mixed text/tool blocks in
	// their original order without turning a tool response into the first prompt.
	const turns: ConversationTurn[] = [];
	for (const block of body) {
		const blockRole = record(block).type === 'tool_result' ? 'tool' : role;
		const text = content(block);
		if (!text) continue;
		const previous = turns.at(-1);
		if (previous?.role === blockRole) previous.text += '\n' + text;
		else turns.push({ role: blockRole, text });
	}
	return turns;
}
/** Native JSONL and JSON documents. Keep prompt text intact; tolerate partial final records. */
export function transcriptDetails(text: string): HistoryDetails {
	const result: HistoryDetails = { model: null, createdAt: null, firstPrompt: '', turns: [], messageCount: 0 };
	// NativeHistory.read returns a normalized Markdown transcript (not JSONL).
	if (/^\s*## (user|assistant|tool)/.test(text)) {
		const parts = text.split(/^## (user|assistant|tool)\s*$/m);
		for (let i = 1; i < parts.length; i += 2) {
			const role = parts[i] as ConversationTurn['role'],
				body = parts[i + 1]?.trim() || '';
			if (!body) continue;
			result.turns.push({ role, text: body });
			if (role === 'user' && !result.firstPrompt) result.firstPrompt = body;
		}
		result.messageCount = result.turns.length;
		return result;
	}
	let entries: unknown[] = [];
	try {
		const parsed: unknown = JSON.parse(text);
		const doc = record(parsed);
		entries = Array.isArray(parsed)
			? parsed
			: Array.isArray(doc.messages)
				? [doc, ...(doc.messages as unknown[])]
				: [parsed];
	} catch {
		for (const line of text.split('\n')) {
			try {
				entries.push(JSON.parse(line));
			} catch {
				/* Incomplete/log lines do not contain a message. */
			}
		}
	}
	for (const entry of entries) {
		const row = record(entry),
			payload = record(row.payload),
			message = Object.keys(record(row.message)).length
				? record(row.message)
				: Object.keys(payload).length
					? payload
					: row;
		const model = message.model ?? row.model;
		if (typeof model === 'string') result.model = model;
		const at = row.timestamp ?? row.createdAt ?? row.startTime;
		const time = typeof at === 'number' ? at : typeof at === 'string' ? Date.parse(at) : NaN;
		if (Number.isFinite(time) && (!result.createdAt || time < result.createdAt)) result.createdAt = time;
		for (const turn of messageTurns(message, row.type)) {
			if (!turn.text) continue;
			// Codex duplicates a user message in response_item + event_msg.
			const previous = result.turns.at(-1);
			if (previous?.role === turn.role && previous.text === turn.text) continue;
			result.turns.push(turn);
			result.messageCount++;
			if (turn.role === 'user' && !result.firstPrompt) result.firstPrompt = turn.text;
		}
	}
	return result;
}
export function withinVault(cwd: string, vault: string): boolean {
	const clean = (path: string) => path.replace(/\\/g, '/').replace(/\/+$/, '');
	const base = clean(vault),
		path = clean(cwd);
	return !!base && (path === base || path.startsWith(base + '/'));
}
