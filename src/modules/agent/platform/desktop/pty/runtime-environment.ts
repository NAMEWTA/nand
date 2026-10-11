import path from 'node:path';
import { absoluteNandPath } from '../../../../../host/desktop/nand-paths';
import { nativeVaultStorage } from '../../../../../host/desktop/vault-storage';
import { ISOLATED_CREDENTIAL_ENV } from '../agents/accounts';
import { secureOwnedDirectory } from '../../../../../host/desktop/owned-permissions';

/** Helper and ordinary shells have their own vault home, including native temporary-file fallbacks. */
export async function terminalEnvironment(vault: string, device: string): Promise<Record<string, string>> {
	const relative = `.nand/terminal-agent/${device}/runtime`, root = await absoluteNandPath(vault, relative);
	await secureOwnedDirectory(vault, relative);
	const env = {
		HOME: path.join(root, 'home'), USERPROFILE: path.join(root, 'home'),
		APPDATA: path.join(root, 'home', 'AppData', 'Roaming'), LOCALAPPDATA: path.join(root, 'home', 'AppData', 'Local'),
		XDG_CONFIG_HOME: path.join(root, 'config'), XDG_CACHE_HOME: path.join(root, 'cache'),
		XDG_DATA_HOME: path.join(root, 'data'), XDG_STATE_HOME: path.join(root, 'state'),
		TMP: path.join(root, 'tmp'), TEMP: path.join(root, 'tmp'), TMPDIR: path.join(root, 'tmp'),
		CLAUDE_CONFIG_DIR: path.join(root, 'home', '.claude'), CLAUDE_CODE_TMPDIR: path.join(root, 'tmp'),
		CODEX_HOME: path.join(root, 'home', '.codex'), GROK_HOME: path.join(root, 'home', '.grok'), GEMINI_CLI_HOME: path.join(root, 'home'),
		PI_CODING_AGENT_DIR: path.join(root, 'home', '.pi', 'agent'), PI_CODING_AGENT_SESSION_DIR: path.join(root, 'home', '.pi', 'agent', 'sessions'),
		OPENCODE_CONFIG_DIR: path.join(root, 'config', 'opencode'),
	};
	const storage = nativeVaultStorage(vault);
	for (const directory of new Set(Object.values(env))) await storage.mkdir(relative + '/' + path.relative(root, directory).split(path.sep).join('/'));
	return { ...env, ...ISOLATED_CREDENTIAL_ENV };
}
