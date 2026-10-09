import LUCIDE_NAMES from '../../core/res/lucide-names.json';

/** Keyword and emoji data, loaded on first use (they are only needed for picker search and emoji names). */
export interface ResourceData {
	/**
	 * 1,749 Lucide icon IDs with their keywords ("tags") for search filtering.
	 * @version 1.25 @license ISC @see {@link https://unpkg.com/lucide-static@1.25.0/tags.json}
	 */
	lucideKeywords: [string, string[]][];
	/**
	 * 1,923 emojis (alternate encodings and skin tone variants excluded) with 3,714 CLDR keywords.
	 * Emoji 17.0, CLDR 48.2.0. @license Unicode-3.0
	 * @see {@link https://www.unicode.org/Public/17.0.0/emoji/emoji-test.txt}
	 * @see {@link https://github.com/unicode-org/cldr-json/blob/main/cldr-json/cldr-annotations-full/annotations/en/annotations.json}
	 */
	emojis: [string, [string, string[]]][];
}

export async function loadResourceData(): Promise<ResourceData> {
	const [keywords, emojis] = await Promise.all([import('../../core/res/lucide-keywords.json'), import('../../core/res/emojis.json')]);
	return { lucideKeywords: keywords.default as [string, string[]][], emojis: emojis.default as [string, [string, string[]]][] };
}

export default class ResourceUtils {
	/** Icon IDs supported by this Obsidian client, mapped to their names (keywords are filled in by `addIconKeywords`). */
	static getIcons(iconIds: string[]): Map<string, [string, string[]]> {
		const lucideNames = new Map<string, string>((LUCIDE_NAMES as [string, string][]).map(([id, name]) => ['lucide-' + id, name]));
		return new Map(iconIds.map((iconId) => [iconId, [lucideNames.get(iconId) ?? this.iconIdToName(iconId), []]]));
	}

	/** Fill icon keywords in place and return the sorted set of all keywords. */
	static addIconKeywords(icons: Map<string, [string, string[]]>, data: ResourceData['lucideKeywords']): string[] {
		const lucideKeywords = new Map<string, string[]>(data.map(([id, keywords]) => ['lucide-' + id, keywords]));
		const all = new Set<string>();
		for (const [iconId, entry] of icons) {
			const keywords = [...(lucideKeywords.get(iconId) ?? [])].sort();
			entry[1] = keywords;
			for (const keyword of keywords) all.add(keyword);
		}
		return [...all].sort();
	}

	/** Emoji glyphs mapped to their names and keywords, and the sorted set of all keywords. */
	static getEmojis(data: ResourceData['emojis']): [emojis: Map<string, [string, string[]]>, keywords: string[]] {
		const emojis = new Map<string, [string, string[]]>(data);
		const all = new Set<string>();
		for (const [, [, keywords]] of emojis) for (const keyword of keywords) all.add(keyword);
		return [emojis, [...all].sort()];
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
