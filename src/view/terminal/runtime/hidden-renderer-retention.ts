/** LRU budget adapted from Orca v1.4.217 terminal-webgl-hidden-retention.ts.
 * MIT, Copyright (c) 2026 Lovecast Inc. NAND retains at most two hidden contexts.
 */
export class HiddenRendererRetention {
	private entries = new Map<object, () => void>();
	private budget: number;
	constructor(budget = 2) { this.budget = budget; }
	retain(owner: object, release: () => void): void {
		this.entries.delete(owner);
		this.entries.set(owner, release);
		while (this.entries.size > this.budget) {
			const oldest = this.entries.entries().next();
			if (oldest.done) break;
			const [oldOwner, releaseOld] = oldest.value;
			this.entries.delete(oldOwner);
			releaseOld();
		}
	}
	release(owner: object): void { this.entries.delete(owner); }
}
