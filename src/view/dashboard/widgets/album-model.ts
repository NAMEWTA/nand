import { App } from 'obsidian';

export const ALBUM_IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp']);

export const ALBUM_FADE_MS = 600;

/** Photo transition modes. The frame carries a `--<mode>` class and layers
 *  animate between their start state (transition suppressed via --instant)
 *  and the default visible state, mirroring the banner fade house pattern. */
export type AlbumTransition = 'fade' | 'slide-left' | 'slide-right' | 'zoom';

export const ALBUM_TRANSITIONS: AlbumTransition[] = ['fade', 'slide-left', 'slide-right', 'zoom'];

/** Per-mode layer classes: `start` is applied to the incoming layer before
 *  the transition (removed to run it); `out` moves the outgoing layer away
 *  (slide modes only - fade/zoom simply cover it). */
export const TRANSITION_CLASSES: Record<AlbumTransition, { start: string; out?: string }> = {
	fade: { start: 'dashboard-sidebar-album-layer--start-fade' },
	zoom: { start: 'dashboard-sidebar-album-layer--start-zoom' },
	'slide-left': {
		start: 'dashboard-sidebar-album-layer--start-slide-in-right',
		out: 'dashboard-sidebar-album-layer--run-slide-out-left',
	},
	'slide-right': {
		start: 'dashboard-sidebar-album-layer--start-slide-in-left',
		out: 'dashboard-sidebar-album-layer--run-slide-out-right',
	},
};

export function normalizeTransition(value: string | undefined): AlbumTransition {
	return ALBUM_TRANSITIONS.includes(value as AlbumTransition) ? (value as AlbumTransition) : 'fade';
}

export function clampIntervalSec(value: number | undefined): number {
	if (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 600) return 8;
	return Math.round(value);
}

export function normalizeAlbumFolder(folder: string): string {
	return folder.trim().replace(/^\/+|\/+$/g, '');
}

export function basename(path: string): string {
	const idx = path.lastIndexOf('/');
	return idx === -1 ? path : path.slice(idx + 1);
}

/** List the image file paths under `folder` (vault-relative). The prefix match
 *  is inherently recursive; non-recursive keeps only direct children of the
 *  folder itself. Naturally sorted so the slideshow order is stable. */
export function listAlbumImages(app: App, folder: string, recursive: boolean): string[] {
	const normalized = normalizeAlbumFolder(folder);
	if (!normalized) return [];
	const prefix = normalized + '/';
	return app.vault
		.getFiles()
		.filter(
			(f) =>
				!f.path.startsWith('.') &&
				ALBUM_IMAGE_EXTS.has(f.extension) &&
				f.path.startsWith(prefix) &&
				(recursive || f.parent?.path === normalized),
		)
		.map((f) => f.path)
		.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
