// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import type { App } from 'obsidian';
import type { IconTarget, ResolvedIcon } from '../../icons/api';
import type { NavContext } from '../core/types';
import type { PreviewStore } from '../platform/preview-store';
import type { NavigatorService } from '../services/navigator';
import type { ProductivityActions } from './actions';

/** What the navigator's React tree needs from its host. */
export interface NavigatorEnv {
	app: App;
	service: NavigatorService;
	previews: PreviewStore;
	isMac: boolean;
	/** Rule-book icon for a target, or an empty result when the icons module is off. */
	resolveIcon: (target: IconTarget) => ResolvedIcon;
	/** Runs when icons change; returns the unsubscribe function. */
	subscribeIcons: (listener: () => void) => () => void;
	/** `src` for an image file of the vault. */
	imageUrl: (path: string) => string;
	openSettings: () => void;
	/** Edit the list appearance overrides of a folder, tag or property. */
	openAppearance: (context: NavContext) => void;
	/** Ask for one line of text; undefined when dismissed. */
	askName: (titleKey: string, value: string) => Promise<string | undefined>;
	/** Notes from templates, periodic notes, merging and tag edits; absent in hosts that only browse. */
	actions?: ProductivityActions;
	copyPath: (path: string) => void;
	report: (error: unknown) => void;
}
