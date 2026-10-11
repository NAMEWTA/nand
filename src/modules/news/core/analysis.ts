import type { NewsAnalysisRow, NewsFactFrame, NewsMaterial } from './model';
import { DEFAULT_VOCABULARY, type NewsVocabulary } from './analysis-policy';
import { ITEM_TYPES, QUALITY_FLAGS, validAxes } from './scoring';
import type { CandidateIds } from './recall';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const member = (value: unknown, choices: readonly string[]): boolean => typeof value === 'string' && choices.includes(value);
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');
const only = (value: object, keys: readonly string[]): boolean => Object.keys(value).every(key => keys.includes(key));
const date = (value: unknown): boolean => value === null || typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

function validFrame(value: unknown, material: NewsMaterial): value is NewsFactFrame {
	if (!record(value)) return false;
	if (!only(value, ['title', 'subject', 'action', 'object', 'occurredAt', 'evidence', 'conditions'])) return false;
	const original = [material.title, material.body, material.summary, material.bodyExcerpt].filter(Boolean).join('\n');
	return text(value.title, 30) && !!value.title.trim() && ['subject', 'action', 'object'].every(key => text(value[key], 300) && value[key].trim())
		&& date(value.occurredAt) && text(value.evidence, 600) && !!value.evidence.trim() && original.includes(value.evidence)
		&& strings(value.conditions) && value.conditions.length <= 4 && value.conditions.every(quote => !!quote.trim() && quote.length <= 400 && original.includes(quote));
}

function validRow(row: Record<string, unknown>, material: NewsMaterial, candidates: ReadonlySet<string>, vocabulary: NewsVocabulary): boolean {
	if (!only(row, ['id', 'relevance', 'itemType', 'axes', 'qualityFlags', 'scope', 'subject', 'frame', 'category', 'tags', 'titleZh', 'summaryZh', 'reason', 'relations'])) return false;
	if (!member(row.relevance, ['PASS', 'BLOCK', 'UNKNOWN']) || !member(row.itemType, ITEM_TYPES) || !validAxes(row.axes)) return false;
	if (!only(row.axes, ['sig', 'nov', 'cred', 'reson', 'act'])) return false;
	if (!strings(row.qualityFlags) || row.qualityFlags.some(flag => !member(flag, QUALITY_FLAGS)) || new Set(row.qualityFlags).size !== row.qualityFlags.length) return false;
	if (!member(row.scope, ['single', 'composite', 'unknown']) || !(row.subject === null || text(row.subject, 300))) return false;
	if (row.scope === 'single' ? !validFrame(row.frame, material) : row.frame !== null) return false;
	if (!member(row.category, vocabulary.categories) || !strings(row.tags) || row.tags.length < 1 || row.tags.length > 6 || row.tags[0] !== row.category || new Set(row.tags).size !== row.tags.length || row.tags.slice(1).some(tag => !member(tag, [...vocabulary.topics, ...vocabulary.entities]) || member(tag, vocabulary.categories))) return false;
	if (!text(row.titleZh, 160) || !text(row.summaryZh, 2000) || !text(row.reason, 500)) return false;
	if (row.qualityFlags.includes('insufficient_event') && (row.summaryZh.trim() || row.reason.trim())) return false;
	if (!Array.isArray(row.relations) || row.relations.length !== candidates.size) return false;
	const seen = new Set<string>();
	for (const relation of row.relations) {
		if (!record(relation) || !only(relation, ['kind', 'targetId', 'confidence']) || !member(relation.kind, ['SAME_OCCURRENCE', 'SAME_STORY', 'UNRELATED', 'ROUNDUP'])) return false;
		if (typeof relation.confidence !== 'number' || !Number.isFinite(relation.confidence) || relation.confidence < 0 || relation.confidence > 1) return false;
		if (typeof relation.targetId !== 'string' || !candidates.has(relation.targetId) || seen.has(relation.targetId)) return false;
		seen.add(relation.targetId);
	}
	return true;
}

export interface ParsedAnalysis { rows: NewsAnalysisRow[]; unknownIds: string[]; missingIds: string[]; invalidIds: string[]; invalidEnvelope: boolean; }
/** Parse one marked JSON object; never salvage a greedy brace match from prose or ANSI. */
export function parseAnalysisJson(answer: string, materials: readonly NewsMaterial[], candidates: CandidateIds = {}, vocabulary = DEFAULT_VOCABULARY): ParsedAnalysis {
	const result: ParsedAnalysis = { rows: [], unknownIds: [], missingIds: materials.map(item => item.id), invalidIds: [], invalidEnvelope: false };
	const match = /^\s*<nand-news-json>\s*([\s\S]*?)\s*<\/nand-news-json>\s*$/.exec(answer);
	let value: unknown;
	try { value = match ? JSON.parse(match[1]!) : undefined; } catch { value = undefined; }
	if (!record(value) || !only(value, ['materials']) || !Array.isArray(value.materials)) return { ...result, invalidEnvelope: true };
	// Batch-local opaque IDs prevent source-prefixed storage IDs from biasing scores.
	const known = new Map(materials.map((item, index) => [`m${index}`, item]));
	const seen = new Set<string>();
	for (const entry of value.materials) {
		if (!record(entry) || typeof entry.id !== 'string') { result.invalidEnvelope = true; continue; }
		const material = known.get(entry.id);
		if (!material) { result.unknownIds.push(entry.id); continue; }
		if (seen.has(entry.id)) {
			result.invalidIds.push(material.id);
			result.rows = result.rows.filter(row => row.id !== material.id);
			continue;
		}
		seen.add(entry.id);
		const aliases = candidates[material.id] ?? {};
		if (!validRow(entry, material, new Set(Object.keys(aliases)), vocabulary)) { result.invalidIds.push(material.id); continue; }
		const row = entry as unknown as NewsAnalysisRow;
		result.rows.push({ ...row, id: material.id, relations: row.relations.map(relation => ({ ...relation, targetId: aliases[relation.targetId]! })) });
	}
	result.missingIds = materials.filter(item => !result.rows.some(row => row.id === item.id)).map(item => item.id);
	return result;
}

