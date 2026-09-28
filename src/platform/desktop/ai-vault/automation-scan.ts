import { Platform } from 'obsidian';
import type { SessionIo } from '../../../core/ai-vault/types';
import type { AgentSessionRef } from '../../../shared/automation/types';
import { isCwdInsideVault } from './scope';

// Native layouts verified against stablyai/orca 27b823f (MIT). Keep these reads
// independent of the dashboard/session menu's much smaller recent-item limit.
function object(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function text(...values: unknown[]): string {
	return (values.find((v) => typeof v === 'string' && !!v) as string) || '';
}
function records(raw: string): Record<string, unknown>[] {
	try {
		return [object(JSON.parse(raw))];
	} catch {
		return raw.split('\n').flatMap((line) => {
			try {
				return [object(JSON.parse(line))];
			} catch {
				return [];
			}
		});
	}
}
export function parseNativeSession(
	agentId: string,
	raw: string,
	file: string,
	mtime: number,
	_platform: SessionIo['platform'],
): AgentSessionRef | undefined {
	const segments = file.replace(/\\/g, '/').split('/');
	let cwd = '',
		sessionId = '',
		title = '';
	for (const row of records(raw)) {
		if (row.parentSessionId || row.parent_session_id || row.subagentId) return undefined;
		const data = object(row.data),
			info = object(row.info),
			payload = object(row.payload),
			message = object(row.message);
		cwd ||= text(
			row.cwd,
			row.working_directory,
			row.directory,
			row.workDir,
			info.cwd,
			data.cwd,
			object(data.context).cwd,
			object(payload.record).workspace_root,
		);
		sessionId ||= text(
			row.session_id,
			row.sessionId,
			info.id,
			data.sessionId,
			row.type === 'session' || agentId.startsWith('opencode') || agentId === 'mimo-code' ? row.id : undefined,
		);
		title ||= text(
			row.title,
			row.lastPrompt,
			row.role === 'user' ? row.text : undefined,
			data.transformedContent,
			message.role === 'user' ? message.content : undefined,
		);
	}
	if (!sessionId && agentId === 'muse' && segments[segments.length - 1] === 'session.jsonl')
		sessionId = segments[segments.length - 2] ?? '';
	if (!cwd || !sessionId) return undefined;
	return {
		agentId,
		cwd,
		sessionId,
		title: title.slice(0, 100) || sessionId,
		modifiedAtMs: mtime,
		accountKey: '{}',
		transcriptPath: file,
	};
}
export async function scanNativeAutomationSessions(io: SessionIo, cwd: string): Promise<AgentSessionRef[]> {
	if (!Platform.isDesktop) return [];
	const path = await import('node:path');
	const p = io.platform === 'win32' ? path.win32 : path.posix,
		home = io.homedir();
	const data = io.env('XDG_DATA_HOME') || p.join(home, '.local', 'share');
	const sessionsDir = (env: string, fallback: string) => {
		const root = io.env(env) || fallback;
		return p.basename(root) === 'sessions' ? root : p.join(root, 'sessions');
	};
	const roots: Array<[string, string, number]> = [
		['pi', sessionsDir('PI_CODING_AGENT_DIR', p.join(home, '.pi', 'agent')), 2],
		['omp', sessionsDir('OMP_CODING_AGENT_DIR', p.join(home, '.omp', 'agent')), 2],
		[
			'prime-agent',
			io.env('PRIME_AGENT_SESSION_DIR') ||
				io.env('PRIME_AGENT_CODING_AGENT_SESSION_DIR') ||
				p.join(io.env('PRIME_AGENT_CODING_AGENT_DIR') || p.join(home, '.prime', 'agent'), 'sessions'),
			2,
		],
		['droid', p.join(home, '.factory', 'sessions'), 3],
		['droid', p.join(home, '.factory', 'projects'), 3],
		['copilot', p.join(io.env('COPILOT_HOME') || p.join(home, '.copilot'), 'session-state'), 2],
		['grok', p.join(io.env('GROK_HOME') || p.join(home, '.grok'), 'sessions'), 3],
		[
			'devin',
			p.join(
				io.env('DEVIN_HOME') ||
					(io.platform === 'win32'
						? p.join(io.env('APPDATA') || p.join(home, 'AppData', 'Roaming'), 'devin', 'cli')
						: p.join(data, 'devin', 'cli')),
				'transcripts',
			),
			2,
		],
		['muse', p.join(data, 'muse', 'sessions'), 5],
		['opencode', p.join(data, 'opencode', 'storage', 'session'), 2],
	];
	const found: AgentSessionRef[] = [];
	for (const [agent, root, depth] of roots) {
		let inspected = 0;
		const walk = async (dir: string, remaining: number): Promise<void> => {
			for (const name of await io.readDir(dir)) {
				if (++inspected > 10_000) return;
				if (name === 'subagents') continue;
				const file = p.join(dir, name),
					stat = await io.stat(file);
				if (!stat) continue;
				if (stat.isDirectory && remaining > 0) {
					await walk(file, remaining - 1);
					continue;
				}
				if (!stat.isFile || !/\.jsonl?$/.test(name)) continue;
				const raw = await io.readFile(file, 256 * 1024);
				if (!raw) continue;
				const session = parseNativeSession(agent, raw, file, stat.mtimeMs, io.platform);
				if (session && isCwdInsideVault(cwd, session.cwd, io.platform)) found.push(session);
			}
		};
		await walk(root, depth);
	}
	const kimiHome = io.env('KIMI_CODE_HOME') || p.join(home, '.kimi-code');
	const index = await io.readFile(p.join(kimiHome, 'session_index.jsonl'), 4 * 1024 * 1024);
	if (index)
		for (const row of records(index)) {
			if (
				typeof row.workDir !== 'string' ||
				typeof row.sessionId !== 'string' ||
				typeof row.sessionDir !== 'string' ||
				!isCwdInsideVault(cwd, row.workDir, io.platform)
			)
				continue;
			const statePath = p.join(row.sessionDir, 'state.json'),
				stat = await io.stat(statePath);
			if (!stat?.isFile) continue;
			const state = records((await io.readFile(statePath, 128 * 1024)) || '{}')[0];
			found.push({
				agentId: 'kimi',
				sessionId: row.sessionId,
				cwd: row.workDir,
				title: text(state?.title, row.sessionId),
				accountKey: JSON.stringify({ KIMI_CODE_HOME: kimiHome }),
				modifiedAtMs: stat.mtimeMs,
				transcriptPath: statePath,
			});
		}
	return found;
}
