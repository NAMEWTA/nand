/** Diagnostic summaries never retain guest argument values, objects, URLs or request headers/bodies. */
function record(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}
function oneOf(value: unknown, allowed: readonly string[]): string {
	return typeof value === 'string' && allowed.includes(value) ? value : 'unknown';
}
function timestamp(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
export function consoleDiagnostic(value: unknown) {
	const event = record(value);
	return {
		type: oneOf(event.type, ['log', 'debug', 'info', 'error', 'warning', 'dir', 'dirxml', 'table', 'trace', 'clear', 'startGroup', 'startGroupCollapsed', 'endGroup', 'assert', 'profile', 'profileEnd', 'count', 'timeEnd']),
		timestamp: timestamp(event.timestamp),
		arguments: (Array.isArray(event.args) ? event.args.slice(0, 100) : []).map(arg => ({
			type: oneOf(record(arg).type, ['object', 'function', 'undefined', 'string', 'number', 'boolean', 'symbol', 'bigint']),
		})),
	};
}
export function networkDiagnostic(value: unknown) {
	const event = record(value);
	return {
		type: oneOf(event.type, ['Document', 'Stylesheet', 'Image', 'Media', 'Font', 'Script', 'TextTrack', 'XHR', 'Fetch', 'Prefetch', 'EventSource', 'WebSocket', 'Manifest', 'SignedExchange', 'Ping', 'CSPViolationReport', 'Preflight', 'Other']),
		timestamp: timestamp(event.timestamp),
		cancelled: event.canceled === true,
		// Chromium's symbolic error code is useful without the failed URL or arbitrary descriptions.
		error: typeof event.errorText === 'string' && /^net::ERR_[A-Z_]+$/.test(event.errorText) ? event.errorText : 'failed',
	};
}
