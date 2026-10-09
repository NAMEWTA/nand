import type { AgentPromptRunner } from '../../agent/api';
import {
	AI_SITES,
	authorizeAssistant,
	automationReceipt,
	channelLost,
	compareCaptures,
	createIsolatedProfile,
	currentTurnMarkdown,
	defaultProfile,
	deleteIsolatedProfile,
	explicitResend,
	freezePrompt,
	importMaiw,
	recollect,
	rememberTask,
	SITE_HOME,
	siteSupport,
	synthesisPlan,
	type AiSite,
	type AssistantGrant,
	type BrowserProfile,
	type ExchangeTarget,
	type LocalTask,
} from '../core/ai-workbench';
import { sendCurrentTurn, turnEvents, type SiteExchangePort } from '../core/site-exchange';

/** Browser workspace state the page reads and writes. */
export class AiWorkspace {
	profiles: BrowserProfile[] = [defaultProfile()];
	profileId = 'default';
	sessions: { id: string }[] = [];
	grant: AssistantGrant = { scope: ['read'], highConsequence: false, confirmed: false };
	targets: ExchangeTarget[] = AI_SITES.map((id) => ({ id, binding: 'unverified', send: 'idle', capture: 'idle', attempt: 0 }));
	synthesis = '';
	/** Official rows stay unverified until a logged-in session exists. */
	support = siteSupport();
	frozen: { prompt: string; frozenAt: number } | undefined;
	tasks: LocalTask[] = [];
	comparison: { sites: string[]; complete: string[] } = { sites: [], complete: [] };
	receipt: { id: string; state: 'done' | 'cancelled' } | undefined;

	constructor(
		private readonly port: SiteExchangePort,
		private readonly runner: () => AgentPromptRunner | undefined,
	) {}

	activeProfile(): BrowserProfile {
		return this.profiles.find((profile) => profile.id === this.profileId) ?? defaultProfile();
	}

	addProfile(id: string): void {
		const next = createIsolatedProfile(this.profiles, id);
		if (next.length === this.profiles.length) return;
		this.profiles = next;
		this.profileId = id;
	}

	removeProfile(id: string, guests: readonly { id: string; profileId: string }[]) {
		const result = deleteIsolatedProfile(this.profiles, id, guests);
		this.profiles = result.profiles;
		if (this.profileId === id) this.profileId = 'default';
		return result;
	}

	importArchive(raw: string) {
		const result = importMaiw(raw, this.sessions);
		if (result.written) this.sessions = result.store;
		return result;
	}

	assist(requested: readonly string[], pageText: string) {
		return authorizeAssistant(this.grant, requested, pageText);
	}

	resend(id: string): void {
		this.targets = this.targets.map((target) => (target.id === id ? explicitResend(target) : target));
	}

	/** Stage and capture the current turn. This path does not call the runner. */
	async send(prompt: string, readyOnly = false): Promise<{ calls: 0 }> {
		const frozen = freezePrompt(prompt, Date.now());
		this.frozen = frozen;
		const sent = await sendCurrentTurn(this.targets, prompt, this.port, readyOnly);
		this.targets = sent.targets;
		this.comparison = compareCaptures(this.targets.map((target) => ({ site: target.id, answer: target.answer, capture: target.capture })));
		this.tasks = rememberTask(this.tasks, {
			id: String(frozen.frozenAt),
			prompt: frozen.prompt,
			at: frozen.frozenAt,
			status: this.comparison.complete.length ? 'done' : 'failed',
		});
		this.support = siteSupport();
		return { calls: sent.calls };
	}

	/** Read that site's page again. This does not send and does not create an attempt. */
	async recollect(id: string): Promise<void> {
		const current = this.targets.find((target) => target.id === id);
		if (!current) return;
		let next = current;
		const prompt = this.frozen?.prompt ?? '';
		const home = SITE_HOME[id as AiSite];
		try {
			if (home) await this.port.open(home);
			const shot = await this.port.snapshot();
			if (prompt && shot.text.includes(prompt)) {
				const answer = currentTurnMarkdown(turnEvents(prompt, shot.text, current.attempt));
				if (answer) next = { ...current, answer };
			}
		} catch {
			next = current;
		}
		const read = recollect(next);
		this.targets = this.targets.map((target) => (target.id === id ? read : target));
	}

	/** Stop the open run. Answers already stored stay, and the receipt is cancelled. */
	cancel(): { id: string; state: 'done' | 'cancelled' } {
		this.targets = channelLost(this.targets);
		const at = this.frozen?.frozenAt ?? Date.now();
		this.receipt = automationReceipt(String(at), true);
		if (this.frozen) {
			this.tasks = rememberTask(this.tasks, { id: `${at}-cancel`, prompt: this.frozen.prompt, at, status: 'cancelled' });
		}
		return this.receipt;
	}

	/** Opt-in synthesis is the only call to the shared runner. */
	async synthesize(optIn: boolean, prompt: string): Promise<{ calls: number; status: string; text: string }> {
		const plan = synthesisPlan(optIn, this.targets);
		if (plan.calls === 0) return { calls: 0, status: 'skipped', text: '' };
		const runner = this.runner();
		if (!runner) return { calls: 0, status: 'failed', text: '' };
		const result = await runner.run({ prompt, purpose: 'browser-synthesis' });
		this.synthesis = result.status === 'complete' ? result.text : '';
		return { calls: 1, status: result.status, text: this.synthesis };
	}
}
