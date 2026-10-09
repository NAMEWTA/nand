/** Minimal text storage used by durable domain stores. */
export interface TextStorage {
	exists(path: string): Promise<boolean>;
	read(path: string): Promise<string>;
	write(path: string, content: string): Promise<void>;
	mkdir(path: string): Promise<void>;
}
