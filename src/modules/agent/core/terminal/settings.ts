import { normalizeAgentSettings } from '../launch/defaults';
import type { AgentSettings } from '../launch/types';

export const SHELL_CHOICES = ['default', 'bash', 'zsh', 'pwsh', 'powershell', 'cmd', 'gitbash', 'wsl', 'custom'] as const;
export type ShellChoice = (typeof SHELL_CHOICES)[number];

/** A named way to start a session: a shell (or program) with arguments, a directory and text typed after start. */
export interface LaunchPreset {
	id: string;
	name: string;
	icon: string;
	shell: ShellChoice;
	/** Program to run instead of a shell (used when `shell` is `custom`). */
	program: string;
	args: string;
	/** Vault-relative or absolute; empty for the vault root. */
	cwd: string;
	/** Typed into the session once its input is ready; sent as a paste, then Enter. */
	input: string;
}

export interface TerminalSettings {
	shell: ShellChoice;
	customShellPath: string;
	shellArgs: string;
	/** Start sessions in the vault folder (otherwise the home folder). */
	startInVault: boolean;
	fontFamily: string;
	fontSize: number;
	lineHeight: number;
	cursorStyle: 'block' | 'bar' | 'underline';
	cursorBlink: boolean;
	scrollback: number;
	renderer: 'webgl' | 'dom';
	/** Follow the Obsidian theme colors; otherwise use `foreground`/`background`. */
	useObsidianTheme: boolean;
	foreground: string;
	background: string;
	/** Never download the native helper; use the installed file only. */
	offline: boolean;
	presets: LaunchPreset[];
	agents: AgentSettings;
}

export const DEFAULT_TERMINAL_SETTINGS: TerminalSettings = {
	shell: 'default',
	customShellPath: '',
	shellArgs: '',
	startInVault: true,
	fontFamily: '',
	fontSize: 14,
	lineHeight: 1.15,
	cursorStyle: 'block',
	cursorBlink: true,
	scrollback: 5000,
	renderer: 'webgl',
	useObsidianTheme: true,
	foreground: '',
	background: '',
	offline: false,
	presets: [],
	agents: normalizeAgentSettings(undefined),
};

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, fallback: string, max = 2000): string => (typeof value === 'string' ? value.slice(0, max) : fallback);
const number = (value: unknown, fallback: number, min: number, max: number): number =>
	typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const color = (value: unknown): string => (typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value.trim()) ? value.trim() : '');
const choice = <T extends string>(value: unknown, values: readonly T[], fallback: T): T => (values.includes(value as T) ? (value as T) : fallback);

function normalizePreset(value: unknown, index: number): LaunchPreset | undefined {
	if (!isRecord(value)) return undefined;
	const name = text(value.name, '', 120).trim();
	if (!name) return undefined;
	return {
		id: text(value.id, '', 80) || `preset-${index + 1}`,
		name,
		icon: text(value.icon, 'terminal', 80) || 'terminal',
		shell: choice(value.shell, SHELL_CHOICES, 'default'),
		program: text(value.program, ''),
		args: text(value.args, ''),
		cwd: text(value.cwd, ''),
		input: text(value.input, '', 20000),
	};
}

export function normalizeTerminalSettings(raw: unknown): TerminalSettings {
	const value = isRecord(raw) ? raw : {};
	const presets = Array.isArray(value.presets) ? value.presets.map(normalizePreset).filter((preset): preset is LaunchPreset => !!preset).slice(0, 50) : [];
	const ids = new Set<string>();
	for (const preset of presets) {
		while (ids.has(preset.id)) preset.id = `${preset.id}-1`;
		ids.add(preset.id);
	}
	return {
		shell: choice(value.shell, SHELL_CHOICES, 'default'),
		customShellPath: text(value.customShellPath, ''),
		shellArgs: text(value.shellArgs, ''),
		startInVault: value.startInVault !== false,
		fontFamily: text(value.fontFamily, '', 300),
		fontSize: Math.round(number(value.fontSize, 14, 8, 32)),
		lineHeight: number(value.lineHeight, 1.15, 1, 2),
		cursorStyle: choice(value.cursorStyle, ['block', 'bar', 'underline'] as const, 'block'),
		cursorBlink: value.cursorBlink !== false,
		scrollback: Math.round(number(value.scrollback, 5000, 100, 10000)),
		renderer: choice(value.renderer, ['webgl', 'dom'] as const, 'webgl'),
		useObsidianTheme: value.useObsidianTheme !== false,
		foreground: color(value.foreground),
		background: color(value.background),
		offline: value.offline === true,
		presets,
		agents: normalizeAgentSettings(isRecord(value.agents) ? value.agents : undefined),
	};
}
