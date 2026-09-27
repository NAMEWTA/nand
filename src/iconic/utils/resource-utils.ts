import LUCIDE_NAMES from '../res/lucide-names.json';

/**
 * 1,736 Lucide icon IDs. Includes 3,581 keywords ("tags") for search filtering.
 * @version 1.21
 * @license ISC
 * @see {@link https://unpkg.com/lucide-static@1.21.0/tags.json}
 */
import LUCIDE_KEYWORDS from '../res/lucide-keywords.json';

/**
 * 1,923 emojis, with alternate encodings / skin tone variants excluded.
 * @version 17.0
 * @license Unicode-3.0
 * @see {@link https://www.unicode.org/Public/17.0.0/emoji/emoji-test.txt}
 *
 * Includes 3,714 keywords ("annotations") from the Unicode CLDR Project.
 * @version 48.2.0
 * @license Unicode-3.0
 * @see {@link https://github.com/unicode-org/cldr-json/blob/main/cldr-json/cldr-annotations-full/annotations/en/annotations.json}
 */
import EMOJIS from '../res/emojis.json';

/**
 * Dynamically imports data for strings, icons, and emojis.
 */
export default class ResourceUtils {
	/**
	 * Get a list of icon IDs (mapped to their names and keywords), and a flat list of their keywords.
	 * @param iconIds The icon IDs supported by this Obsidian client.
	 */
	static getIcons(iconIds: string[]): [icons: Map<string, [string, string[]]>, keywords: Set<string>] {
		const lucideNames = new Map<string, string>(
			(LUCIDE_NAMES as [string, string][]).map(([id, name]) => ['lucide-' + id, name]),
		);
		const lucideKeywords = new Map<string, string[]>(
			(LUCIDE_KEYWORDS as [string, string[]][]).map(([id, keywords]) => ['lucide-' + id, keywords]),
		);
		const allIcons = new Map<string, [string, string[]]>();
		const allKeywords = new Set<string>();

		for (const iconId of iconIds) {
			const name = lucideNames.get(iconId) ?? this.iconIdToName(iconId);
			const keywords = lucideKeywords.get(iconId) ?? [];

			allIcons.set(iconId, [name, keywords.sort()]);
			for (const keyword of keywords) {
				allKeywords.add(keyword);
			}
		}

		const sortedKeywords = new Set(Array.from(allKeywords).sort());
		return [allIcons, sortedKeywords];
	}

	/**
	 * Get a list of emoji glyphs (mapped to their names and keywords), and a flat list of their keywords.
	 */
	static getEmojis(): [emojis: Map<string, [string, string[]]>, keywords: Set<string>] {
		const allEmojis = new Map<string, [string, string[]]>(EMOJIS as [string, [string, string[]]][]);
		const allKeywords = new Set<string>();

		// Find all unique keywords
		for (const [, [, keywords]] of allEmojis) {
			for (const keyword of keywords) {
				allKeywords.add(keyword);
			}
		}

		const sortedKeywords = new Set(Array.from(allKeywords).sort());
		return [allEmojis, sortedKeywords];
	}

	/**
	 * Generate a readable name for an icon ID:
	 * 1) Remove any lucide- prefix
	 * 2) Replace hyphens with spaces
	 * 3) Use sentence case
	 */
	private static iconIdToName(iconId: string): string {
		if (!iconId) return '';
		const replacedName = iconId.replace(/^lucide-/, '').replaceAll('-', ' ');
		const capitalizedName = replacedName[0]?.toUpperCase() + replacedName.slice(1);
		return capitalizedName;
	}
}
