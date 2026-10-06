/**
 * Logging utilities - only output logs in debug mode.
 * Every argument is redacted. This is not a place to record terminal output or note text.
 */

import { redactDiagnostic } from '../../shared/diagnostics/redact';

let debugMode = false;

function emit(write: (...args: unknown[]) => void, args: unknown[]): void {
	write(...args.map((arg) => redactDiagnostic(arg)));
}

/**
 * Set debug mode
 */
export function setDebugMode(enabled: boolean): void {
	debugMode = enabled;
}

/**
 * Get the current debug mode status
 */
export function isDebugMode(): boolean {
	return debugMode;
}

/**
 * Debug logs - only output in debug mode
 */
export function debugLog(...args: unknown[]): void {
	if (debugMode) emit(console.debug, args);
}

/**
 * Debug warnings - only output in debug mode
 */
export function debugWarn(...args: unknown[]): void {
	if (debugMode) emit(console.warn, args);
}

/**
 * Error logs - always output (error messages are important)
 */
export function errorLog(...args: unknown[]): void {
	emit(console.error, args);
}
