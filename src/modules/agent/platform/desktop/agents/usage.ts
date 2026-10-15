import * as fs from 'node:fs';
import * as https from 'node:https';
import * as path from 'node:path';
import { getAgent } from '../../../core/launch/catalog';
import type { AgentId, AgentSettings, UsageKind, UsageSnapshot, UsageWindow } from '../../../core/launch/types';
import { t } from '../../../../../shared/i18n/index';
import { accountEnv } from './accounts';
import { privatePathHasSymlink } from '../../../../../host/desktop/private-mode';
import { ProviderReadError, ProviderUsageCache } from './usage-cache';

const REQUEST_TIMEOUT_MS = 10_000;
const lastKnown = new Map<string, UsageSnapshot>();
const providerReads = new ProviderUsageCache();

type ProviderSnapshot = Omit<UsageSnapshot, 'agentId' | 'failed'>;

const READERS: Partial<Record<UsageKind, (home: string) => Promise<ProviderSnapshot>>> = {
	claude: readClaudeUsage,
	codex: readCodexUsage,
	grok: readGrokUsage,
	gemini: readGeminiUsage,
	opencode: readOpenCodeUsage,
};

export interface UsageContext {
	settings: AgentSettings;
	vault: string;
	device: string;
}
export async function readUsageSnapshots(
	enabled: readonly AgentId[],
	context: UsageContext,
): Promise<UsageSnapshot[]> {
	const jobs: Array<Promise<UsageSnapshot>> = [];
	for (const id of enabled) {
		const agent = getAgent(id);
		const read = READERS[agent.usage];
		if (!read) {
			jobs.push(
				Promise.resolve({
					agentId: id,
					provider: agent.title,
					account: null,
					status: t('agent.usage.status.quotaUnsupported'),
					statusKey: 'quotaUnsupported',
					failed: false,
					windows: [],
					checkedAt: Date.now(),
					source: 'unsupported',
				}),
			);
			continue;
		}
		const account = context.settings.agents[id].accountId;
		let env: Record<string, string>;
		try { env = await accountEnv(agent, account, context.vault, context.device); }
		catch (error) { jobs.push(safeRead(id, () => Promise.reject(error instanceof Error ? error : new Error(String(error))))); continue; }
		const homes: Record<string, string> = { claude: env.CLAUDE_CONFIG_DIR!, codex: env.CODEX_HOME!, grok: env.GROK_HOME!, gemini: path.join(env.GEMINI_CLI_HOME!, '.gemini'), opencode: path.join(env.XDG_DATA_HOME!, 'opencode') };
		const home = homes[agent.usage]!;
		const key = `${agent.usage}:${home}`;
		const ttl = Math.max(60, context.settings.usageRefreshSec) * 1000;
		jobs.push(
			safeRead(id, async () => {
				const cached = await providerReads.read(key, ttl, () => read(home));
				return { ...cached.snapshot, checkedAt: cached.checkedAt };
			}).then((snapshot) => {
				const previous = lastKnown.get(key);
				if (snapshot.failed && previous)
					return { ...previous, failed: true, stale: true, status: snapshot.status, statusKey: snapshot.statusKey };
				const next = {
					...snapshot,
					account: account || snapshot.account,
					checkedAt: snapshot.checkedAt ?? Date.now(),
					source: 'provider',
				};
				if (!next.failed && next.windows.length) {
					lastKnown.delete(key);
					lastKnown.set(key, next);
					if (lastKnown.size > 32) {
						const oldest: unknown = lastKnown.keys().next().value;
						if (typeof oldest === 'string') lastKnown.delete(oldest);
					}
				}
				return next;
			}),
		);
	}
	return Promise.all(jobs);
}

