import * as path from 'node:path';

/** Only execution essentials cross into prechecks; never inherit host config/credential/state directories. */
export function precheckEnvironment(home: string, source: NodeJS.ProcessEnv, windows: boolean): NodeJS.ProcessEnv {
	const paths = windows ? path.win32 : path;
	const env: NodeJS.ProcessEnv = {};
	for (const [key, value] of Object.entries(source)) {
		if (/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|LANG|LANGUAGE|LC_[A-Z_]+|TZ|TERM)$/i.test(key)) env[key] = value;
	}
	const owned = (relative: string) => paths.join(home, relative);
	return {
		...env,
		HOME: home,
		USERPROFILE: home,
		HOMEDRIVE: windows ? paths.parse(home).root.replace(/[\\/]$/, '') : '',
		HOMEPATH: windows ? home.slice(paths.parse(home).root.length - 1) : home,
		XDG_CONFIG_HOME: owned('.config'),
		XDG_CACHE_HOME: owned('.cache'),
		XDG_DATA_HOME: owned('.local/share'),
		XDG_STATE_HOME: owned('.local/state'),
		XDG_RUNTIME_DIR: owned('runtime'),
		APPDATA: owned('AppData/Roaming'),
		LOCALAPPDATA: owned('AppData/Local'),
		TMPDIR: owned('tmp'),
		TMP: owned('tmp'),
		TEMP: owned('tmp'),
		CLAUDE_CONFIG_DIR: owned('.claude'),
		CLAUDE_CODE_TMPDIR: owned('tmp/claude'),
		CODEX_HOME: owned('.codex'),
		GEMINI_CLI_HOME: owned('.gemini'),
		GROK_HOME: owned('.grok'),
		PI_CODING_AGENT_DIR: owned('.pi'),
		PI_CODING_AGENT_SESSION_DIR: owned('.pi/sessions'),
		OPENCODE_CONFIG_DIR: owned('.config/opencode'),
		BASH_ENV: '',
		ENV: '',
	};
}
