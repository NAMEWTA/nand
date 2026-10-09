import type { CapturePhase } from './ai-workbench';

/** ORCA-style snapshot ref. The role and name come from the page, not a guessed selector. */
export interface AdapterRef {
	ref: string;
	role: string;
	name: string;
}

export interface AdapterShot {
	text: string;
	refs: readonly AdapterRef[];
}

const STATUS_ONLY =
	/^(complete|completed|done|generating|loading|ready|stop|stopped|thinking|已停止|已完成|停止|停止生成|生成中|思考中|正在生成|正在思考|就绪)$/i;

/** The composer is the last text box. The send control is the last matching button. */
export function composerRef(refs: readonly AdapterRef[]): string | undefined {
	return refs.filter((item) => item.role === 'textbox' || item.role === 'searchbox').at(-1)?.ref;
}

export function submitRef(refs: readonly AdapterRef[]): string | undefined {
	return refs.filter((item) => item.role === 'button' && /send|submit|发送|提交/i.test(item.name)).at(-1)?.ref;
}

/** Read-only precheck. A missing composer, a challenge, or a busy generator does not get a write. */
export function precheckShot(shot: AdapterShot): { binding: 'ready' | 'login-required' | 'challenge' | 'busy'; composer?: string } {
	const composer = composerRef(shot.refs);
	if (/captcha|challenge|验证码/i.test(shot.text) && !composer) return { binding: 'challenge' };
	if (composer && /停止生成|正在生成|正在思考|generating/i.test(shot.text)) return { binding: 'busy' };
	if (!composer) return { binding: 'login-required' };
	return { binding: 'ready', composer };
}

/** Stage is accepted only when the page reads the same prompt back and a submit control or composer remains. */
export function stageMatches(prompt: string, shot: AdapterShot): { ok: true; submit?: string } | { ok: false; reason: 'mismatch' | 'missing-submit' } {
	if (!shot.text.includes(prompt)) return { ok: false, reason: 'mismatch' };
	if (!submitRef(shot.refs) && !composerRef(shot.refs)) return { ok: false, reason: 'missing-submit' };
	return { ok: true, submit: submitRef(shot.refs) };
}

/** Clear the composer only when it still holds this attempt's prompt. */
export function shouldRollback(prompt: string, shotText: string): boolean {
	return shotText.includes(prompt);
}

/** A click result is not acceptance. The page text has to change after the press. */
export function confirmCommit(beforeText: string, afterText: string, pressed: 'submitted' | 'unknown' | 'failed'): 'submitted' | 'unknown' {
	if (pressed === 'failed' || afterText === beforeText) return 'unknown';
	return 'submitted';
}

/** Empty, prompt-only, and status-only bodies are not a completed answer. */
export function answerQuality(prompt: string, answer: string): CapturePhase {
	const body = answer.trim();
	if (!body || body === prompt.trim() || STATUS_ONLY.test(body)) return 'incomplete';
	return 'complete';
}