async function safeRead(agentId: AgentId, read: () => Promise<ProviderSnapshot>): Promise<UsageSnapshot> {
	const provider = getAgent(agentId).title;
	try {
		const snapshot = await read();
		return { ...snapshot, agentId, provider, failed: false };
	} catch (error) {
		const statusKey =
			error instanceof Error && /HTTP (401|403)/.test(error.message)
				? 'expired'
				: error instanceof Error
					? undefined
					: 'readFailed';
		const message =
			statusKey
				? t(`agent.usage.status.${statusKey}`)
				: error instanceof Error
					? error.message
					: t('agent.usage.status.readFailed');
		return { agentId, provider, account: null, status: message, statusKey, failed: true, windows: [], checkedAt: error instanceof ProviderReadError ? error.checkedAt : Date.now() };
	}
}

async function readClaudeUsage(home: string): Promise<ProviderSnapshot> {
	const credentials = await readJson(path.join(home, '.credentials.json'));
	const oauth = asRecord(credentials?.claudeAiOauth);
	const token = typeof oauth?.accessToken === 'string' ? oauth.accessToken : '';
	if (!token) {
		return { provider: 'Claude', account: null, status: t('agent.usage.status.notSignedIn'), statusKey: 'notSignedIn', windows: [] };
	}
	const data = await requestJson('https://api.anthropic.com/api/oauth/usage', {
		Authorization: `Bearer ${token}`,
		'anthropic-beta': 'oauth-2025-04-20',
		'User-Agent': 'claude-code/2.1.0',
		Accept: 'application/json',
	});
	const windows = [
		mapPercentWindow('5小时', asRecord(data.five_hour), ['utilization', 'used_percentage']),
		mapPercentWindow('每周', asRecord(data.seven_day), ['utilization', 'used_percentage']),
	].filter((window): window is UsageWindow => window !== null);
	return {
		provider: 'Claude',
		account: null,
		status: windows.length > 0 ? t('agent.usage.status.readOk') : t('agent.usage.status.noNumbers'),
		statusKey: windows.length > 0 ? 'readOk' : 'noNumbers',
		windows,
	};
}

async function readCodexUsage(home: string): Promise<ProviderSnapshot> {
	const auth = await readJson(path.join(home, 'auth.json'));
	const tokens = asRecord(auth?.tokens);
	const accessToken = typeof tokens?.access_token === 'string' ? tokens.access_token : '';
	if (!accessToken) {
		return { provider: 'Codex', account: null, status: t('agent.usage.status.notSignedIn'), statusKey: 'notSignedIn', windows: [] };
	}
	const headers: Record<string, string> = {
		Authorization: `Bearer ${accessToken}`,
		'User-Agent': 'codex-cli',
		'OpenAI-Beta': 'codex-1',
		originator: 'Codex Desktop',
		Accept: 'application/json',
	};
	if (typeof tokens?.account_id === 'string' && tokens.account_id) {
		headers['ChatGPT-Account-Id'] = tokens.account_id;
	}
	const data = await requestJson('https://chatgpt.com/backend-api/wham/usage', headers);
	const rateLimit = asRecord(data.rate_limit);
	const windows = [
		mapCodexWindow(asRecord(rateLimit?.primary_window)),
		mapCodexWindow(asRecord(rateLimit?.secondary_window)),
	].filter((window): window is UsageWindow => window !== null);
	const plan = typeof data.plan_type === 'string' ? data.plan_type : null;
	return {
		provider: 'Codex',
  planType: plan ?? undefined,
		account: plan,
		status: windows.length > 0 ? t('agent.usage.status.readOk') : t('agent.usage.status.noNumbers'),
		statusKey: windows.length > 0 ? 'readOk' : 'noNumbers',
		windows,
	};
}

