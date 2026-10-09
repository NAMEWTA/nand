import { redactDiagnostic } from '../../shared/diagnostics/redact';

const PREFIX = '[NAND]';
let debugEnabled = false;

/** Debug output is opt-in (the terminal "debug log" setting); errors are always reported. */
export function setDebugMode(enabled: boolean): void {
	debugEnabled = enabled;
}

export function isDebugMode(): boolean {
	return debugEnabled;
}

/** Every argument is redacted, so secrets, tokens and absolute home paths never reach the console. */
const redacted = (args: unknown[]): unknown[] => args.map((arg) => redactDiagnostic(arg));

export function debugLog(...args: unknown[]): void {
	if (debugEnabled) console.debug(PREFIX, ...redacted(args));
}

export function debugWarn(...args: unknown[]): void {
	if (debugEnabled) console.warn(PREFIX, ...redacted(args));
}

export function errorLog(...args: unknown[]): void {
	console.error(PREFIX, ...redacted(args));
}
