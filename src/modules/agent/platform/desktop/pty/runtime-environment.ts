// Inheritance model adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/main/providers/local-pty-spawn-environment.ts
import * as os from 'node:os';
import { loginShellEnvironment } from '../detection/shell-path';

/**
 * The helper and ordinary shells run with the real user environment: the helper already starts from `process.env`, so
 * nothing here moves HOME, XDG or any provider home, and no credential variable is cleared. A desktop-icon launch lacks
 * what the user's shell rc exports, so the login-shell PATH and exported provider homes are added when they are missing.
 */
export async function terminalEnvironment(): Promise<Record<string, string>> {
	return { ...await loginShellEnvironment() };
}

/** The real user home, for resolving `~` in terminal output. */
export const userHome = (): string => os.homedir();
