import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const WINDOWS_SKIP = new Set(['.cmd', '.bat', '.ps1']);

export function resolveCli(command: string, configuredPath: string, extraPath: string): string | null {
	const configured = configuredPath.trim();
	if (configured && (path.isAbsolute(configured) || configured.includes(path.sep))) return executable(configured) ? configured : null;
	if (configured) command = configured;

	const pathValue = [extraPath, process.env.PATH ?? ''].filter(Boolean).join(path.delimiter);
	const entries = pathValue.split(path.delimiter).filter(Boolean);
	const extensions =
		process.platform === 'win32'
			? (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD;.PS1').split(';').filter(Boolean)
			: [''];

	const matches: string[] = [];
	for (const entry of entries) {
		for (const extension of extensions) {
			const candidate = path.join(entry, process.platform === 'win32' ? `${command}${extension}` : command);
			if (executable(candidate)) {
				matches.push(candidate);
			}
		}
	}

	const preferred = matches.find((candidate) => !WINDOWS_SKIP.has(path.extname(candidate).toLowerCase()));
	if (preferred) return preferred;
	if (matches[0]) return matches[0];

	for (const candidate of commonInstallPaths(command)) {
		if (executable(candidate)) return candidate;
	}
	return null;
}

function commonInstallPaths(command: string): string[] {
	const home = os.homedir();
	if (process.platform === 'win32') {
		const local = process.env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local');
		return [
			path.join(local, 'Programs', command, `${command}.exe`),
			path.join(home, '.local', 'bin', `${command}.exe`),
			path.join(home, 'scoop', 'shims', `${command}.exe`),
			path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'npm', `${command}.cmd`),
		];
	}
	return [
		path.join(home, '.local', 'bin', command),
		path.join(home, '.npm-global', 'bin', command),
		path.join(home, '.bun', 'bin', command),
		path.join('/opt/homebrew/bin', command),
		path.join('/usr/local/bin', command),
	];
}

function executable(file: string): boolean {
 try { if (!fs.statSync(file).isFile()) return false; fs.accessSync(file, process.platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK); return true; } catch { return false; }
}
