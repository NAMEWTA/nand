import type { ShellType, TerminalSettings, UnixShellType, WindowsShellType } from '../../../core/pty/settings';

/**
 * Get the shell type for the current platform
 */
export function getCurrentPlatformShell(settings: TerminalSettings): ShellType {
	const platform = process.platform;
	if (platform === 'win32') {
		return settings.platformShells.windows;
	} else if (platform === 'darwin') {
		return settings.platformShells.darwin;
	} else {
		return settings.platformShells.linux;
	}
}

/**
 * Set the shell type for the current platform
 */
export function setCurrentPlatformShell(settings: TerminalSettings, shellType: ShellType): void {
	const platform = process.platform;
	if (platform === 'win32') {
		settings.platformShells.windows = shellType as WindowsShellType;
	} else if (platform === 'darwin') {
		settings.platformShells.darwin = shellType as UnixShellType;
	} else {
		settings.platformShells.linux = shellType as UnixShellType;
	}
}

/**
 * Get the custom shell path for the current platform
 */
export function getCurrentPlatformCustomShellPath(settings: TerminalSettings): string {
	const platform = process.platform;
	if (platform === 'win32') {
		return settings.platformCustomShellPaths.windows;
	} else if (platform === 'darwin') {
		return settings.platformCustomShellPaths.darwin;
	} else {
		return settings.platformCustomShellPaths.linux;
	}
}

/**
 * Set the custom shell path for the current platform
 */
export function setCurrentPlatformCustomShellPath(settings: TerminalSettings, path: string): void {
	const platform = process.platform;
	if (platform === 'win32') {
		settings.platformCustomShellPaths.windows = path;
	} else if (platform === 'darwin') {
		settings.platformCustomShellPaths.darwin = path;
	} else {
		settings.platformCustomShellPaths.linux = path;
	}
}