async function readGrokUsage(home: string): Promise<ProviderSnapshot> {
	const session = await readGrokSession(home);
	if (!session) {
		return { provider: 'Grok', account: null, status: t('agent.usage.status.notSignedIn'), statusKey: 'notSignedIn', windows: [] };
	}
	if (session.expiresAtMs !== null && session.expiresAtMs - Date.now() <= 5 * 60 * 1000) {
		return { provider: 'Grok', account: session.email, status: t('agent.usage.status.expired'), statusKey: 'expired', windows: [] };
	}
	const headers: Record<string, string> = {
		Authorization: `Bearer ${session.accessToken}`,
		'X-XAI-Token-Auth': 'xai-grok-cli',
		Accept: 'application/json',
	};
	if (session.userId) headers['x-userid'] = session.userId;
	const data = await requestJson('https://cli-chat-proxy.grok.com/v1/billing?format=credits', headers);
	const config = asRecord(data.config) ?? data;
	const windows: UsageWindow[] = [];
	const weekly = numberField(config, ['creditUsagePercent']);
	if (weekly !== null) {
		windows.push({
			name: '每周',
			usedPct: clampPct(weekly),
			resetAt: resetLabel(
				stringField(asRecord(config.currentPeriod) ?? {}, ['end']) ?? stringField(config, ['billingPeriodEnd']),
			),
		});
	}
	const monthly = monthlyPercent(config);
	if (monthly) windows.push(monthly);
	return {
		provider: 'Grok',
		account: session.email,
		status: windows.length > 0 ? t('agent.usage.status.readOk') : t('agent.usage.status.noNumbers'),
		statusKey: windows.length > 0 ? 'readOk' : 'noNumbers',
		windows,
	};
}

async function readGrokSession(home: string): Promise<{
	accessToken: string;
	userId: string | null;
	email: string | null;
	expiresAtMs: number | null;
} | null> {
	const parsed = await readJson(path.join(home, 'auth.json'));
	if (!parsed) return null;
	const entries = Object.entries(parsed);
	const preferred = entries.find(([key]) => key === 'https://auth.x.ai' || key.startsWith('https://auth.x.ai::'));
	const chosen = asRecord((preferred ?? entries[0])?.[1]);
	const accessToken = typeof chosen?.key === 'string' ? chosen.key : '';
	if (!accessToken) return null;
	const expires = typeof chosen?.expires_at === 'string' ? Date.parse(chosen.expires_at) : Number.NaN;
	return {
		accessToken,
		userId: typeof chosen?.user_id === 'string' ? chosen.user_id : null,
		email: typeof chosen?.email === 'string' ? chosen.email : null,
		expiresAtMs: Number.isFinite(expires) ? expires : null,
	};
}

function mapCodexWindow(record: Record<string, unknown> | null): UsageWindow | null {
	if (!record) return null;
	const used = numberField(record, ['used_percent', 'used_percentage']);
	if (used === null) return null;
	const seconds = numberField(record, ['limit_window_seconds']);
	const name = seconds !== null && seconds > 8 * 60 * 60 ? '每周' : '5小时';
	const reset = record.reset_at;
	const resetAt =
		typeof reset === 'number'
			? resetLabel(new Date(reset > 10_000_000_000 ? reset : reset * 1000).toISOString())
			: resetLabel(typeof reset === 'string' ? reset : null);
	return { name, usedPct: clampPct(used), resetAt };
}

function mapPercentWindow(name: string, record: Record<string, unknown> | null, keys: string[]): UsageWindow | null {
	if (!record) return null;
	const used = numberField(record, keys);
	if (used === null) return null;
	return {
		name,
		usedPct: clampPct(used),
		resetAt: resetLabel(stringField(record, ['resets_at', 'resetsAt'])),
	};
}

function monthlyPercent(config: Record<string, unknown>): UsageWindow | null {
	const limit = money(config.monthlyLimit);
	const used = money(config.used);
	if (limit === null || used === null || limit <= 0) return null;
	return {
		name: '每月',
		usedPct: clampPct((used / limit) * 100),
		resetAt: resetLabel(
			stringField(asRecord(config.currentPeriod) ?? {}, ['end']) ?? stringField(config, ['billingPeriodEnd']),
		),
	};
}

