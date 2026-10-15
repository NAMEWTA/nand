// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/ticktick-service.ts
import { requestUrl, type RequestUrlParam, type RequestUrlResponse } from 'obsidian';

/**
 * TickTick / 滴答清单 client for the unofficial V2 web API.
 *
 * Auth: the `t` session cookie (user pastes the value from DevTools). Sent as
 * `Cookie: t=<token>` on every request. The same API is served from
 * api.dida365.com (China) and api.ticktick.com (international); the user picks
 * the region matching their account. requestUrl bypasses browser cookie/CORS
 * limits, so this works on desktop and mobile.
 *
 * Endpoints/shapes: thesim/TickTickSync (Obsidian plugin) and sebpretzer/pyticktick.
 * The V2 API is undocumented and rotates its `x-device` header ~1-2x/yr; the
 * version is overridable via settings to ride out breaks.
 */

const HOSTS: Record<'dida365' | 'ticktick', string> = {
	dida365: 'api.dida365.com',
	ticktick: 'api.ticktick.com',
};
const DEFAULT_UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const DEFAULT_DEVICE_VERSION = 8000;

export interface TickTickProject {
	id: string;
	name: string;
	color?: string;
	closed?: boolean;
	viewMode?: string;
}

export interface TickTickTask {
	id: string;
	title: string;
	content?: string;
	dueDate?: string;
	startDate?: string;
	priority: number; // 0 None, 1 Low, 3 Medium, 5 High
	status: number; // 0 incomplete, 2 completed, -1 abandoned
	projectId?: string;
	columnId?: string;
	tags?: string[];
	repeatFlag?: string | null;
	progress?: number;
	sortOrder?: number; // manual order within project (descending)
	items?: Array<{ id: string; title: string; status: number }>;
	completedTime?: string;
}

export interface TickTickHabit {
	id: string;
	name: string;
	goal?: number;
	unit?: string;
	color?: string;
}

export interface TickTickHabitCheckin {
	habitId: string;
	date: string;
	value?: number;
}

export interface TickTickSnapshot {
	projects: TickTickProject[];
	tasks: TickTickTask[]; // incomplete tasks
	inboxId?: string;
	tags: string[];
}

export interface TickTickRequestOptions {
	signal?: AbortSignal;
	ownerWindow?: Window;
}
export const TICKTICK_TIMEOUT_MS = 15_000;
/** requestUrl has no transport abort: bound logical lifetime and discard late responses. */
async function request(
	options: RequestUrlParam,
	lifetime: TickTickRequestOptions,
	write = false,
): Promise<RequestUrlResponse> {
	const { signal } = lifetime;
	if (signal?.aborted) throw Error('CANCELLED');
	const owner = lifetime.ownerWindow ?? window;
	let timer: number | undefined;
	let abort: (() => void) | undefined;
	try {
		const response = await Promise.race([
			requestUrl(options).catch(() => {
				throw Error('NETWORK');
			}),
			new Promise<never>((_, reject) => {
				timer = owner.setTimeout(() => reject(Error(write ? 'WRITE_TIMEOUT' : 'TIMEOUT')), TICKTICK_TIMEOUT_MS);
				abort = () => reject(Error('CANCELLED'));
				signal?.addEventListener('abort', abort, { once: true });
			}),
		]);
		if (signal?.aborted) throw Error('CANCELLED');
		return response;
	} finally {
		if (timer !== undefined) owner.clearTimeout(timer);
		if (abort) signal?.removeEventListener('abort', abort);
	}
}
export class TickTickClient {
	private readonly host: string;
	private readonly cookie: string;
	private readonly ua: string;
	private readonly deviceVersion: number;
	private readonly deviceId: string;
	private readonly cache = new Map<string, { ts: number; data: unknown }>();
	private static readonly TTL_MS = 60_000;

	private readonly csrf: string;

	constructor(region: 'dida365' | 'ticktick', cookie: string, deviceVersion?: string, csrf?: string) {
		this.host = HOSTS[region] ?? HOSTS.dida365;
		this.cookie = /^[\x21-\x3A\x3C-\x7E]+$/.test(cookie.trim()) ? cookie.trim() : '';
		this.csrf = /^[\x21-\x3A\x3C-\x7E]+$/.test((csrf ?? '').trim()) ? csrf!.trim() : '';
		this.ua = DEFAULT_UA;
		const v = parseInt(deviceVersion ?? '', 10);
		this.deviceVersion = isNaN(v) ? DEFAULT_DEVICE_VERSION : v;
		this.deviceId = `dash-${Math.random().toString(36).slice(2, 10)}`;
	}

	isConfigured(): boolean {
		return this.cookie.length > 0;
	}

	/** Writes need the CSRF token (the `_csrf_token` cookie). */
	canWrite(): boolean {
		return this.isConfigured() && this.csrf.length > 0;
	}

