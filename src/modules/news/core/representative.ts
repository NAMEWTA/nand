// Authority order adapted from KKKKhazix/AIHOT c547b669acc7f64720cd82024e502446ee1ef88d (MIT), publication/representative.ts.
import type { NewsAnalysis, NewsMaterial, NewsOccurrence, NewsSource, NewsStory } from './model';
import { reportTime } from './grouping';

const identity = (value: string): string => value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, '');
export function representativePriority(source: NewsSource | undefined, subject?: string): number {
	if (source?.tier === 'T1') return 0;
	const owner = identity(source?.ownerEntityId ?? '');
	const subjects = (subject ?? '').split(/[,，、;；+＋&＆/]/u).map(identity);
	if (!owner || subjects.some(value => !value) || !subjects.includes(owner)) return 3;
	return source?.publisherRole === 'organization' ? 1 : source?.publisherRole === 'person' ? 2 : 3;
}

/** Occurrence breadth precedes authority: a lone early leak cannot displace the covered launch. */
export function chooseRepresentative(story: NewsStory, materials: readonly NewsMaterial[], sources: readonly NewsSource[], occurrences: readonly NewsOccurrence[] = [], analyses: readonly NewsAnalysis[] = []): string | undefined {
	const byId = new Map(materials.map(item => [item.id, item]));
	const members = occurrences.filter(item => item.storyId === story.id);
	const sourceCount = (item: NewsOccurrence): number => new Set(item.materialIds.flatMap(id => byId.get(id)?.sourceId ?? [])).size;
	const occurrence = members.sort((a, b) => sourceCount(b) - sourceCount(a) || a.firstSeenAt - b.firstSeenAt || a.id.localeCompare(b.id))[0];
	const reports = (occurrence?.materialIds ?? story.materialIds).flatMap(id => byId.get(id) ?? []);
	const authority = (item: NewsMaterial): number => representativePriority(sources.find(source => source.id === item.sourceId), occurrence?.frame?.subject ?? analyses.find(analysis => analysis.materialId === item.id)?.frame?.subject);
	const score = (item: NewsMaterial): number => analyses.find(analysis => analysis.materialId === item.id)?.score ?? 0;
	return reports.sort((a, b) => authority(a) - authority(b) || Number(!!b.body?.trim()) - Number(!!a.body?.trim()) || score(b) - score(a) || reportTime(a) - reportTime(b) || a.id.localeCompare(b.id))[0]?.id;
}

