import type { App } from 'obsidian';
import { contentFiles } from '../../../host/obsidian/storage/content-files';
import { privateVaultStorage } from '../../../host/obsidian/storage/private-storage';
import type { TextStorage } from '../../../shared/storage/ports';

/** Apex JSON uses the same atomic content transaction and invalidation stream as managed notes. */
export class RecordStorage implements TextStorage {
	private readonly files;
	private readonly privateStorage;
	constructor(app: App, private readonly path: string) {
		this.files = contentFiles(app);
		this.privateStorage = privateVaultStorage(app);
	}
	exists(path: string): Promise<boolean> { return this.privateStorage.exists(path); }
	read(path: string): Promise<string> { return this.privateStorage.read(path); }
	write(path: string, text: string): Promise<void> { return this.privateStorage.write(path, text); }
	mkdir(path: string): Promise<void> { return this.privateStorage.mkdir(path); }
	updateAtomically(path: string, update: (current: string | null) => string): Promise<string> {
		return this.files.process(path, update);
	}
	subscribeInvalidation(changed: () => void): () => void {
		return this.files.subscribe(event => {
			if (event.path === this.path || event.oldPath === this.path) changed();
		});
	}
}
