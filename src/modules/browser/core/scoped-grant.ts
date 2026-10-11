import type { BrowserPageTarget } from './control';
import { BrowserError } from './model';

/** A grant names concrete guest generations and exact operations, never a current-page fallback. */
export const SCOPED_BROWSER_OPERATIONS = ['snapshot', 'get', 'screenshot', 'tab.switch', 'goto', 'reload', 'back', 'forward', 'stop',
	'click', 'focus', 'fill', 'type', 'select', 'check', 'keypress'] as const;
export type ScopedBrowserOperation = typeof SCOPED_BROWSER_OPERATIONS[number];
export interface ScopedBrowserGrantDefinition {
	id: string;
	taskId: string;
	targets: BrowserPageTarget[];
	operations: ScopedBrowserOperation[];
	expiresAt: number;
	maxOperations: number;
}
export interface ScopedBrowserPermit {
	readonly target: BrowserPageTarget;
	readonly operation: ScopedBrowserOperation;
	/** Checked again inside the native guest queue, immediately before input or focus. */
	admit(): void;
}
export interface ScopedBrowserPort {
	execute(method: string, params: Record<string, unknown>, signal: AbortSignal): Promise<unknown>;
}
export interface ScopedBrowserConnection {
	readonly environment: Readonly<Record<string, string>>;
	dispose(this: void): void;
}
const identity = (target: BrowserPageTarget) => `${target.profileId}:${target.pageId}:${target.generation}`;
const identifier = (value: unknown) => typeof value === 'string' && /^[\w-]{1,100}$/.test(value);

/** Runtime-only authority. Resume invalidates every old permit and requires the caller to observe again. */
export class ScopedBrowserGrant {
	private readonly definition: ScopedBrowserGrantDefinition;
	private readonly targets: Set<string>;
	private epoch = 0;
	private count = 0;
	private state: 'active' | 'paused' | 'revoked' = 'active';
	constructor(definition: ScopedBrowserGrantDefinition, private readonly now: () => number) {
		const createdAt = now();
		if (!definition || !identifier(definition.id) || !identifier(definition.taskId) || !Array.isArray(definition.targets)
			|| !definition.targets.length || definition.targets.length > 16 || definition.targets.some(target => !target
				|| !identifier(target.pageId) || !identifier(target.profileId) || !identifier(target.generation))
			|| new Set(definition.targets.map(target => target.pageId)).size !== definition.targets.length
			|| !Array.isArray(definition.operations) || !definition.operations.length
			|| new Set(definition.operations).size !== definition.operations.length || definition.operations.some(operation => !SCOPED_BROWSER_OPERATIONS.includes(operation))
			|| !Number.isSafeInteger(definition.maxOperations) || definition.maxOperations < 1 || definition.maxOperations > 200
			|| !Number.isFinite(definition.expiresAt) || definition.expiresAt <= createdAt || definition.expiresAt > createdAt + 30 * 60_000)
			throw new BrowserError('browser_scoped_grant_invalid');
		this.definition = structuredClone(definition); this.targets = new Set(definition.targets.map(identity));
	}
	inspect(): ScopedBrowserGrantDefinition & { used: number; epoch: number; state: 'active' | 'paused' | 'revoked' } {
		return { ...structuredClone(this.definition), used: this.count, epoch: this.epoch, state: this.state };
	}
	assertActive(): void {
		if (this.state === 'revoked') throw new BrowserError('browser_scoped_grant_revoked');
		if (this.now() >= this.definition.expiresAt) throw new BrowserError('browser_scoped_grant_expired');
		if (this.state === 'paused') throw new BrowserError('browser_scoped_grant_paused');
	}
	/** Charge once when a permitted request starts, including reads; repeated admission checks are free. */
	reserve(operation: string, target: BrowserPageTarget): ScopedBrowserPermit {
		this.assertActive();
		if (!target || !this.definition.operations.includes(operation as ScopedBrowserOperation) || !this.targets.has(identity(target)))
			throw new BrowserError('browser_scoped_grant_scope');
		if (this.count >= this.definition.maxOperations) throw new BrowserError('browser_scoped_grant_limit');
		this.count++;
		const epoch = this.epoch, frozen = Object.freeze({ ...target });
		return { target: frozen, operation: operation as ScopedBrowserOperation, admit: () => {
			this.assertActive(); if (epoch !== this.epoch) throw new BrowserError('browser_scoped_grant_stale');
		} };
	}
	pause(): void { if (this.state === 'active') { this.state = 'paused'; this.epoch++; } }
	resume(): void {
		if (this.state === 'revoked') throw new BrowserError('browser_scoped_grant_revoked');
		if (this.now() >= this.definition.expiresAt) throw new BrowserError('browser_scoped_grant_expired');
		if (this.state === 'paused') { this.state = 'active'; this.epoch++; }
	}
	revoke(): void { this.state = 'revoked'; this.epoch++; }
}