	private async req<T>(
		path: string,
		method: 'GET' | 'POST' = 'GET',
		body?: unknown,
		lifetime: TickTickRequestOptions = {},
	): Promise<T> {
		if (lifetime.signal?.aborted) throw Error('CANCELLED');
		if (!this.isConfigured()) throw new Error('NO_COOKIE');
		const cacheKey = `${method}:${path}`;
		if (method === 'GET') {
			const c = this.cache.get(cacheKey);
			if (c && Date.now() - c.ts < TickTickClient.TTL_MS) return c.data as T;
		}
		const url = `https://${this.host}${path}`;
		const res = await request(
			{
				url,
				method,
				headers: {
					Cookie: `t=${this.cookie}`,
					'User-Agent': this.ua,
					'x-device': JSON.stringify({ platform: 'web', version: this.deviceVersion, id: this.deviceId }),
					'Content-Type': 'application/json',
				},
				body: body ? JSON.stringify(body) : undefined,
				throw: false,
			},
			lifetime,
		);
		const status = res.status;
		const text = typeof res.text === 'string' ? res.text : '';
		let parsed: unknown = null;
		try {
			parsed = text ? JSON.parse(text) : null;
		} catch {
			parsed = null;
		}

		if (status === 401 || status === 403) throw new Error('BAD_COOKIE');
		if (status === 429) throw new Error('RATE_LIMITED');
		if (status >= 400) throw new Error(`HTTP_${status}:${text.slice(0, 120)}`);

		const data = (parsed ?? null) as T;
		if (method === 'GET') this.cache.set(cacheKey, { ts: Date.now(), data });
		return data;
	}

	/** Full snapshot: projects + all incomplete tasks + inbox + tags in one call. */
	async fetchSnapshot(lifetime: TickTickRequestOptions = {}): Promise<TickTickSnapshot> {
		const raw = (await this.req<SnapshotRaw>('/api/v2/batch/check/0', 'GET', undefined, lifetime)) ?? {};
		const projects: TickTickProject[] = (Array.isArray(raw.projectProfiles) ? raw.projectProfiles : [])
			.filter(isRecord)
			.map((p) => ({
				id: str(p['id']),
				name: str(p['name']),
				color: typeof p['color'] === 'string' ? p['color'] : undefined,
				closed: p['closed'] === true,
				viewMode: typeof p['viewMode'] === 'string' ? p['viewMode'] : undefined,
			}));
		const tasks: TickTickTask[] = (Array.isArray(raw.syncTaskBean?.update) ? raw.syncTaskBean.update : [])
			.filter(isRecord)
			.map(normalizeTask)
			.filter((t) => t.id.length > 0);
		return {
			projects,
			tasks,
			inboxId: str(raw.inboxId) || undefined,
			tags: (Array.isArray(raw.tags) ? raw.tags : []).map((t) => str(t)),
		};
	}

	/** Completed tasks. */
	async fetchCompleted(lifetime: TickTickRequestOptions = {}): Promise<TickTickTask[]> {
		const raw = await this.req<Array<Record<string, unknown>>>(
			'/api/v2/project/all/closed?status=Completed',
			'GET',
			undefined,
			lifetime,
		);
		return (Array.isArray(raw) ? raw : [])
			.filter(isRecord)
			.map(normalizeTask)
			.filter((t) => t.id.length > 0);
	}

	async fetchHabits(lifetime: TickTickRequestOptions = {}): Promise<TickTickHabit[]> {
		const raw = await this.req<Array<Record<string, unknown>>>('/api/v2/habits', 'GET', undefined, lifetime);
		return (Array.isArray(raw) ? raw : [])
			.filter(isRecord)
			.map((h) => ({
				id: str(h['id']) || str(h['habitID']),
				name: str(h['name']) || str(h['title']),
				goal: typeof h['goal'] === 'number' ? h['goal'] : undefined,
				unit: typeof h['unit'] === 'string' ? h['unit'] : undefined,
				color: typeof h['color'] === 'string' ? h['color'] : undefined,
			}))
			.filter((h) => h.id.length > 0 && h.name.length > 0);
	}

	/** Habit checkins since afterStamp (YYYYMMDD). */
	async fetchHabitCheckins(
		habitIds: string[],
		afterStamp: string,
		lifetime: TickTickRequestOptions = {},
	): Promise<TickTickHabitCheckin[]> {
		if (habitIds.length === 0) return [];
		const raw = await this.req<Array<Record<string, unknown>>>(
			'/api/v2/habitCheckins/query',
			'POST',
			{
				habitIds,
				afterStamp,
			},
			lifetime,
		);
		return (Array.isArray(raw) ? raw : []).filter(isRecord).map((c) => ({
			habitId: str(c['habitId']) || str(c['habitID']),
			date: str(c['date']) || str(c['checkinStamp']),
			value: typeof c['value'] === 'number' ? c['value'] : undefined,
		}));
	}

	clearCache(): void {
		this.cache.clear();
	}

	// ---------- Writes (require CSRF) ----------

