// Temporary implementation stage; removed before final review.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
const put = (path, text) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text.trimStart(), 'utf8'); };
put('src/view/contracts/workbench.ts', String.raw`
/** Rendering and navigation contracts; no Plugin, Vault, PTY or service locator. */
export const WORKBENCH_FEATURES = ['dashboard', 'terminal', 'browser', 'contacts', 'automations', 'notifications', 'habit', 'expense'] as const;
export type WorkbenchFeature = typeof WORKBENCH_FEATURES[number];
export interface WorkbenchTarget {
	feature: WorkbenchFeature;
	section?: string;
	resourceId?: string;
	focusId?: string;
}
export interface FeatureAvailability {
	enabled: boolean;
	supported: boolean;
	ready: boolean;
	reason?: string;
}
export interface NavigationItem {
	id: string;
	labelKey: string;
	icon: string;
	target?: WorkbenchTarget;
	children?: readonly NavigationItem[];
	badge?: number;
}
export interface WorkbenchPage {
	/** May change the selected object, but must not implicitly start a session. */
	navigate(target: WorkbenchTarget, signal: AbortSignal): Promise<void>;
	setVisible(visible: boolean): void;
	getState(): Record<string, unknown>;
	setState(state: Record<string, unknown>): Promise<void>;
	/** Releases UI; business shutdown belongs to the owning module. */
	dispose(): Promise<void>;
}
export interface WorkbenchStatus {
	id: string;
	kind: 'error' | 'running' | 'unread' | 'info';
	label: string;
	target: WorkbenchTarget;
}
`);
put('src/view/workbench/view-type.ts', "export const WORKBENCH_VIEW_TYPE = 'nand-workbench-view';\n");
put('src/view/workbench/navigation-state.ts', String.raw`
import { WORKBENCH_FEATURES, type WorkbenchFeature, type WorkbenchTarget } from '../contracts/workbench';

export interface WorkbenchState {
	target: WorkbenchTarget;
	sidebarWidth: number;
	sidebarOpen: boolean;
	expanded: string[];
}
const sections: Record<WorkbenchFeature, readonly string[]> = {
	dashboard: [], terminal: ['running', 'history', 'usage'], browser: [],
	contacts: ['person', 'company'], automations: ['tasks', 'runs'],
	notifications: [], habit: [], expense: [],
};
const safeText = (value: unknown, max: number): string | undefined =>
	typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f]/.test(value) ? value : undefined;
export function normalizeTarget(raw: unknown): WorkbenchTarget {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { feature: 'dashboard' };
	const value = raw as Record<string, unknown>;
	if (!WORKBENCH_FEATURES.some((feature) => feature === value.feature)) return { feature: 'dashboard' };
	const feature = value.feature as WorkbenchFeature;
	const target: WorkbenchTarget = { feature };
	if (typeof value.section === 'string' && sections[feature].includes(value.section)) target.section = value.section;
	const resourceId = safeText(value.resourceId, 2048), focusId = safeText(value.focusId, 256);
	if (resourceId) target.resourceId = resourceId;
	if (focusId) target.focusId = focusId;
	return target;
}
export function targetKey(target: WorkbenchTarget): string {
	return JSON.stringify([target.feature, target.section ?? '', target.resourceId ?? '', target.focusId ?? '']);
}
export function navigationWidth(raw: unknown): number {
	return typeof raw === 'number' && Number.isFinite(raw) ? Math.max(208, Math.min(280, raw)) : 232;
}
export function normalizeWorkbenchState(raw: unknown): WorkbenchState {
	const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
	return {
		target: normalizeTarget(value.target),
		sidebarWidth: navigationWidth(value.sidebarWidth),
		sidebarOpen: value.sidebarOpen !== false,
		expanded: Array.isArray(value.expanded) ? [...new Set(value.expanded.filter((id): id is string => typeof id === 'string' && WORKBENCH_FEATURES.some((feature) => feature === id)))] : [],
	};
}
`);
put('src/view/workbench/navigation-transition.ts', String.raw`
import { targetKey } from './navigation-state';
import type { WorkbenchTarget } from '../contracts/workbench';

/** Instance-local latest-wins navigation; no window/view references are retained globally. */
export class NavigationTransition {
	private generation = 0;
	private controller?: AbortController;
	private current?: string;
	private pending?: { key: string; promise: Promise<boolean> };
	private disposed = false;

	navigate(target: WorkbenchTarget, prepare: (signal: AbortSignal) => Promise<void>, commit: () => void): Promise<boolean> {
		if (this.disposed) return Promise.resolve(false);
		const key = targetKey(target);
		if (this.pending?.key === key) return this.pending.promise;
		// A -> B (pending) -> A must cancel B, even though A is still visible.
		this.controller?.abort();
		const generation = ++this.generation;
		if (this.current === key) {
			this.pending = undefined;
			return Promise.resolve(true);
		}
		const controller = new AbortController();
		this.controller = controller;
		const promise = Promise.resolve().then(() => prepare(controller.signal)).then(() => {
			if (this.disposed || controller.signal.aborted || generation !== this.generation) return false;
			commit();
			this.current = key;
			return true;
		}, (error: unknown) => {
			if (this.disposed || controller.signal.aborted || generation !== this.generation) return false;
			throw error;
		}).finally(() => {
			if (this.pending?.promise === promise) this.pending = undefined;
		});
		this.pending = { key, promise };
		return promise;
	}

	invalidate(): void {
		this.controller?.abort();
		this.generation++;
		this.current = undefined;
		this.pending = undefined;
	}

	dispose(): void {
		this.disposed = true;
		this.invalidate();
	}
}
`);
put('src/view/workbench/status-policy.ts', String.raw`
import type { WorkbenchStatus } from '../contracts/workbench';
const priorities: Record<WorkbenchStatus['kind'], number> = { error: 0, running: 1, unread: 2, info: 3 };
/** A status bar is not a launcher. Idle and informational entries are opt-in. */
export function visibleStatuses(statuses: readonly WorkbenchStatus[], showInfo = false, limit = 3): WorkbenchStatus[] {
	const unique = new Map<string, WorkbenchStatus>();
	for (const item of statuses) {
		if (!item.id || !item.label || (item.kind === 'info' && !showInfo)) continue;
		const old = unique.get(item.id);
		if (!old || priorities[item.kind] < priorities[old.kind]) unique.set(item.id, item);
	}
	return [...unique.values()].sort((a, b) => priorities[a.kind] - priorities[b.kind] || a.id.localeCompare(b.id)).slice(0, Math.max(0, Math.floor(limit)));
}
`);
put('src/view/workbench/navigation-state.test.ts', String.raw`
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeTarget, normalizeWorkbenchState, targetKey, navigationWidth } from './navigation-state';
import { NavigationTransition } from './navigation-transition';
import { visibleStatuses } from './status-policy';

const deferred = () => { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; };
test('home is the dashboard, not a second product or settings page', () => {
	for (const value of [null, [], {}, { feature: 'home' }, { feature: 'settings' }]) assert.deepEqual(normalizeTarget(value), { feature: 'dashboard' });
});
test('restoration accepts known sections and excludes unrelated or secret fields', () => {
	assert.deepEqual(normalizeTarget({ feature: 'contacts', section: 'person', resourceId: 'stable-id', token: 'secret', dom: {} }), { feature: 'contacts', section: 'person', resourceId: 'stable-id' });
	assert.deepEqual(normalizeTarget({ feature: 'browser', section: 'history', resourceId: '\u0000bad' }), { feature: 'browser' });
});
test('width and expansion normalization are bounded and deterministic', () => {
	assert.equal(navigationWidth(NaN), 232); assert.equal(navigationWidth(100), 208); assert.equal(navigationWidth(500), 280);
	assert.deepEqual(normalizeWorkbenchState({ expanded: ['contacts', 'contacts', 'unknown'], sidebarOpen: false }).expanded, ['contacts']);
});
test('resource identities cannot collide through separators', () => {
	assert.notEqual(targetKey({ feature: 'contacts', resourceId: 'a:b' }), targetKey({ feature: 'contacts', section: 'a', resourceId: 'b' }));
});
test('latest navigation wins and late completion cannot change selection', async () => {
	const navigation = new NavigationTransition(), first = deferred(); const commits: string[] = [];
	const a = navigation.navigate({ feature: 'dashboard' }, () => first.promise, () => commits.push('a'));
	await navigation.navigate({ feature: 'contacts' }, async () => {}, () => commits.push('b'));
	first.resolve(); assert.equal(await a, false); assert.deepEqual(commits, ['b']);
});
test('repeated targets do not remount or repeat side effects', async () => {
	const navigation = new NavigationTransition(), ready = deferred(); let calls = 0;
	const prepare = () => { calls++; return ready.promise; };
	const a = navigation.navigate({ feature: 'dashboard' }, prepare, () => {});
	const b = navigation.navigate({ feature: 'dashboard' }, prepare, () => {});
	assert.equal(a, b); ready.resolve(); await a;
	await navigation.navigate({ feature: 'dashboard' }, prepare, () => {}); assert.equal(calls, 1);
});
test('returning to the visible page cancels a pending different page', async () => {
	const navigation = new NavigationTransition(), slow = deferred(); const commits: string[] = [];
	await navigation.navigate({ feature: 'dashboard' }, async () => {}, () => commits.push('home'));
	const pending = navigation.navigate({ feature: 'contacts' }, () => slow.promise, () => commits.push('contacts'));
	await navigation.navigate({ feature: 'dashboard' }, async () => {}, () => commits.push('home-again'));
	slow.resolve(); assert.equal(await pending, false); assert.deepEqual(commits, ['home']);
});
test('dispose and module invalidation cancel late requests', async () => {
	for (const action of ['dispose', 'invalidate'] as const) {
		const navigation = new NavigationTransition(), slow = deferred(); let committed = false;
		const pending = navigation.navigate({ feature: 'browser' }, () => slow.promise, () => { committed = true; });
		navigation[action](); slow.resolve(); assert.equal(await pending, false); assert.equal(committed, false);
	}
});
test('genuine failures remain failures and permit retry', async () => {
	const navigation = new NavigationTransition();
	await assert.rejects(navigation.navigate({ feature: 'dashboard' }, async () => { throw new Error('save failed'); }, () => {}), /save failed/);
	assert.equal(await navigation.navigate({ feature: 'dashboard' }, async () => {}, () => {}), true);
});
test('status is empty at idle, deduplicated and prioritizes errors', () => {
	const target = { feature: 'terminal' as const };
	assert.deepEqual(visibleStatuses([]), []);
	assert.deepEqual(visibleStatuses([{ id: 'ok', kind: 'info', label: 'Ready', target }]), []);
	const result = visibleStatuses([{ id: 'run', kind: 'running', label: 'Running', target }, { id: 'error', kind: 'error', label: 'Failed', target }, { id: 'run', kind: 'running', label: 'Running', target }]);
	assert.deepEqual(result.map((item) => item.id), ['error', 'run']);
});
`);
const packagePath = 'package.json';
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
packageJson.scripts['test:workbench-navigation'] = 'node --experimental-strip-types --import ./scripts/register-ts-hooks.mjs --test src/view/workbench/navigation-state.test.ts';
writeFileSync(packagePath, JSON.stringify(packageJson, null, '\t') + '\n');
put('speculo/.speculo/specdev/changes/2026-10-05-unified-workbench/spec.md', String.raw`
# NAND 统一工作台实施

状态：实施中，未验收。基线：c8230ad07f0110583ea3cfe92496e2b84f65be2c。

依据：用户批准的《NAND 统一工作台与前端结构重构实施计划 V2》（2026-10-05）。一个默认入口；首页复用现有看板；工作台内部导航和同页切换；按需状态栏。保留六个既有视图类型、命令 ID、Markdown、设备状态、保存冲突和原生窗口语义。

工作台承载器不得嵌套 ItemView，不伪造 WorkspaceLeaf，不将浏览器或终端 DOM 跨窗口移动。导航不启动会话；业务生命周期不由页面显隐管理。原生高级打开保持显式操作。

## 阶段

| 阶段 | 范围 | 当前状态 |
|---|---|---|
| P0 | 源码基线、职责、回归边界 | 已核对源码，原生基线未重跑 |
| P1 | 单一 Ribbon、设置分离、命令接线 | 待实施 |
| P2 | 页面壳、首页、档案、自动化和通知 | 导航/生命周期基础实现中 |
| P3 | Agent、浏览器、资源定位、多窗口 | 待实施 |
| P4 | 按需状态与上下文 | 待实施 |
| P5 | 习惯/记账等领域独立增强 | 待实施，不能当作核心导航的空页面 |
| P6 | 样式作者组织、架构守卫、收尾 | 待实施 |
| P7 | 构建、完整测试、真实宿主验收 | 待执行 |

历史 PR #123 的证据不等于本分支验证结果。移动端、最低版本、真实 CLI、磁盘规模、输入法和长期并发仍按原有待验收范围处理。此改动不发布版本，不自动关闭既有 Issue。
`);
