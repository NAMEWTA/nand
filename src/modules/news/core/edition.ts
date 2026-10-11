// Daily rules adapted from KKKKhazix/AIHOT c547b669acc7f64720cd82024e502446ee1ef88d (MIT), reports/edition.ts.
import type { NewsAnalysis, NewsEdition, NewsEditionEntry, NewsEvents, NewsMaterial, NewsSource } from './model';
import { chooseRepresentative, representativePriority } from './representative';
import { participantKey, type HeatFact } from './heat';
import { resolveStory } from './grouping';
import { scoreSelection, type NewsThresholds, type NewsWeights } from './scoring';
import { DEFAULT_EDITION_RULES, type EditionRules } from './editorial-rules';

const DAY = 86_400_000;
export function localDay(now: number): { date: string; startAt: number; endAt: number; timeZone: string; offsetMinutes: number } {
	const start = new Date(now); start.setHours(0, 0, 0, 0);
	const end = new Date(start); end.setDate(end.getDate() + 1);
	return { date: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`,
		startAt: +start, endAt: +end, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, offsetMinutes: start.getTimezoneOffset() };
}
export function editionImportance(score: number | undefined, participants: number, official: boolean, followUp: boolean): number {
	return (score ?? 50) + 5 * Math.log2(1 + participants) + (official ? 5 : 0) - (followUp ? 6 : 0);
}
export function editionMemory(editions: readonly NewsEdition[], now: number, days = DEFAULT_EDITION_RULES.memoryDays): NewsEdition[] {
	const day = localDay(now), from = new Date(day.startAt); from.setDate(from.getDate() - days);
	const first = localDay(+from).date;
	return editions.filter(item => item.date >= first && item.date < day.date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, days);
}
interface EditionInput {
	materials: readonly NewsMaterial[]; analyses: readonly NewsAnalysis[]; events: NewsEvents;
	sources: readonly NewsSource[]; evidence: readonly HeatFact[]; previous: readonly NewsEdition[];
	weights?: NewsWeights; thresholds?: NewsThresholds;
	rules?: EditionRules;
}
interface Candidate extends NewsEditionEntry { authority: number; commentary: boolean; mentions: string[]; }

/** A local natural day, read from existing analysis. Calling this function never publishes an issue. */
export function buildDailyEdition(input: EditionInput, now = Date.now()): NewsEdition {
	const day = localDay(now), cutoff = Math.min(now, day.endAt - 1);
	const { materials, analyses, events, sources } = input;
	const rules = input.rules ?? DEFAULT_EDITION_RULES;
	const materialById = new Map(materials.map(item => [item.id, item]));
	const sourceById = new Map(sources.map(item => [item.id, item]));
	const analysisById = new Map(analyses.filter(item => { const material = materialById.get(item.materialId); return material?.revision === item.revision && material.contentHash === item.contentHash; }).map(item => [item.materialId, item]));
	const occurrenceByMaterial = new Map(events.occurrences.flatMap(item => item.materialIds.map(id => [id, item] as const)));
	const remembered = new Set<string>(), previous = new Map<string, string>();
	for (const edition of editionMemory(input.previous, now, rules.memoryDays)) for (const entry of [...edition.main, ...edition.flashes]) {
		for (const id of entry.occurrenceIds) remembered.add(id);
		const story = entry.storyId && resolveStory(events.stories, entry.storyId);
		if (story && !previous.has(story.id)) previous.set(story.id, edition.date);
		for (const id of [entry.materialId, ...entry.relatedIds]) {
			remembered.add(`m:${id}`);
			const current = occurrenceByMaterial.get(id);
			if (current) { remembered.add(current.id); if (!previous.has(current.storyId)) previous.set(current.storyId, edition.date); }
		}
	}
	const readable = (item: NewsMaterial): boolean => {
		const a = analysisById.get(item.id), source = sourceById.get(item.sourceId);
		return !item.withdrawn && !item.backfillReason && item.publishedAt !== undefined && item.publishedAt <= cutoff
			&& item.discoveredAt <= cutoff && source?.participation === 'editorial' && a?.accepted === true;
	};
	// Arrival and analysis release decide the issue. Already cited facts never roll forward on reanalysis.
	const inDay = (item: NewsMaterial): boolean => {
		const at = Math.max(item.publishedAt!, item.discoveredAt, analysisById.get(item.id)!.createdAt);
		return at >= day.startAt && at <= cutoff && Math.max(item.publishedAt!, item.discoveredAt) >= day.startAt - DAY;
	};
	const priority = (item: NewsMaterial): number => representativePriority(sourceById.get(item.sourceId), analysisById.get(item.id)?.frame?.subject);
	const facts = events.occurrences.flatMap(occurrence => {
		if (remembered.has(occurrence.id)) return [];
		const reports = occurrence.materialIds.flatMap(id => materialById.get(id) ?? []).filter(item => readable(item) && analysisById.get(item.id)?.groupConfirmed && !remembered.has(`m:${item.id}`));
		const selected = reports.filter(item => inDay(item) && analysisById.get(item.id)?.target === 'featured');
		const signals = occurrence.materialIds.flatMap(id => materialById.get(id) ?? []).filter(item => !item.withdrawn && item.publishedAt !== undefined && item.publishedAt <= cutoff && analysisById.get(item.id)?.groupConfirmed);
		const participants = new Set(signals.flatMap(item => { const source = sourceById.get(item.sourceId); return source ? participantKey(source, item.author) ?? [] : []; }));
		const fillIn = !reports.some(item => analysisById.get(item.id)?.target === 'featured') && reports.some(inDay) && reports.some(item => priority(item) < 3)
			&& participants.size >= 3 && Math.min(...signals.map(item => item.publishedAt!)) >= day.startAt - DAY;
		const rows = selected.length ? selected : fillIn ? reports : [];
		if (!rows.length) return [];
		return [{ occurrence, rows, selected: selected.length > 0, sourceIds: [...new Set(reports.map(item => item.sourceId))], at: Math.min(...rows.map(item => item.publishedAt!)) }];
	});
	const byStory = new Map<string, typeof facts>();
	for (const fact of facts) { const rows = byStory.get(fact.occurrence.storyId) ?? []; rows.push(fact); byStory.set(fact.occurrence.storyId, rows); }
	const candidates: Candidate[] = [];
	for (const [storyId, rows] of byStory) {
		const story = events.stories.find(item => item.id === storyId); if (!story) continue;
		const ordered = [...rows].sort((a, b) => b.sourceIds.length - a.sourceIds.length || a.at - b.at || a.occurrence.id.localeCompare(b.occurrence.id));
		const reps = ordered.map(fact => chooseRepresentative({ ...story, materialIds: fact.rows.map(item => item.id) }, fact.rows, sources, [], analyses)!);
		const main = materialById.get(reps[0]!)!, analysis = analysisById.get(main.id)!;
		const sourceIds = [...new Set(rows.flatMap(item => item.sourceIds))];
		const participants = new Set(input.evidence.filter(item => item.eventId === storyId && !item.withdrawn && item.at >= day.startAt && item.at <= cutoff).map(item => item.participantId)).size;
		const official = rows.some(fact => fact.rows.some(item => priority(item) < 3));
		const followUp = previous.get(storyId);
		const score = Math.max(analysis.score, ...rows.filter(fact => fact.selected).flatMap(fact => fact.rows.map(item => analysisById.get(item.id)!.score)));
		candidates.push({ materialId: main.id, storyId, occurrenceIds: ordered.map(item => item.occurrence.id), relatedIds: reps.slice(1), sourceIds, participants, official,
			importance: editionImportance(score, participants, official, !!followUp), ...(followUp ? { followUp } : {}), ...(rows.every(item => !item.selected) ? { fillIn: true } : {}),
			authority: priority(main), commentary: ['opinion_analysis', 'tutorial_explainer'].includes(analysis.itemType), mentions: [] });
	}
	// A composite never bridges facts. Qualifying roundups can be listed under an event in this issue.
	for (const material of materials) {
		const a = analysisById.get(material.id), source = sourceById.get(material.sourceId);
		if (!a || a.scope !== 'composite' || !readable(material) || !inDay(material) || remembered.has(`m:${material.id}`)
			|| !scoreSelection(a.samples, source?.tier ?? 'unlisted', input.weights, input.thresholds).eligible) continue;
		const mentions = events.mentions.filter(item => item.materialId === material.id).flatMap(item => events.occurrences.find(occurrence => occurrence.id === item.occurrenceId)?.storyId ?? []);
		candidates.push({ materialId: material.id, occurrenceIds: [], relatedIds: [], sourceIds: [material.sourceId], participants: 1, official: false,
			importance: editionImportance(a.score, 1, false, false), authority: 3, commentary: true, mentions });
	}
	candidates.sort((a, b) => b.importance - a.importance || a.materialId.localeCompare(b.materialId));
	const folded = new Set<Candidate>();
	for (const roundup of candidates.filter(item => item.mentions.length)) {
		const host = candidates.find(item => item.storyId && roundup.mentions.includes(item.storyId));
		if (!host) continue;
		host.relatedIds.push(roundup.materialId); host.sourceIds = [...new Set([...host.sourceIds, ...roundup.sourceIds])]; folded.add(roundup);
	}
	const live = candidates.filter(item => !folded.has(item));
	const earned = (item: Candidate): boolean => !item.followUp || item.authority < 3 && !item.commentary || item.sourceIds.length >= 4;
	const allFollowUps = !live.some(earned), main: NewsEditionEntry[] = [], flashes: NewsEditionEntry[] = [], counts = new Map<string, number>();
	for (const item of live) {
		const { authority: _authority, commentary: _commentary, mentions: _mentions, ...entry } = item;
		const sourceId = materialById.get(item.materialId)!.sourceId, count = counts.get(sourceId) ?? 0;
		if (main.length < rules.mainLimit && count < rules.perSourceLimit && (allFollowUps || earned(item))) { main.push(entry); counts.set(sourceId, count + 1); }
		else if (flashes.length < rules.flashLimit) flashes.push(entry);
	}
	return { id: `edition-${day.date}`, ...day, main, flashes, materialIds: [...main, ...flashes].map(item => item.materialId),
		storyIds: [...new Set([...main, ...flashes].flatMap(item => item.storyId ?? []))], generatedAt: now };
}

