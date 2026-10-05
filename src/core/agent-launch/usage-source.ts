import type { UsageSnapshot } from './types';

export interface UsageState {
 readonly snapshots: readonly UsageSnapshot[];
 readonly refreshing: boolean;
 readonly error?: string;
}
export interface UsageSourceOptions {
 read: () => Promise<UsageSnapshot[]>;
 active: () => boolean;
 delay: (consecutiveFailures: number) => number;
 now: () => number;
 schedule: (callback: () => void, delay: number) => number;
 cancel: (timer: number) => void;
}
/** One demand-driven reader for a module, shared by its status and every page. */
export class AgentUsageSource {
 private readonly options: UsageSourceOptions;
 private state: UsageState = { snapshots: [], refreshing: false };
 private readonly listeners = new Set<() => void>();
 private consumers = 0;
 private pinned = false;
 private stopped = false;
 private timer?: number;
 private inflight?: Promise<readonly UsageSnapshot[]>;
 private nextAt = 0;
 private failures = 0;
 constructor(options: UsageSourceOptions) { this.options = options; }
 getState(): UsageState { return this.state; }
 get hasDemand(): boolean { return this.pinned || this.consumers > 0; }
 subscribe(listener: () => void): () => void {
  if (this.stopped) return () => {};
  this.listeners.add(listener);
  return () => { this.listeners.delete(listener); };
 }
 retain(): () => void {
  if (this.stopped) return () => {};
  this.consumers++; this.schedule();
  let released = false;
  return () => {
   if (released) return; released = true;
   this.consumers = Math.max(0, this.consumers - 1);
   if (!this.hasDemand) this.cancelTimer();
  };
 }
 setPinned(pinned: boolean): void {
  this.pinned = pinned;
  if (this.hasDemand) this.schedule(); else this.cancelTimer();
 }
 invalidate(): void { this.nextAt = 0; this.cancelTimer(); this.schedule(); }
 refresh(force = false): Promise<readonly UsageSnapshot[]> {
  if (this.stopped || !this.options.active()) return Promise.resolve(this.state.snapshots);
  if (this.inflight) return this.inflight;
  if (!force && (!this.hasDemand || this.options.now() < this.nextAt)) { this.schedule(); return Promise.resolve(this.state.snapshots); }
  this.cancelTimer();
  const pending = Promise.resolve().then(() => this.options.read()).then((snapshots) => {
   if (this.stopped || !this.options.active()) return this.state.snapshots;
   this.failures = snapshots.some((snapshot) => snapshot.failed) ? this.failures + 1 : 0;
   this.state = { snapshots, refreshing: true };
   return snapshots;
  }, (error: unknown) => {
   if (this.stopped || !this.options.active()) return this.state.snapshots;
   this.failures++;
   this.state = { snapshots: this.state.snapshots.map((snapshot) => ({ ...snapshot, stale: true })), refreshing: true, error: error instanceof Error ? error.message : String(error) };
   throw error;
  }).finally(() => {
   if (this.inflight !== pending) return;
   this.inflight = undefined;
   this.nextAt = this.options.now() + Math.max(1000, this.options.delay(this.failures));
   this.state = { ...this.state, refreshing: false };
   if (!this.stopped) { this.emit(); this.schedule(); }
  });
  this.inflight = pending;
  this.state = { ...this.state, refreshing: true };
  this.emit();
  return pending;
 }
 dispose(): void {
  if (this.stopped) return;
  this.stopped = true; this.cancelTimer(); this.listeners.clear();
  this.consumers = 0; this.pinned = false;
 }
 private emit(): void { for (const listener of this.listeners) listener(); }
 private cancelTimer(): void {
  if (this.timer !== undefined) this.options.cancel(this.timer);
  this.timer = undefined;
 }
 private schedule(): void {
  if (this.stopped || this.inflight || this.timer !== undefined || !this.hasDemand || !this.options.active()) return;
  this.timer = this.options.schedule(() => {
   this.timer = undefined;
   void this.refresh().catch(() => { /* The state exposes the failure; polling obeys backoff. */ });
  }, Math.max(0, this.nextAt - this.options.now()));
 }
}
