import { normalizeAgentSettings } from '../launch/defaults';
import type { AgentSettings } from '../launch/types';
import { AGENT_IDS } from '../launch/defaults';
import { validSkillName } from '../../../../shared/agent-prompt';

export const SHELL_CHOICES = [
	'default',
	'bash',
	'zsh',
	'fish',
	'pwsh',
	'powershell',
	'cmd',
	'gitbash',
	'wsl',
	'custom',
] as const;
export type ShellChoice = (typeof SHELL_CHOICES)[number];

export interface QuickCommand {
	id: string;
	name: string;
	type: 'terminal' | 'agent';
	content: string;
	agentId: import('../launch/types').AgentId;
	cwd: string;
	scope: 'global' | 'vault';
}
export interface AgentOverride {
	command?: string;
	args?: string;
	env?: Record<string, string>;
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
	quickCommands: QuickCommand[];
	lastQuickCommand: string;
	enabled: Record<import('../launch/types').AgentId, boolean>;
	defaultAgent: import('../launch/types').AgentId;
	overrides: Partial<Record<import('../launch/types').AgentId, AgentOverride>>;
	permissionMode: 'yolo' | 'manual';
	statusHooks: boolean;
	generatedTitles: boolean;
	notifications: boolean;
	hiddenNavigation: string[];
	usageRefreshSec: number;
	usageAnalytics: Record<import('../launch/types').AgentId, boolean>;
	accounts: Partial<Record<import('../launch/types').AgentId, string[]>>;
	accountLabels: Partial<Record<import('../launch/types').AgentId, Record<string, string>>>;
	agents: AgentSettings;
	/** Explicit device-only opt-in. Empty means no scan outside the vault. */
	skillDirectories: string[];
	knownSkills: Record<string, string[]>;
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
	quickCommands: [],
	lastQuickCommand: '',
	enabled: Object.fromEntries(AGENT_IDS.map((id) => [id, true])) as TerminalSettings['enabled'],
	defaultAgent: 'claude-code',
	overrides: {},
	permissionMode: 'manual',
	statusHooks: true,
	generatedTitles: false,
	notifications: true,
	hiddenNavigation: [],
	usageRefreshSec: 300,
	usageAnalytics: Object.fromEntries(AGENT_IDS.map((id) => [id, true])) as TerminalSettings['usageAnalytics'],
	accounts: {},
	accountLabels: {},
	agents: normalizeAgentSettings(undefined),
	skillDirectories: [],
	knownSkills: {},
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	!!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, fallback: string, max = 2000): string =>
	typeof value === 'string' ? value.slice(0, max) : fallback;
const number = (value: unknown, fallback: number, min: number, max: number): number =>
	typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const color = (value: unknown): string =>
	typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value.trim()) ? value.trim() : '';
const choice = <T extends string>(value: unknown, values: readonly T[], fallback: T): T =>
	values.includes(value as T) ? (value as T) : fallback;

function normalizeQuickCommand(value: unknown, index: number): QuickCommand | undefined {
	if (!isRecord(value)) return undefined;
	const name = text(value.name, '', 120).trim(),
		content = text(value.content, '', 20000);
	if (!name || !content.trim()) return undefined;
	return {
		id: text(value.id, '', 80) || `command-${index + 1}`,
		name,
		content,
		type: value.type === 'agent' ? 'agent' : 'terminal',
		agentId: choice(value.agentId, AGENT_IDS, 'claude-code'),
		cwd: text(value.cwd, ''),
		scope: value.scope === 'global' ? 'global' : 'vault',
	};
}

export function normalizeTerminalSettings(raw: unknown): TerminalSettings {
	const value = isRecord(raw) ? raw : {};
	const quickCommands = (Array.isArray(value.quickCommands) ? value.quickCommands : [])
		.map(normalizeQuickCommand)
		.filter((v): v is QuickCommand => !!v)
		.slice(0, 100);
	const ids = new Set<string>();
	for (const command of quickCommands) {
		while (ids.has(command.id)) command.id += '-1';
		ids.add(command.id);
	}
	const booleanMap = (raw: unknown): TerminalSettings['enabled'] =>
		Object.fromEntries(
			AGENT_IDS.map((id) => [id, !isRecord(raw) || raw[id] !== false]),
		) as TerminalSettings['enabled'];
	const overrides: TerminalSettings['overrides'] = {};
	for (const id of AGENT_IDS) {
		const item = isRecord(value.overrides) ? value.overrides[id] : undefined;
		if (isRecord(item))
			overrides[id] = {
				command: typeof item.command === 'string' ? item.command.trim().slice(0, 2000) : undefined,
				args: typeof item.args === 'string' ? item.args.slice(0, 10000) : undefined,
				env: isRecord(item.env)
					? Object.fromEntries(
							Object.entries(item.env)
								.filter(([key, v]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && typeof v === 'string')
								.map(([key, v]) => [key, String(v).slice(0, 10000)]),
						)
					: undefined,
			};
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
		quickCommands,
		lastQuickCommand: text(value.lastQuickCommand, '', 80),
		enabled: booleanMap(value.enabled),
		defaultAgent: choice(value.defaultAgent, AGENT_IDS, 'claude-code'),
		overrides,
		permissionMode: value.permissionMode === 'yolo' ? 'yolo' : 'manual',
		statusHooks: value.statusHooks !== false,
		generatedTitles: value.generatedTitles === true,
		notifications: value.notifications !== false,
		hiddenNavigation: Array.isArray(value.hiddenNavigation)
			? value.hiddenNavigation.filter(
					(v): v is string => typeof v === 'string' && ['board', 'stats', 'automations'].includes(v),
				)
			: [],
		usageRefreshSec: Math.round(number(value.usageRefreshSec, 300, 60, 3600)),
		usageAnalytics: booleanMap(value.usageAnalytics),
		accountLabels: Object.fromEntries(
			AGENT_IDS.map((id) => {
				const labels = isRecord(value.accountLabels) ? value.accountLabels[id] : undefined;
				return [
					id,
					isRecord(labels)
						? Object.fromEntries(Object.entries(labels).filter(([, v]) => typeof v === 'string'))
						: {},
				];
			}),
		),
		accounts: Object.fromEntries(
			AGENT_IDS.map((id) => {
				const names = isRecord(value.accounts) ? value.accounts[id] : undefined;
				return [
					id,
					Array.isArray(names)
						? [
								...new Set(
									names
										.filter((v): v is string => typeof v === 'string' && !!v.trim())
										.map((v) => v.trim().slice(0, 80)),
								),
							].slice(0, 50)
						: [],
				];
			}),
		),
		agents: normalizeAgentSettings(isRecord(value.agents) ? value.agents : undefined),
		skillDirectories: Array.isArray(value.skillDirectories)
			? [
					...new Set(
						value.skillDirectories
							.filter((path): path is string => typeof path === 'string' && !!path.trim())
							.map((path) => path.trim()),
					),
				].slice(0, 20)
			: [],
		knownSkills: Object.fromEntries(
			AGENT_IDS.flatMap((id) => {
				const names = isRecord(value.knownSkills) ? value.knownSkills[id] : undefined;
				return Array.isArray(names)
					? [
							[
								id,
								[
									...new Set(
										names.filter(
											(name): name is string => typeof name === 'string' && validSkillName(name),
										),
									),
								].slice(-200),
							],
						]
					: [];
			}),
		),
	};
}
