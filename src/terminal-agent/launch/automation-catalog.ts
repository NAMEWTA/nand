// Adapted from stablyai/orca 27b823f934f739bc85914dd717b776835f60bcf7 (MIT). Copyright Lovecast Inc.
export const AUTOMATION_AGENTS = {
	'claude-code': {
		command: 'claude',
		mode: 'argv',
		separator: false,
	},
	openclaude: {
		command: 'openclaude',
		mode: 'argv',
		separator: false,
	},
	codex: {
		command: 'codex',
		mode: 'argv',
		separator: false,
	},
	autohand: {
		command: 'autohand',
		mode: 'stdin-after-start',
		separator: false,
	},
	ante: {
		command: 'ante',
		mode: 'stdin-after-start',
		separator: false,
	},
	trae: {
		command: 'traecli',
		mode: 'argv',
		separator: true,
	},
	opencode: {
		command: 'opencode',
		mode: 'flag-prompt',
		separator: false,
	},
	opencode2: {
		command: 'opencode2',
		mode: 'flag-prompt',
		separator: false,
	},
	'mimo-code': {
		command: 'mimo',
		mode: 'flag-prompt',
		separator: false,
	},
	pi: {
		command: 'pi',
		mode: 'argv',
		separator: false,
	},
	omp: {
		command: 'omp',
		mode: 'argv',
		separator: false,
	},
	'prime-agent': {
		command: 'prime-agent',
		mode: 'argv',
		separator: true,
	},
	gemini: {
		command: 'gemini',
		mode: 'flag-prompt-interactive',
		separator: false,
	},
	antigravity: {
		command: 'agy',
		mode: 'flag-prompt-interactive',
		separator: false,
	},
	aider: {
		command: 'aider',
		mode: 'stdin-after-start',
		separator: false,
	},
	goose: {
		command: 'goose',
		mode: 'stdin-after-start',
		separator: false,
	},
	amp: {
		command: 'amp',
		mode: 'stdin-after-start',
		separator: false,
	},
	kilo: {
		command: 'kilo',
		mode: 'stdin-after-start',
		separator: false,
	},
	kiro: {
		command: 'kiro-cli',
		mode: 'stdin-after-start',
		separator: false,
	},
	crush: {
		command: 'crush',
		mode: 'stdin-after-start',
		separator: false,
	},
	aug: {
		command: 'auggie',
		mode: 'stdin-after-start',
		separator: false,
	},
	cline: {
		command: 'cline',
		mode: 'stdin-after-start',
		separator: false,
	},
	codebuff: {
		command: 'codebuff',
		mode: 'stdin-after-start',
		separator: false,
	},
	'command-code': {
		command: 'command-code',
		mode: 'argv',
		separator: false,
	},
	continue: {
		command: 'cn',
		mode: 'stdin-after-start',
		separator: false,
	},
	cursor: {
		command: 'cursor-agent',
		mode: 'argv',
		separator: false,
	},
	droid: {
		command: 'droid',
		mode: 'argv',
		separator: false,
	},
	kimi: {
		command: 'kimi',
		mode: 'stdin-after-start',
		separator: false,
	},
	'mistral-vibe': {
		command: 'vibe',
		mode: 'stdin-after-start',
		separator: false,
	},
	'qwen-code': {
		command: 'qwen',
		mode: 'stdin-after-start',
		separator: false,
	},
	rovo: {
		command: 'rovo',
		mode: 'stdin-after-start',
		separator: false,
	},
	hermes: {
		command: 'hermes',
		mode: 'hermes-query',
		separator: false,
	},
	openclaw: {
		command: 'openclaw',
		mode: 'stdin-after-start',
		separator: false,
	},
	copilot: {
		command: 'copilot',
		mode: 'flag-interactive',
		separator: false,
	},
	grok: {
		command: 'grok',
		mode: 'argv',
		separator: true,
	},
	muse: {
		command: 'muse',
		mode: 'stdin-after-start',
		separator: false,
	},
	zcode: {
		command: 'zcode',
		mode: 'stdin-after-start',
		separator: false,
	},
	devin: {
		command: 'devin',
		mode: 'stdin-after-start',
		separator: false,
	},
	minimax: {
		command: 'minimax',
		mode: 'stdin-after-start',
		separator: false,
	},
} as const;
