/** Serial board pointer changes. An aborted request may finish its IO, then must restore the previous board. */
export interface BoardSwitchRequest {
	requested: string;
	current: string;
	signal: AbortSignal;
	exists(path: string): boolean;
	apply(path: string): Promise<void>;
	missing(): Error;
}

const idle = new AbortController().signal;

export async function settleBoardSwitch(input: BoardSwitchRequest): Promise<string> {
	if (input.signal.aborted) return input.current;
	if (!input.requested || input.requested === input.current) return input.current;
	if (!input.exists(input.requested)) throw input.missing();
	try {
		await input.apply(input.requested);
	} catch (error) {
		try { await input.apply(input.current); } catch { /* The original failure stays visible. */ }
		throw error;
	}
	if (input.signal.aborted) {
		await input.apply(input.current);
		return input.current;
	}
	return input.requested;
}

export interface BoardSwitchQueue {
	current(): string;
	assign(path: string): void;
	exists(path: string): boolean;
	reload(): Promise<void>;
	missing(): Error;
	save(): void;
}

/** Failures stay visible to the caller. The queue itself continues so a later correction is not stuck behind a rejected switch. */
export function createBoardSwitchQueue(options: BoardSwitchQueue): (requested: string, signal?: AbortSignal) => Promise<void> {
	let switching: Promise<void> = Promise.resolve();
	return (requested, signal) => {
		const operation = switching.then(async () => {
			const previous = options.current();
			const settled = await settleBoardSwitch({
				requested,
				current: previous,
				signal: signal ?? idle,
				exists: (path) => options.exists(path),
				apply: async (path) => {
					options.assign(path);
					await options.reload();
				},
				missing: () => options.missing(),
			});
			options.assign(settled);
			if (settled !== previous && !signal?.aborted) options.save();
		});
		switching = operation.then(() => {}, () => {});
		return operation;
	};
}
