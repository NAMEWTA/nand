import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { splitArgs } from '../../../core/launch/flags';
import type { ShellChoice, TerminalSettings } from '../../../core/terminal/settings';
import { resolveCli } from '../agents/resolver';

export interface ShellCommand {
	file: string;
	args: string[];
	title: string;
}

export interface ShellOption {
	choice: ShellChoice;
	title: string;
}

const TITLES: Record<ShellChoice, string> = {
	default: 'Shell',
	bash: 'Bash',
	zsh: 'Zsh',
	pwsh: 'PowerShell 7',
	powershell: 'Windows PowerShell',
	cmd: 'Command Prompt',
	gitbash: 'Git Bash',
	wsl: 'WSL',
	custom: 'Shell',
};

function gitBash(): string | null {
	const roots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs')].filter((root): root is string => !!root);
	for (const root of roots) {
		const candidate = path.join(root, 'Git', 'bin', 'bash.exe');
		if (fs.existsSync(candidate)) return candidate;
	}
	return null;
}

function windowsSystem(name: string): string {
	return path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', name);
}

/** Program for a shell choice on this machine, or null when it is not installed. */
function locate(choice: ShellChoice): string | null {
	const win = process.platform === 'win32';
	switch (choice) {
		case 'bash':
			return resolveCli('bash', '', '');
		case 'zsh':
			return resolveCli('zsh', '', '');
		case 'pwsh':
			return resolveCli('pwsh', '', '');
		case 'powershell':
			return win ? windowsSystem(path.join('WindowsPowerShell', 'v1.0', 'powershell.exe')) : null;
		case 'cmd':
			return win ? (process.env.ComSpec ?? windowsSystem('cmd.exe')) : null;
		case 'gitbash':
			return win ? gitBash() : null;
		case 'wsl':
			return win ? resolveCli('wsl', '', '') : null;
		default:
			return null;
	}
}

function defaultShell(): ShellCommand {
	if (process.platform === 'win32') {
		const pwsh = locate('pwsh');
		if (pwsh) return { file: pwsh, args: ['-NoLogo'], title: TITLES.pwsh };
		return { file: locate('powershell') ?? 'powershell.exe', args: ['-NoLogo'], title: TITLES.powershell };
	}
	const login = process.env.SHELL;
	if (login && fs.existsSync(login)) return { file: login, args: ['-l'], title: path.basename(login) };
	for (const name of ['zsh', 'bash', 'sh']) {
		const found = resolveCli(name, '', '') ?? (fs.existsSync(`/bin/${name}`) ? `/bin/${name}` : null);
		if (found) return { file: found, args: ['-l'], title: name };
	}
	return { file: '/bin/sh', args: [], title: 'sh' };
}

/** Program and arguments for a shell session. Unix shells start as login shells. */
export function resolveShell(choice: ShellChoice, settings: Pick<TerminalSettings, 'customShellPath' | 'shellArgs'>): ShellCommand {
	const extra = splitArgs(settings.shellArgs);
	if (choice === 'custom') {
		const file = settings.customShellPath.trim();
		if (!file) return { ...defaultShell(), args: extra.length ? extra : defaultShell().args };
		return { file, args: extra, title: path.basename(file).replace(/\.exe$/i, '') };
	}
	if (choice === 'default') {
		const shell = defaultShell();
		return extra.length ? { ...shell, args: extra } : shell;
	}
	const file = locate(choice);
	if (!file) return defaultShell();
	const args = extra.length ? extra : choice === 'bash' || choice === 'zsh' ? ['-l'] : choice === 'gitbash' ? ['--login', '-i'] : choice === 'pwsh' || choice === 'powershell' ? ['-NoLogo'] : [];
	return { file, args, title: TITLES[choice] };
}

/** Shells offered in the "new session" menu on this machine. */
export function availableShells(): ShellOption[] {
	const options: ShellOption[] = [{ choice: 'default', title: TITLES.default }];
	const candidates: ShellChoice[] = process.platform === 'win32' ? ['pwsh', 'powershell', 'cmd', 'gitbash', 'wsl'] : ['bash', 'zsh'];
	for (const choice of candidates) if (locate(choice)) options.push({ choice, title: TITLES[choice] });
	return options;
}

/** Working directory for a new session. */
export function sessionDirectory(vault: string | undefined, startInVault: boolean, requested?: string): string {
	if (requested) {
		const resolved = vault && !path.isAbsolute(requested) ? path.resolve(vault, requested) : requested;
		if (fs.existsSync(resolved)) return resolved;
	}
	if (startInVault && vault && fs.existsSync(vault)) return vault;
	return os.homedir();
}
