import { guardedAdapter } from './ui-adapter-guard.mjs';

/** Obsidian loads the scoped Sonner CSS in every window through styles.css.
 * Remove only the injector; retain the package path for license discovery. */
export function adaptSonnerStyles(source) {
	const fn = /function __insertCSS\(code\) \{[\s\S]*?\n\}/g;
	const call = /^__insertCSS\(".*"\);\n/gm;
	if ([...source.matchAll(fn)].length !== 1 || [...source.matchAll(call)].length !== 1) {
		throw new Error('Sonner: expected exactly one CSS injector and call');
	}
	const contents = source.replace(fn, '').replace(call, '');
	if (contents.includes('__insertCSS')) throw new Error('Sonner: unexpected CSS injector reference');
	return contents;
}

export const sonnerStyles = guardedAdapter('sonner-external-styles', {
	'sonner/dist/index.mjs': adaptSonnerStyles,
});
