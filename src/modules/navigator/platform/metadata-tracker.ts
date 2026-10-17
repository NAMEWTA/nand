// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.

/**
 * Which notes have been edited since Obsidian last parsed their metadata. The metadata cache of an edited
 * note still holds the previous version until its `changed` event arrives, so "has a cache entry" is not
 * enough to trust frontmatter values.
 */
export class MetadataTracker {
	private readonly stale = new Map<string, number>();

	constructor(private readonly now: () => number = Date.now, private readonly patience = 5000) {}

	/** The note was modified; its metadata is out of date until `parsed`. */
	modified(path: string): void {
		this.stale.set(path, this.now());
	}

	/** Obsidian finished parsing the note. */
	parsed(path: string): void {
		this.stale.delete(path);
	}

	renamed(oldPath: string, newPath: string): void {
		const since = this.stale.get(oldPath);
		if (since === undefined) return;
		this.stale.delete(oldPath);
		this.stale.set(newPath, since);
	}

	forget(path: string): void {
		this.stale.delete(path);
	}

	/**
	 * True when the metadata cache of `path` reflects the current text. A touch that does not change the content
	 * never produces a `changed` event, so a note is trusted again after `patience` ms.
	 */
	current(path: string, hasCache: boolean): boolean {
		if (!hasCache) return false;
		const since = this.stale.get(path);
		if (since === undefined) return true;
		if (this.now() - since < this.patience) return false;
		this.stale.delete(path);
		return true;
	}
}
