// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { TFile, type App } from 'obsidian';
import { imageFromProperty } from '../core/preview';
import type { MetadataTracker } from './metadata-tracker';
import type { PreviewSource, Scheduler } from './preview-store';

/** Obsidian-backed source of note text, frontmatter images and file times for the preview store. */
export function vaultPreviewSource(app: App, tracker: MetadataTracker): PreviewSource {
	const file = (path: string): TFile | null => app.vault.getFileByPath(path);
	return {
		mtime: (path) => file(path)?.stat.mtime,
		isMarkdown: (path) => file(path)?.extension === 'md',
		async readText(path) {
			const target = file(path);
			if (!target) return null;
			try {
				return await app.vault.cachedRead(target);
			} catch {
				return null;
			}
		},
		propertyImage(path, properties) {
			const target = file(path);
			const frontmatter = target ? app.metadataCache.getFileCache(target)?.frontmatter : undefined;
			if (!frontmatter) return undefined;
			for (const property of properties) {
				const link = imageFromProperty(frontmatter[property]);
				if (link) return link;
			}
			return undefined;
		},
		resolveImage(link, fromPath) {
			return app.metadataCache.getFirstLinkpathDest(link, fromPath)?.path ?? null;
		},
		title: (path) => file(path)?.basename ?? '',
		metadataReady(path) {
			const target = file(path);
			return !!target && tracker.current(path, app.metadataCache.getFileCache(target) !== null);
		},
	};
}

/** Timers on `win` and idle callbacks where available, so work yields to input. */
export function windowScheduler(win: Window): Scheduler {
	const idle = (win as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
	return {
		now: () => win.performance.now(),
		yield: () => new Promise<void>((resolve) => {
			if (idle) idle.call(win, () => resolve(), { timeout: 60 });
			else win.setTimeout(resolve, 4);
		}),
		later(callback, ms) {
			const handle = win.setTimeout(callback, ms);
			return () => win.clearTimeout(handle);
		},
	};
}
