import { homedir } from 'node:os';

/** Operating system of the running desktop app. */
export function getPlatform(): NodeJS.Platform {
	return process.platform;
}

export function isWindows(): boolean {
	return getPlatform() === 'win32';
}

export function isMacOS(): boolean {
	return getPlatform() === 'darwin';
}

export function isLinux(): boolean {
	return getPlatform() === 'linux';
}

/** The user's home directory, or an empty string when the OS does not report one. */
export function getHomeDir(): string {
	try {
		return homedir();
	} catch {
		return '';
	}
}