	private async write<T>(path: string, body: unknown = {}, lifetime: TickTickRequestOptions = {}): Promise<T> {
		if (lifetime.signal?.aborted) throw Error('CANCELLED');
		if (!this.canWrite()) throw new Error('NO_CSRF');
		const url = `https://${this.host}${path}`;
		const res = await request(
			{
				url,
				method: 'POST',
				headers: {
					Cookie: `t=${this.cookie}; _csrf_token=${this.csrf}`,
					'User-Agent': this.ua,
					'x-device': JSON.stringify({ platform: 'web', version: this.deviceVersion, id: this.deviceId }),
					'Content-Type': 'application/json',
					'X-Crsftoken': this.csrf,
				},
				body: JSON.stringify(body ?? {}),
				throw: false,
			},
			lifetime,
			true,
		);
		const status = res.status;
		const text = typeof res.text === 'string' ? res.text : '';
		if (status === 401 || status === 403) throw new Error('BAD_COOKIE');
		if (status === 429) throw new Error('RATE_LIMITED');
		if (status >= 400) throw new Error(`HTTP_${status}:${text.slice(0, 120)}`);
		let parsed: unknown = null;
		try {
			parsed = text ? JSON.parse(text) : null;
		} catch {
			parsed = null;
		}
		this.clearCache();
		return (parsed ?? {}) as T;
	}

	/** Mark a task complete (status=2). V2 has no /complete endpoint — use batch update. */
	async completeTask(projectId: string, taskId: string, lifetime: TickTickRequestOptions = {}): Promise<void> {
		await this.write(
			'/api/v2/batch/task',
			{
				update: [{ projectId, id: taskId, status: 2, completedTime: tickDateNow() }],
			},
			lifetime,
		);
	}

	/** Mark a completed task incomplete (status=0). */
	async uncompleteTask(projectId: string, taskId: string, lifetime: TickTickRequestOptions = {}): Promise<void> {
		await this.write('/api/v2/batch/task', { update: [{ projectId, id: taskId, status: 0 }] }, lifetime);
	}

	/** Update task fields (title, dueDate, priority, ...). */
	async updateTask(
		projectId: string,
		taskId: string,
		fields: Record<string, unknown>,
		lifetime: TickTickRequestOptions = {},
	): Promise<void> {
		await this.write('/api/v2/batch/task', { update: [{ projectId, id: taskId, ...fields }] }, lifetime);
	}

	/** Reorder: each entry is {projectId, id, sortOrder}. */
	async reorderTasks(
		updates: Array<{ projectId: string; id: string; sortOrder: number }>,
		lifetime: TickTickRequestOptions = {},
	): Promise<void> {
		if (updates.length === 0) return;
		await this.write('/api/v2/batch/task', { update: updates }, lifetime);
	}
}

interface SnapshotRaw {
	inboxId?: unknown;
	projectProfiles?: Array<Record<string, unknown>>;
	syncTaskBean?: { update?: Array<Record<string, unknown>> };
	tags?: Array<unknown>;
}

/** TickTick dates are "yyyy-MM-dd'T'HH:mm:ssZ" (e.g. 2019-11-13T03:00:00+0000). */
export function parseTickDate(value?: string): Date | null {
	if (!value) return null;
	const d = new Date(value);
	return isNaN(d.getTime()) ? null : d;
}

/** Coerce an unknown JSON value into a string safely (avoids [object Object]). */
function str(v: unknown): string {
	if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
	return '';
}

function num(v: unknown, d = 0): number {
	return typeof v === 'number' && !isNaN(v) ? v : d;
}

function normalizeTask(raw: Record<string, unknown>): TickTickTask {
	const itemsRaw = Array.isArray(raw['items']) ? (raw['items'] as Array<Record<string, unknown>>) : [];
	const repeat = raw['repeatFlag'];
	return {
		id: str(raw['id']),
		title: str(raw['title']),
		content: typeof raw['content'] === 'string' ? raw['content'] : undefined,
		dueDate: typeof raw['dueDate'] === 'string' ? raw['dueDate'] : undefined,
		startDate: typeof raw['startDate'] === 'string' ? raw['startDate'] : undefined,
		priority: num(raw['priority'], 0),
		status: num(raw['status'], 0),
		projectId: typeof raw['projectId'] === 'string' ? raw['projectId'] : undefined,
		columnId: typeof raw['columnId'] === 'string' ? raw['columnId'] : undefined,
		tags: Array.isArray(raw['tags']) ? (raw['tags'] as Array<unknown>).map(str) : undefined,
		repeatFlag: typeof repeat === 'string' ? repeat : null,
		progress: typeof raw['progress'] === 'number' ? raw['progress'] : undefined,
		sortOrder: typeof raw['sortOrder'] === 'number' ? raw['sortOrder'] : undefined,
		completedTime: typeof raw['completedTime'] === 'string' ? raw['completedTime'] : undefined,
		items: itemsRaw
			.filter(isRecord)
			.map((it) => ({ id: str(it['id']), title: str(it['title']), status: num(it['status'], 0) })),
	};
}

/** Current time in TickTick format: yyyy-MM-dd'T'HH:mm:ss+HHMM. */
function tickDateNow(): string {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	const off = -d.getTimezoneOffset();
	const sign = off >= 0 ? '+' : '-';
	const abs = Math.abs(off);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
	return !!v && typeof v === 'object' && !Array.isArray(v);
}
