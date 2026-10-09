import {
	SITE_HOME,
	channelLost,
	chooseAcquisition,
	currentTurnMarkdown,
	queueTargets,
	type AiSite,
	type ExchangeTarget,
} from './ai-workbench';
import { answerQuality, confirmCommit, precheckShot, shouldRollback, stageMatches, type AdapterRef } from './site-adapter';

export type SnapshotRef = AdapterRef;

export interface SiteExchangePort {
	open(url: string): Promise<void>;
	snapshot(): Promise<{ text: string; refs: readonly SnapshotRef[] }>;
	fill(ref: string, value: string): Promise<void>;
	press(ref: string | undefined): Promise<'submitted' | 'unknown' | 'failed'>;
}

/** One user prompt plus the text that follows it. Earlier turns are not the answer. */
export function turnEvents(prompt: string, pageText: string, turn: number): { role: 'user' | 'assistant'; text: string; turn: number }[] {
	const events: { role: 'user' | 'assistant'; text: string; turn: number }[] = [{ role: 'user', text: prompt, turn }];
	const after = pageText.includes(prompt) ? pageText.slice(pageText.lastIndexOf(prompt) + prompt.length).trim() : '';
	if (after && after !== prompt) events.push({ role: 'assistant', text: after, turn });
	return events;
}

/**
 * Precheck every official site, then stage and commit only when the round is allowed.
 * Each commit opens that site's home again so a later login page is not filled as an earlier site.
 * A click that does not change the page stays unknown. Acquisition does not call a model.
 */
export async function sendCurrentTurn(
	targets: readonly ExchangeTarget[],
	prompt: string,
	port: SiteExchangePort,
	readyOnly = false,
): Promise<{ targets: ExchangeTarget[]; calls: 0 }> {
	const counted = new Set(targets.filter((target) => target.send === 'queued').map((target) => target.id));
	const held: ExchangeTarget[] = [];
	const prepared: ExchangeTarget[] = [];
	for (const target of targets) {
		if (target.send === 'submitted' || target.send === 'unknown' || !prompt.trim()) {
			held.push({ ...target });
			continue;
		}
		const home = SITE_HOME[target.id as AiSite];
		if (!home) {
			prepared.push({ ...target, binding: 'unverified' });
			continue;
		}
		try {
			await port.open(home);
			const shot = await port.snapshot();
			prepared.push({ ...target, binding: precheckShot(shot).binding, send: 'idle' });
		} catch {
			prepared.push({ ...target, binding: 'disconnected', send: 'failed' });
		}
	}
	const plan = chooseAcquisition({ prompt, shots: prepared.map((target) => ({ binding: target.binding })), readyOnly });
	const byId = new Map<string, ExchangeTarget>();
	for (const target of held) byId.set(target.id, target);
	if (plan.mode === 'skip') {
		for (const target of prepared) byId.set(target.id, target);
		return { targets: targets.map((target) => byId.get(target.id) ?? { ...target }), calls: 0 };
	}
	const queued = queueTargets(prepared);
	for (const target of queued) {
		if (target.send !== 'queued') {
			byId.set(target.id, target);
			continue;
		}
		const home = SITE_HOME[target.id as AiSite];
		if (!home) {
			byId.set(target.id, { ...target, send: 'failed' });
			continue;
		}
		try {
			await port.open(home);
			const opened = precheckShot(await port.snapshot());
			if (!opened.composer) {
				byId.set(target.id, { ...target, send: 'failed' });
				continue;
			}
			await port.fill(opened.composer, prompt);
			const staged = await port.snapshot();
			const stagedOk = stageMatches(prompt, staged);
			if (!stagedOk.ok) {
				if (shouldRollback(prompt, staged.text)) await port.fill(opened.composer, '');
				byId.set(target.id, { ...target, send: 'failed' });
				continue;
			}
			const pressed = await port.press(stagedOk.submit);
			const after = await port.snapshot();
			if (confirmCommit(staged.text, after.text, pressed) !== 'submitted') {
				byId.set(target.id, channelLost([{ ...target, send: 'submitting' }])[0]!);
				continue;
			}
			const attempt = counted.has(target.id) ? target.attempt : target.attempt + 1;
			const events = turnEvents(prompt, after.text, attempt);
			const assistant = events.find((event) => event.role === 'assistant')?.text ?? '';
			byId.set(target.id, {
				...target,
				send: 'submitted',
				capture: answerQuality(prompt, assistant),
				answer: currentTurnMarkdown(events),
				attempt,
			});
		} catch {
			byId.set(target.id, { ...channelLost([{ ...target, send: 'submitting' }])[0]!, binding: 'disconnected' });
		}
	}
	return { targets: targets.map((target) => byId.get(target.id) ?? { ...target }), calls: plan.calls };
}
