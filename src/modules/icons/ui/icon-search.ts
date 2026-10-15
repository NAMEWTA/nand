import { prepareFuzzySearch } from 'obsidian';
import { EMOJIS, EMOJI_KEYWORDS, ICONS, ICON_KEYWORDS } from '../platform/resources';
export type IconSearchResult = [id: string, name: string, keywords: string[], score: number];
export function searchIcons(
	query: string,
	modes: { iconMode: boolean; emojiMode: boolean; keywordMode: boolean },
): IconSearchResult[] {
	if (!query) return [];
	const queryLower = query.toLowerCase();
	const fuzzySearch = prepareFuzzySearch(query);
	const allIconEntries = [...(modes.iconMode ? ICONS : []), ...(modes.emojiMode ? EMOJIS : [])];
	const allKeywords = new Set<string>([
		...(modes.iconMode ? ICON_KEYWORDS : []),
		...(modes.emojiMode ? EMOJI_KEYWORDS : []),
	]);
	const allKeywordScores = new Map<string, number>();
	const results: IconSearchResult[] = [];

	if (modes.keywordMode) {
		for (const keyword of allKeywords) {
			const score = fuzzySearch(keyword)?.score;
			if (score) allKeywordScores.set(keyword, score);
		}
	}

	for (const [id, [name, keywords]] of allIconEntries) {
		const idLower = id.toLowerCase();
		const nameLower = name.toLowerCase();

		// Check for an exact ID or name match
		if (queryLower === idLower || queryLower === nameLower) {
			results.push([id, name, [], 1]);
			continue;
		}

		// Check for a start-of-name match
		if (nameLower.startsWith(queryLower)) {
			results.push([id, name, [], 0]);
			continue;
		}

		// Check for a fuzzy name match
		const nameScore = fuzzySearch(name)?.score;
		if (!modes.keywordMode) {
			if (nameScore) results.push([id, name, [], nameScore]);
			continue;
		}

		// Check for a fuzzy keyword match
		const keywordScores: [string, number][] = [];
		for (const keyword of keywords) {
			const score = allKeywordScores.get(keyword);
			if (score) keywordScores.push([keyword, score]);
		}

		// Sort keywords by score
		keywordScores.sort(([, scoreA], [, scoreB]) => (scoreA < scoreB ? 1 : -1));
		const topKeywordScore = keywordScores[0]?.[1];

		// Skip icon if nothing matched
		if (nameScore === undefined && topKeywordScore === undefined) continue;

		// Use the best possible score
		const topKeywords = keywordScores.map(([keyword]) => keyword);
		const topScore = Math.max(nameScore ?? -Infinity, topKeywordScore ?? -Infinity);
		results.push([id, name, topKeywords, topScore]);
	}

	// Sort results by score
	results.sort(([, nameA, , scoreA], [, nameB, , scoreB]) => {
		if (scoreA === scoreB) {
			return nameA.localeCompare(nameB);
		} else {
			return scoreA < scoreB ? 1 : -1;
		}
	});

	return results;
}
