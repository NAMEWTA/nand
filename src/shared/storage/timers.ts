export interface StorageTimers {
	setTimeout(run: () => void, ms: number): number;
	clearTimeout(id: number): void;
}

let current: StorageTimers | undefined;

/** The host hands over its window's timers; until then (unit tests, workers) diagnostics and re-issuing are off. */
export function useStorageTimers(timers: StorageTimers | undefined): void {
	current = timers;
}

export function storageTimers(): StorageTimers | undefined {
	return current;
}