function money(value: unknown): number | null {
	const record = asRecord(value);
	const raw = record?.val;
	const num = typeof raw === 'string' ? Number.parseFloat(raw) : raw;
	return typeof num === 'number' && Number.isFinite(num) ? num : null;
}

function resetLabel(value: string | null): string | null {
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString();
}

function clampPct(value: number): number {
	return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

function numberField(record: Record<string, unknown>, keys: string[]): number | null {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === 'number' && Number.isFinite(value)) return value;
		if (typeof value === 'string' && value.trim()) {
			const parsed = Number(value);
			if (Number.isFinite(parsed)) return parsed;
		}
	}
	return null;
}

function stringField(record: Record<string, unknown>, keys: string[]): string | null {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === 'string' && value.length > 0) return value;
		if (typeof value === 'number' && Number.isFinite(value))
			return new Date(value > 10_000_000_000 ? value : value * 1000).toISOString();
	}
	return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	return value as Record<string, unknown>;
}

async function readJson(file: string): Promise<Record<string, unknown> | null> {
	if (await privatePathHasSymlink(file)) throw new Error('private-storage.symlink');
	try {
		return asRecord(JSON.parse(fs.readFileSync(file, 'utf8')));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw error;
	}
}

function requestJson(url: string, headers: Record<string, string>, redirects = 3): Promise<Record<string, unknown>> {
	return new Promise((resolve, reject) => {
		const request = https.get(url, { headers, timeout: REQUEST_TIMEOUT_MS }, (response) => {
			const status = response.statusCode ?? 0;
			const location = response.headers.location;
			if (status >= 300 && status < 400 && location && redirects > 0) {
				response.resume();
				const target = new URL(location, url);
				if (target.origin !== new URL(url).origin) {
					reject(new Error('Unexpected usage redirect'));
					return;
				}
				resolve(requestJson(target.toString(), headers, redirects - 1));
				return;
			}
			const chunks: Buffer[] = [];
			response.on('data', (chunk: Buffer) => chunks.push(chunk));
			response.on('end', () => {
				const body = Buffer.concat(chunks).toString('utf8');
				if (status !== 200) {
					reject(new Error(`HTTP ${status}`));
					return;
				}
				try {
					const parsed = asRecord(JSON.parse(body));
					if (!parsed) {
						reject(new Error('用量响应不是对象'));
						return;
					}
					resolve(parsed);
				} catch (error) {
					reject(error instanceof Error ? error : new Error('用量响应无法解析'));
				}
			});
		});
		request.on('timeout', () => {
			request.destroy(new Error('用量请求超时'));
		});
		request.on('error', reject);
	});
}

function requestRaw(url: string, headers: Record<string, string>, body?: string): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const request = https.request(
			url,
			{
				method: body ? 'POST' : 'GET',
				headers,
				timeout: REQUEST_TIMEOUT_MS,
			},
			(response) => {
				const status = response.statusCode ?? 0;
				const chunks: Buffer[] = [];
				response.on('data', (chunk: Buffer) => chunks.push(chunk));
				response.on('end', () => {
					const text = Buffer.concat(chunks).toString('utf8');
					if (status !== 200) {
						reject(new Error(`HTTP ${status}`));
						return;
					}
					try {
						resolve(JSON.parse(text) as unknown);
					} catch (error) {
						reject(error instanceof Error ? error : new Error('用量响应无法解析'));
					}
				});
			},
		);
		request.on('timeout', () => {
			request.destroy(new Error('用量请求超时'));
		});
		request.on('error', reject);
		if (body) request.write(body);
		request.end();
	});
}

