import { t } from '../../shared/i18n/terminal-accessor';

export type BinaryFailure = 'http' | 'checksumMissing' | 'checksumMismatch' | 'redirects' | 'timeout' | 'tooLarge' | 'offlineMissing' | 'protocol';
export class TerminalBinaryError extends Error {
	readonly code: BinaryFailure;
	readonly parameters: Record<string, string | number>;
	constructor(code: BinaryFailure, parameters: Record<string, string | number> = {}) {
		super(t(`binary.${code}`, parameters));
		this.name = 'TerminalBinaryError';
		this.code = code;
		this.parameters = parameters;
	}
}
/** The server manager has already displayed this error; downstream consumers must not stack notices. */
export class TerminalStartupError extends Error {
	readonly original: unknown;
	constructor(original: unknown) {
		super(original instanceof Error ? original.message : String(original));
		this.name = 'TerminalStartupError';
		this.original = original;
	}
}
