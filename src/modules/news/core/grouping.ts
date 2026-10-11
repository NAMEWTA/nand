// Occurrence/story rules adapted from KKKKhazix/AIHOT c547b669acc7f64720cd82024e502446ee1ef88d (MIT), events/group.ts and relate.ts.
import type { NewsAnalysis, NewsEvents, NewsGroupRecord, NewsMaterial, NewsMergeReview, NewsOccurrence, NewsStory } from './model';

export const emptyEvents = (): NewsEvents => ({ stories: [], occurrences: [], records: [], mentions: [], proposals: [], reviews: [] });
export const reportTime = (item: NewsMaterial): number => item.publishedAt ?? item.discoveredAt;
export function resolveStory(stories: readonly NewsStory[], id: string): NewsStory | undefined {
	return stories.find(story => story.id === id || story.aliases?.includes(id));
}
const sameInput = (record: NewsGroupRecord, analysis: NewsAnalysis): boolean => record.materialId === analysis.materialId && record.revision === analysis.revision && record.contentHash === analysis.contentHash && record.version === analysis.version && record.analyzedAt === analysis.createdAt;

/** Durable memberships change only with an accepted analysis, never with title similarity. */
export function groupMaterials(materials: readonly NewsMaterial[], analyses: readonly NewsAnalysis[] = [], previous: NewsEvents = emptyEvents()): NewsEvents {
	const state: NewsEvents = structuredClone(previous);
	const byId = new Map(materials.map(item => [item.id, item]));
	for (const record of state.records) {
		const material = byId.get(record.materialId);
		if (!material || material.revision !== record.revision || material.contentHash !== record.contentHash) record.confirmed = false;
	}
	const occurrenceOf = (id: string): NewsOccurrence | undefined => state.occurrences.find(item => item.materialIds.includes(id));
	const rootOf = (story: NewsStory): NewsOccurrence | undefined => state.occurrences.find(item => item.id === story.rootOccurrenceId);
	const refresh = (): void => {
		for (const occurrence of state.occurrences) {
			occurrence.materialIds = occurrence.materialIds.filter(id => byId.has(id));
			const reports = occurrence.materialIds.map(id => byId.get(id)!);
			if (reports.length) { occurrence.firstSeenAt = Math.min(...reports.map(reportTime)); occurrence.latestAt = Math.max(...reports.map(reportTime)); }
		}
		state.occurrences = state.occurrences.filter(item => item.materialIds.length);
		for (const story of state.stories) {
			const occurrences = state.occurrences.filter(item => item.storyId === story.id).sort((a, b) => a.firstSeenAt - b.firstSeenAt || a.id.localeCompare(b.id));
			story.occurrenceIds = occurrences.map(item => item.id);
			story.materialIds = occurrences.flatMap(item => item.materialIds);
			story.rootOccurrenceId = occurrences[0]?.id;
			if (occurrences.length) {
				story.firstSeenAt = occurrences[0]!.firstSeenAt;
				story.latestAt = Math.max(...occurrences.map(item => item.latestAt));
				story.title = occurrences[0]!.title ?? byId.get(occurrences[0]!.materialIds[0]!)!.title;
				for (const item of occurrences) item.kind = item.id === story.rootOccurrenceId ? 'report' : 'follow-up';
			}
		}
	};
	const merge = (left: NewsStory, right: NewsStory, kind: NewsMergeReview['kind']): void => {
		const ordered = [left, right].sort((a, b) => a.firstSeenAt - b.firstSeenAt || a.id.localeCompare(b.id));
		const keep = ordered[0]!, remove = ordered[1]!;
		const keepRoot = rootOf(keep), removedRoot = rootOf(remove);
		if (kind === 'SAME_OCCURRENCE' && keepRoot && removedRoot) {
			keepRoot.materialIds.push(...removedRoot.materialIds);
			for (const mention of state.mentions) if (mention.occurrenceId === removedRoot.id) mention.occurrenceId = keepRoot.id;
			state.occurrences = state.occurrences.filter(item => item !== removedRoot);
		}
		for (const item of state.occurrences) if (item.storyId === remove.id) item.storyId = keep.id;
		keep.aliases = [...new Set([...(keep.aliases ?? []), remove.id, ...(remove.aliases ?? [])])];
		state.stories = state.stories.filter(item => item !== remove);
		refresh();
	};
	refresh();
	for (const analysis of analyses) {
		const material = byId.get(analysis.materialId);
		if (!material || material.contentHash !== analysis.contentHash || material.revision !== analysis.revision || state.records.some(record => sameInput(record, analysis))) continue;
		const oldOccurrence = occurrenceOf(material.id);
		const oldStory = oldOccurrence && resolveStory(state.stories, oldOccurrence.storyId);
		if (oldOccurrence) oldOccurrence.materialIds = oldOccurrence.materialIds.filter(id => id !== material.id);
		state.mentions = state.mentions.filter(item => item.materialId !== material.id);
		state.proposals = state.proposals.filter(item => item.bridgeId !== material.id);
		state.records = state.records.filter(item => item.materialId !== material.id);
		refresh();
		const confidence = analysis.groupingConfidence ?? 0.8;
		let confirmed = analysis.relevance === 'PASS' && analysis.scope === 'single' && !!analysis.frame && analysis.relations.every(item => item.confidence >= confidence);
		const composite = analysis.scope === 'composite' || analysis.relations.some(item => item.kind === 'ROUNDUP');
		const ties = analysis.relations.filter(item => item.kind !== 'UNRELATED' && item.confidence >= confidence).sort((a, b) => Number(b.kind === 'SAME_OCCURRENCE') - Number(a.kind === 'SAME_OCCURRENCE') || b.confidence - a.confidence);
		if (composite) {
			for (const tie of ties) { const target = occurrenceOf(tie.targetId); if (target) state.mentions.push({ materialId: material.id, occurrenceId: target.id }); }
			confirmed = false;
		} else if (analysis.scope === 'single' && analysis.frame && analysis.relevance === 'PASS') {
			let chosen: NewsOccurrence | undefined;
			let chosenKind: 'SAME_OCCURRENCE' | 'SAME_STORY' | undefined;
			const targets: NewsStory[] = [];
			for (const tie of ties) {
				const target = occurrenceOf(tie.targetId), story = target && resolveStory(state.stories, target.storyId);
				const targetConfirmed = state.records.some(item => item.materialId === tie.targetId && item.confirmed);
				if (!target || !story || !targetConfirmed || tie.kind === 'SAME_STORY' && target.id !== story.rootOccurrenceId) { confirmed = false; continue; }
				if (tie.kind !== 'SAME_OCCURRENCE' && tie.kind !== 'SAME_STORY') continue;
				if (!chosen) { chosen = target; chosenKind = tie.kind; }
				if (!targets.includes(story)) targets.push(story);
			}
			let owner = chosen && resolveStory(state.stories, chosen.storyId);
			if (!owner) {
				owner = oldStory && !oldStory.materialIds.length ? oldStory : { id: state.stories.some(item => item.id === `story-${material.id}`) ? `story-${material.id}-${analysis.createdAt}` : `story-${material.id}`, title: analysis.frame.title, materialIds: [], occurrenceIds: [], firstSeenAt: reportTime(material), latestAt: reportTime(material), aliases: [] };
				if (!state.stories.includes(owner)) state.stories.push(owner);
			}
			if (chosen && chosenKind === 'SAME_OCCURRENCE') chosen.materialIds.push(material.id);
			else state.occurrences.push({ id: state.occurrences.some(item => item.id === `occ-${material.id}`) ? `occ-${material.id}-${analysis.createdAt}` : `occ-${material.id}`, storyId: owner.id, materialIds: [material.id], title: analysis.frame.title, frame: analysis.frame, firstSeenAt: reportTime(material), latestAt: reportTime(material), kind: chosen ? 'follow-up' : 'report' });
			refresh();
			if (oldStory && oldStory !== owner) {
				if (oldStory.materialIds.length) targets.push(oldStory);
				else { owner.aliases = [...new Set([...(owner.aliases ?? []), oldStory.id, ...(oldStory.aliases ?? [])])]; state.stories = state.stories.filter(item => item !== oldStory); }
			}
			for (const other of new Set(targets)) {
				if (other.id === owner.id) continue;
				const leftRoot = rootOf(owner), rightRoot = rootOf(other);
				const left = leftRoot && byId.get(leftRoot.materialIds[0]!), right = rightRoot && byId.get(rightRoot.materialIds[0]!);
				if (!left || !right) continue;
				const id = JSON.stringify([left, right].map(item => [item.id, item.revision, item.contentHash]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
				if (!state.proposals.some(item => item.id === id && item.bridgeId === material.id)) state.proposals.push({ id, leftId: owner.id, rightId: other.id, left, right, bridgeId: material.id });
			}
		}
		state.records.push({ materialId: material.id, revision: material.revision, contentHash: material.contentHash, version: analysis.version, analyzedAt: analysis.createdAt, confirmed });
	}
	for (const proposal of state.proposals) {
		const review = state.reviews.find(item => item.proposalId === proposal.id && item.confidence >= 0.75);
		const left = resolveStory(state.stories, proposal.leftId), right = resolveStory(state.stories, proposal.rightId);
		if (review && left && right && left !== right && (review.kind === 'SAME_OCCURRENCE' || review.kind === 'SAME_STORY')) merge(left, right, review.kind);
	}
	state.stories = state.stories.filter(item => item.materialIds.length);
	const occurrenceIds = new Set(state.occurrences.map(item => item.id));
	state.mentions = state.mentions.filter(item => byId.has(item.materialId) && occurrenceIds.has(item.occurrenceId));
	state.records = state.records.filter(item => byId.has(item.materialId));
	state.proposals = state.proposals.filter(item => byId.has(item.bridgeId) && byId.has(item.left.id) && byId.has(item.right.id));
	return state;
}

export function groupingConfirmed(events: NewsEvents, id: string): boolean {
	return events.records.some(record => record.materialId === id && record.confirmed) && !events.proposals.some(proposal => proposal.bridgeId === id && !events.reviews.some(review => review.proposalId === proposal.id && review.confidence >= 0.75));
}

export function confirmedMaterialIds(events: NewsEvents): Set<string> {
	const confirmed = new Set(events.records.filter(record => record.confirmed).map(record => record.materialId));
	const reviewed = new Set(events.reviews.filter(review => review.confidence >= 0.75).map(review => review.proposalId));
	for (const proposal of events.proposals) if (!reviewed.has(proposal.id)) confirmed.delete(proposal.bridgeId);
	return confirmed;
}

