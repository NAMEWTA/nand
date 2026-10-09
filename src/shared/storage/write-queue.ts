export class WriteQueue {
	private tails = new Map<string, Promise<unknown>>();
	run<T>(key: string, task: () => Promise<T>): Promise<T> {
		const result = (this.tails.get(key) ?? Promise.resolve()).then(task, task);
		const tail = result.then(
			() => undefined,
			() => undefined,
		);
		this.tails.set(key, tail);
		void tail.then(() => {
			if (this.tails.get(key) === tail) this.tails.delete(key);
		});
		return result;
	}
	async settled(): Promise<void> {
		await Promise.all(this.tails.values());
	}
}

const storageQueueKey = Symbol.for('nand.storage.write-queue');
/** The native storage object survives plugin reload, so admitted writes keep their ordering. */
export function storageWriteQueue(storage: object): WriteQueue {
	const existing = Reflect.get(storage, storageQueueKey) as WriteQueue | undefined;
	if (existing) return existing;
	const queue = new WriteQueue();
	Object.defineProperty(storage, storageQueueKey, { value: queue, configurable: true });
	return queue;
}
