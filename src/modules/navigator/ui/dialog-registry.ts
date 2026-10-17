// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.

/** A dialog the navigator opened: all it needs to be closable from outside. */
export interface TrackedDialog {
	close: () => void;
}

/**
 * Dialogs live in their own React roots outside the panel, so unmounting the panel does not close them. The
 * navigator registers every dialog it opens here and closes them all when it stops; a dialog whose module load
 * finishes after that is closed on arrival.
 */
export class DialogRegistry {
	private readonly open = new Set<TrackedDialog>();
	private stopped = false;

	/** Register a dialog; returns the function to call when it closes by itself. */
	track(dialog: TrackedDialog): () => void {
		if (this.stopped) {
			dialog.close();
			return () => undefined;
		}
		this.open.add(dialog);
		return () => { this.open.delete(dialog); };
	}

	get size(): number {
		return this.open.size;
	}

	get isStopped(): boolean {
		return this.stopped;
	}

	/** Close every open dialog and refuse new ones. */
	stop(): void {
		this.stopped = true;
		for (const dialog of [...this.open]) dialog.close();
		this.open.clear();
	}
}
