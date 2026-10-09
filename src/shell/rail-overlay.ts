import type { ShellLayout } from './layout';

export type { ShellLayout };

/**
 * One rail selection navigates once and, on a medium overlay, closes it.
 * A toggle still opens or closes the panel. Narrow keeps the overlay open for the destination list.
 */
export function overlayAfterRail(layout: ShellLayout, inline: boolean, action: 'toggled' | 'navigated', overlay: boolean): boolean | 'toggle' {
	if (action === 'toggled') return 'toggle';
	if (inline) return overlay;
	if (layout === 'medium') return false;
	if (layout === 'narrow') return true;
	return overlay;
}
