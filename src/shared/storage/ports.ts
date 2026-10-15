/** Minimal text storage used by durable domain stores. */
export interface TextStorage {
	exists(path: string): Promise<boolean>;
	read(path: string): Promise<string>;
	write(path: string, content: string): Promise<void>;
	/** Atomically transform the latest bytes; null denotes a missing file. */
	updateAtomically?(path: string, update: (current: string | null) => string): Promise<string>;
	mkdir(path: string): Promise<void>;
}
