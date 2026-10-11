// Quality categories informed by MAIW b6b83ca90f0f67fbf25a676e7a8f6b8b34327800 (MIT).
// Copyright (c) 2026 NAMEWTA. See docs/third-party/maiw-LICENSE.txt.
const comparable = (value: string): string => value.replace(/^#{1,6}\s+/gm, '').replace(/\s+/g, ' ').trim().toLowerCase();
const statusWords = new Set(['complete', 'completed', 'done', 'generating', 'loading', 'ready', 'stop', 'stopped', 'thinking',
	'已停止', '已完成', '停止', '停止生成', '生成中', '思考中', '正在生成', '正在思考', '就绪']);

/** Content quality is independent of length; identity, branch coverage and terminal proof remain mandatory. */
export function answerContentReasons(markdown: string, conversationTitle?: string): string[] {
	const body = comparable(markdown);
	if (!body) return ['empty-answer'];
	if (conversationTitle && body === comparable(conversationTitle)) return ['title-only'];
	if (statusWords.has(body.replace(/[.…!。！]+$/u, '').trim())) return ['status-only'];
	return [];
}