async function readGeminiUsage(home: string): Promise<ProviderSnapshot> {
	const creds = await readJson(path.join(home, 'oauth_creds.json'));
	const token = typeof creds?.access_token === 'string' ? creds.access_token : '';
	const expiry = typeof creds?.expiry_date === 'number' ? creds.expiry_date : 0;
	if (!token)
		return { provider: 'Gemini', account: null, status: t('agent.usage.status.notSignedIn'), statusKey: 'notSignedIn', windows: [] };
	if (expiry > 0 && expiry < Date.now()) {
		return { provider: 'Gemini', account: null, status: t('agent.usage.status.expired'), statusKey: 'expired', windows: [] };
	}
	const headers = {
		Authorization: `Bearer ${token}`,
		'Content-Type': 'application/json',
		Accept: 'application/json',
	};
	const loaded = asRecord(
		await requestRaw(
			'https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist',
			headers,
			JSON.stringify({ metadata: { ideType: 'GEMINI_CLI', pluginType: 'GEMINI' } }),
		),
	);
	const project = typeof loaded?.cloudaicompanionProject === 'string' ? loaded.cloudaicompanionProject : '';
	if (!project)
		return { provider: 'Gemini', account: null, status: t('agent.usage.status.noNumbers'), statusKey: 'noNumbers', windows: [] };
	const quota = await requestRaw(
		'https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota',
		headers,
		JSON.stringify({ project }),
	);
	const buckets = Array.isArray(quota) ? quota : asRecord(quota)?.buckets;
	const windows: UsageWindow[] = [];
	if (Array.isArray(buckets)) {
		for (const bucket of buckets) {
			const record = asRecord(bucket);
			const remaining = typeof record?.remainingFraction === 'number' ? record.remainingFraction : null;
			if (remaining === null) continue;
			windows.push({
				name: typeof record?.modelId === 'string' ? record.modelId : t('agent.usage.model'),
				usedPct: clampPct((1 - remaining) * 100),
				resetAt: resetLabel(typeof record?.resetTime === 'string' ? record.resetTime : null),
			});
		}
	}
	const tightest = windows.sort((a, b) => (b.usedPct ?? 0) - (a.usedPct ?? 0))[0];
	return {
		provider: 'Gemini',
		account: null,
		status: tightest ? t('agent.usage.status.readOk') : t('agent.usage.status.noNumbers'),
		statusKey: tightest ? 'readOk' : 'noNumbers',
		windows,
	};
}

async function readOpenCodeUsage(home: string): Promise<ProviderSnapshot> {
	const key = await readOpenCodeGoKey(home);
	if (!key)
		return { provider: 'OpenCode', account: null, status: t('agent.usage.status.notSignedIn'), statusKey: 'notSignedIn', windows: [] };
	const data = asRecord(
		await requestRaw('https://opencode.ai/zen/go/v1/usage', {
			Authorization: `Bearer ${key}`,
			Accept: 'application/json',
		}),
	);
	const usage = asRecord(data?.usage);
	const windows = [
		percentWindow('5小时', asRecord(usage?.rolling)),
		percentWindow('每周', asRecord(usage?.weekly)),
		percentWindow('每月', asRecord(usage?.monthly)),
	].filter((window): window is UsageWindow => window !== null);
	return {
		provider: 'OpenCode',
		account: null,
		status: windows.length > 0 ? t('agent.usage.status.readOk') : t('agent.usage.status.noNumbers'),
		statusKey: windows.length > 0 ? 'readOk' : 'noNumbers',
		windows,
	};
}

async function readOpenCodeGoKey(home: string): Promise<string | null> {
	const entry = asRecord((await readJson(path.join(home, 'auth.json')))?.['opencode-go']);
	return entry?.type === 'api' && typeof entry.key === 'string' && entry.key.trim() ? entry.key.trim() : null;
}

function percentWindow(name: string, record: Record<string, unknown> | null): UsageWindow | null {
	if (!record || typeof record.percent !== 'number' || !Number.isFinite(record.percent)) return null;
	return {
		name,
		usedPct: clampPct(record.percent),
		resetAt: resetLabel(typeof record.resetsAt === 'string' ? record.resetsAt : null),
	};
}
