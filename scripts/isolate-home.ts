// Tests never touch the developer's real home or provider configuration: every test file starts with a throwaway HOME.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const home = mkdtempSync(join(tmpdir(), 'nand-test-home-'));
for (const key of ['HOME', 'USERPROFILE']) process.env[key] = home;
for (const key of ['CLAUDE_CONFIG_DIR', 'CODEX_HOME', 'GROK_HOME', 'GEMINI_CLI_HOME', 'PI_CODING_AGENT_DIR', 'PI_CODING_AGENT_SESSION_DIR', 'OPENCODE_CONFIG_DIR', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME', 'XDG_STATE_HOME', 'APPDATA', 'LOCALAPPDATA']) delete process.env[key];
process.on('exit', () => { try { rmSync(home, { recursive: true, force: true }); } catch { /* best effort */ } });
