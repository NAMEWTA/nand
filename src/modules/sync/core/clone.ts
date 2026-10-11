import type { GitErrorKind } from './errors';

export interface CloneProgress {
	phase: 'receiving' | 'resolving' | 'checkout';
	percent: number;
}

export interface CloneOptions {
	signal: AbortSignal;
	onProgress?: (progress: CloneProgress) => void;
}

export interface CloneResult {
	state: 'cloned' | 'refused' | 'failed' | 'cancelled';
	target: string;
	error?: { kind: GitErrorKind; detail: string };
	/** Files retained after failure or a target that changed during cloning. */
	recoveryPath?: string;
}
