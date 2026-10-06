const MAX_DEPTH = 6;
const MAX_ITEMS = 20;
const MAX_TEXT = 500;
const ALLOWED = new Set([
	'name', 'code', 'message', 'module', 'event', 'duration', 'durationMs', 'count',
	'status', 'state', 'connection', 'reason', 'kind', 'type', 'exitCode', 'cause', 'id',
]);
const SENSITIVE_QUERY = /^(?:token|code|key|secret|password|authorization|cookie|access_token|refresh_token|api_key)$/i;
const SECRET_ASSIGNMENT = /\b(token|password|secret|api[_-]?key|authorization|cookie)\s*[:=]\s*[^\s&]+/gi;
const BEARER = /Bearer\s+\S+/gi;
const URL_IN_TEXT = /\b[a-z][a-z\d+.-]*:\/\/[^\s<>)]+/gi;
const HOME_PATH = /(?:\/(?:home|Users)\/[^/\s]+|[A-Za-z]:\\Users\\[^\\\s]+)/g;

export interface DiagnosticRoots {
	home?: string;
	vault?: string;
}

let roots: DiagnosticRoots = {};

/** Register path prefixes that diagnostics must not print. Longer prefixes win. */
export function setDiagnosticRoots(next: DiagnosticRoots): void {
	roots = { ...roots, ...next };
}

export function diagnosticRoots(): DiagnosticRoots {
	return { ...roots };
}

function clip(value: string): string {
	return value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT)}…` : value;
}

function replaceRoot(value: string, root: string | undefined, token: string): string {
	if (!root || root === '/' || root === '\\') return value;
	const variants = new Set([root, root.replaceAll('\\', '/'), root.replaceAll('/', '\\')]);
	let text = value;
	for (const variant of variants) {
		if (variant) text = text.split(variant).join(token);
	}
	return text;
}

function redactUrl(raw: string): string {
	try {
		const url = new URL(raw);
		url.username = '';
		url.password = '';
		for (const key of [...url.searchParams.keys()]) {
			if (SENSITIVE_QUERY.test(key)) url.searchParams.set(key, '<redacted>');
		}
		return url.toString();
	} catch {
		return '<redacted-url>';
	}
}

export function redactDiagnosticText(value: string): string {
	let text = replaceRoot(value, roots.vault, '<vault>');
	text = replaceRoot(text, roots.home, '<home>');
	text = text.replace(HOME_PATH, '<home>');
	text = text.replace(URL_IN_TEXT, (url) => redactUrl(url.replace(/[),.;]+$/, '')));
	text = text.replace(BEARER, 'Bearer <redacted>');
	text = text.replace(SECRET_ASSIGNMENT, '$1=<redacted>');
	return clip(text);
}

function redactError(error: Error, seen: WeakSet<object>, depth: number): Record<string, unknown> {
	const record = error as Error & { code?: unknown; cause?: unknown };
	const result: Record<string, unknown> = {
		name: error.name,
		message: redactDiagnosticText(error.message),
	};
	if (typeof record.code === 'string' || typeof record.code === 'number') result.code = record.code;
	if (typeof error.stack === 'string') result.stack = redactDiagnosticText(error.stack);
	if ('cause' in record) result.cause = redactValue(record.cause, seen, depth + 1);
	return result;
}

function redactValue(value: unknown, seen: WeakSet<object>, depth: number): unknown {
	if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
	if (typeof value === 'bigint') return value.toString();
	if (typeof value === 'string') return redactDiagnosticText(value);
	if (typeof value === 'function' || typeof value === 'symbol') return '<omitted>';
	if (depth > MAX_DEPTH) return '<truncated>';
	if (typeof value !== 'object') return '<omitted>';
	if (seen.has(value)) return '<circular>';
	seen.add(value);
	if (value instanceof Error) return redactError(value, seen, depth);
	if (Array.isArray(value)) return value.slice(0, MAX_ITEMS).map((item) => redactValue(item, seen, depth + 1));
	const source = value as Record<string, unknown>;
	const kept: Record<string, unknown> = {};
	for (const key of Object.keys(source)) {
		if (!ALLOWED.has(key)) continue;
		kept[key] = redactValue(source[key], seen, depth + 1);
	}
	return Object.keys(kept).length ? kept : '<omitted>';
}

/** Diagnostic values only. Terminal output and user notes must not pass through here. */
export function redactDiagnostic(value: unknown): unknown {
	return redactValue(value, new WeakSet(), 0);
}
