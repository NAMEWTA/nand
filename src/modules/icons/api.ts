// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { serviceKey } from '../../app/contracts/module';

/** What an icon is attached to. `key` is a vault path (file/folder), a tag without `#`, or a property name. */
export interface IconTarget {
	kind: 'file' | 'folder' | 'tag' | 'property';
	key: string;
}

/**
 * The icon and color the rule book gives a target (rules win over per-item icons).
 * `icon` is a Lucide icon id (for `setIcon`) or an emoji; `color` is a CSS color ready for `style.color`.
 */
export interface ResolvedIcon {
	icon: string | null;
	emoji: boolean;
	color: string | null;
}

/** Icon lookup for other modules (service `icons.resolve`), available while the icons module is active. */
export interface IconsService {
	resolve(target: IconTarget): ResolvedIcon;
	/** Runs after any icon, color or rule change; returns the unsubscribe function. */
	subscribe(listener: () => void): () => void;
}

export const ICONS_SERVICE = serviceKey<IconsService>('icons', 'resolve');
