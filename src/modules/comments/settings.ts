import { domainSettings } from '../../shared/settings/schema';

/** Settings namespace `comments`. Comment bodies never live here (they are sidecars under `.nand/editor/`). */
export interface CommentsSettings {
	sidebarWidth?: number;
	/** Highlights in source, live preview and reading view. */
	highlightEnabled: boolean;
	/** The selection popover. The add-comment command works either way. */
	popoverEnabled: boolean;
}

export const DEFAULT_COMMENTS_SETTINGS: CommentsSettings = { highlightEnabled: true, popoverEnabled: true };

export function normalizeCommentsSettings(raw: unknown): CommentsSettings {
	const base: CommentsSettings = { ...DEFAULT_COMMENTS_SETTINGS };
	if (typeof raw !== 'object' || raw === null) return base;
	const rec = raw as Record<string, unknown>;
	if (typeof rec['sidebarWidth'] === 'number' && Number.isFinite(rec['sidebarWidth'])) base.sidebarWidth = rec['sidebarWidth'];
	if (typeof rec['highlightEnabled'] === 'boolean') base.highlightEnabled = rec['highlightEnabled'];
	if (typeof rec['popoverEnabled'] === 'boolean') base.popoverEnabled = rec['popoverEnabled'];
	return base;
}

export const commentsSettings = domainSettings<CommentsSettings>({
	defaults: () => ({ ...DEFAULT_COMMENTS_SETTINGS }),
	normalize: normalizeCommentsSettings,
});
