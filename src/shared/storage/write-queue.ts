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
