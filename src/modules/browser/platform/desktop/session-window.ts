/** Start asynchronous session preparation in the surviving renderer, including
 * callers whose Obsidian popout can close during the operation. */
export function inSessionBroker<T>(broker: Window, work: () => Promise<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		broker.setTimeout(() => {
			try {
				resolve(work());
			} catch (error) {
				reject(error instanceof Error ? error : new Error(String(error)));
			}
		}, 0);
	});
}
