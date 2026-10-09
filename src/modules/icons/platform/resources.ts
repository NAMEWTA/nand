import { getIconIds } from 'obsidian';
import ResourceUtils, { loadResourceData } from './utils/resource-utils';

/** Icon IDs → [name, keywords]. Names are available at once; keywords arrive with `loadResources()`. */
export const ICONS = ResourceUtils.getIcons(getIconIds());
export const ICON_KEYWORDS = new Set<string>();
/** Emoji glyphs → [name, keywords]; empty until `loadResources()` resolves. */
export const EMOJIS = new Map<string, [string, string[]]>();
export const EMOJI_KEYWORDS = new Set<string>();

const PICTOGRAPHIC = /^\p{Extended_Pictographic}/u;
/** Whether an icon value is an emoji glyph (works before the emoji data has loaded). */
export function isEmoji(icon: string): boolean {
	return EMOJIS.has(icon) || PICTOGRAPHIC.test(icon);
}

let loading: Promise<void> | undefined;
/** Load keyword and emoji data once; the exported maps and sets are filled in place. */
export function loadResources(): Promise<void> {
	loading ??= loadResourceData().then((data) => {
		for (const keyword of ResourceUtils.addIconKeywords(ICONS, data.lucideKeywords)) ICON_KEYWORDS.add(keyword);
		const [emojis, keywords] = ResourceUtils.getEmojis(data.emojis);
		for (const [glyph, entry] of emojis) EMOJIS.set(glyph, entry);
		for (const keyword of keywords) EMOJI_KEYWORDS.add(keyword);
	});
	return loading;
}
