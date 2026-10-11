import { htmlToMarkdown } from 'obsidian';
import type { BrowserPageTarget } from '../../core/control';
import { BrowserError } from '../../core/model';
import type { AcceptedMessage, ProviderCapture, ProviderReadiness, ProviderSession, ProviderSubmission } from '../../core/providers/contracts';
import { verifyAccepted, verifyReadiness, verifyStaged } from '../../core/providers/verification';
import { answerContentReasons } from '../../core/providers/quality';
import type { TargetBinding } from '../../core/workspace/model';
import type { BrowserPage } from './page';
import type { BrowserAutomation } from './automation';
import type { ProviderDom } from './provider-dom';
import type { ResponseScope } from './provider-responses';
import { ProviderResponses } from './provider-responses';
import { websiteCopyProgram, type WebsiteCopy } from './provider-copy';
import { adapterMatches, adapterVersion, type ProviderOverride } from '../../core/providers/user-adapter';
import { userAdapterDom } from './user-adapter-dom';

export interface ProviderSessionPorts {
 enabled(): boolean; page(target: BrowserPageTarget): BrowserPage; activate(target: BrowserPageTarget, signal: AbortSignal): Promise<void>;
 adapter?(binding: TargetBinding, taskId: string): Promise<ProviderOverride | undefined>;
 override?: ProviderOverride;
}
const sameTarget = (left: BrowserPageTarget, right: BrowserPageTarget): boolean => left.pageId === right.pageId && left.profileId === right.profileId && left.generation === right.generation;

export interface ProviderHistory {
 conversationId: string; title?: string;
 messages: Array<{ id: string; parentId?: string; parentKnown: boolean; role: 'user' | 'assistant'; markdown: string }>;
 currentMessageId?: string; branch: string[]; reasons: string[]; terminalEvidence?: string[];
}
export interface ProviderPolicy<T> {
 provider: TargetBinding['provider']; origin: string; domRead: string; version: string;
 responses?: Pick<ResponseScope<T>, 'allow' | 'project' | 'requestIdentity'>;
 history?(values: readonly T[], dom: ProviderDom): ProviderHistory | undefined;
}

/** One task owns one explicit guest generation. The site adapter cannot retarget another active page. */
export class NativeProviderSession<T> implements ProviderSession {
 readonly target: BrowserPageTarget;
 private readonly page: BrowserPage;
 private readonly automation: BrowserAutomation;
 private readonly abort = new AbortController();
 private readonly responses?: ProviderResponses<T>;
 private readonly lifetime: AbortSignal;
 private generatingObserved = false;
 constructor(private readonly binding: TargetBinding, private readonly ports: ProviderSessionPorts, private readonly policy: ProviderPolicy<T>, signal: AbortSignal) {
  if (ports.override) this.policy = { ...policy, domRead: userAdapterDom(policy.domRead, ports.override.rule),
   version: adapterVersion(ports.override.rule), responses: undefined, history: undefined };
  if (!binding.page) throw new BrowserError('browser_stale_target');
  this.target = Object.freeze({ ...binding.page });
  this.page = ports.page(this.target);
  if (!this.page.automation || !this.page.guest) throw new BrowserError('browser_page_not_live');
  this.automation = this.page.automation;
  this.lifetime = AbortSignal.any([signal, this.abort.signal, this.automation.queue.abort.signal]);
  this.admit(signal);
  if (this.policy.responses) this.responses = new ProviderResponses(this.page.guest, { signal: this.lifetime, admit: () => this.admit(),
   ...this.policy.responses,
   readBody: id => this.automation.readProviderResponse(id, () => this.admit()) });
 }
 private admit(signal?: AbortSignal): void {
  if (this.lifetime.aborted || signal?.aborted) throw new BrowserError('browser_workspace_paused');
  if (!this.ports.enabled()) throw new BrowserError('browser_disabled');
  const page = this.ports.page(this.target);
  if (page !== this.page || page.disposed || page.automation !== this.automation || !sameTarget(this.target, { pageId: page.state.id, profileId: page.profileId, generation: page.generation }))
   throw new BrowserError('browser_stale_target');
  let url: URL; try { url = new URL(page.state.url); } catch { throw new BrowserError('browser_workspace_identity_changed'); }
  if (url.origin !== this.policy.origin || url.username || url.password) throw new BrowserError('browser_workspace_identity_changed');
  if (this.ports.override) {
   this.ports.override.admit();
   if (!adapterMatches(this.ports.override.rule, this.binding, url.href)) throw new BrowserError('browser_adapter_scope');
  }
 }
 private async read(signal: AbortSignal): Promise<ProviderDom> {
  this.admit(signal);
  const dom = await this.automation.readProviderDom(this.policy.domRead, () => this.admit(signal)) as ProviderDom;
  if (new URL(dom.url).origin !== this.policy.origin) throw new BrowserError('browser_workspace_identity_changed');
  if (dom.generating) this.generatingObserved = true;
  return dom;
 }
 private history(dom: ProviderDom): ProviderHistory | undefined {
  const history = this.policy.history?.(this.responses?.values() ?? [], dom);
  const visibleTip = dom.messages.at(-1)?.id;
  if (history?.reasons.includes('active-branch-unverified') || (dom.messageIdentitiesComplete && visibleTip && history?.currentMessageId !== visibleTip)) return undefined;
  return history;
 }
 private readiness(dom: ProviderDom): ProviderReadiness {
  const history = this.history(dom);
  const ids = history?.branch.length ? history.branch : dom.messages.map(message => message.id);
  return { identity: { page: this.target, provider: this.policy.provider, url: dom.url, conversationId: dom.conversationId,
   ...(this.ports.override ? { adapterVersion: adapterVersion(this.ports.override.rule) } : {}) },
   state: dom.loginRequired ? 'login-required' : dom.generating ? 'generating'
    : dom.challenge || !dom.composer || (dom.messageRootCount > 0 && !dom.conversationId) || (!history && !dom.messageIdentitiesComplete) ? 'unsupported' : 'ready',
   draft: dom.composer?.value ?? '', messageIds: ids, currentMessageId: history?.currentMessageId ?? ids.at(-1),
   reason: dom.challenge ? 'browser_workspace_challenge' : undefined };
 }
 async inspect(signal: AbortSignal): Promise<ProviderReadiness> { return this.readiness(await this.read(signal)); }
	async reveal(message: Pick<ProviderCapture, 'conversationId' | 'messageId' | 'parentId'>, signal: AbortSignal): Promise<void> {
		const dom = await this.read(signal), rows = dom.messages.filter(row => row.id === message.messageId && row.role === 'assistant'
			&& row.parentKnown && row.parentId === message.parentId);
		if (dom.loginRequired || dom.challenge) throw new BrowserError('browser_workspace_target_not_ready');
		if (dom.conversationId !== message.conversationId || rows.length !== 1 || !rows[0]!.selector) throw new BrowserError('browser_workspace_source_not_loaded');
		const selector = rows[0]!.selector;
		await this.ports.activate(this.target, AbortSignal.any([signal, this.lifetime])); this.admit(signal);
		const guard = '(()=>{const d=' + this.policy.domRead + ';const rows=d.messages.filter(m=>m.id===' + JSON.stringify(message.messageId)
			+ '&&m.role==="assistant"&&m.parentKnown&&m.parentId===' + JSON.stringify(message.parentId) + ');return d.conversationId==='
			+ JSON.stringify(message.conversationId) + '&&!d.loginRequired&&!d.challenge&&rows.length===1&&rows[0].selector===' + JSON.stringify(selector) + '})()';
		await this.automation.providerReveal({ selector, guard }, () => this.admit(signal));
	}
 private async wait(signal: AbortSignal, milliseconds = 250): Promise<void> {
  this.admit(signal);
  const combined = AbortSignal.any([signal, this.lifetime]), win = this.page.webview.win;
  await new Promise<void>((resolve, reject) => {
   const stop = () => { win.clearTimeout(timer); combined.removeEventListener('abort', stop); reject(new BrowserError('browser_workspace_paused')); };
   const timer = win.setTimeout(() => { combined.removeEventListener('abort', stop); resolve(); }, milliseconds);
   combined.addEventListener('abort', stop, { once: true }); if (combined.aborted) stop();
  });
 }
 private guard(dom: ProviderDom, prompt: string): string {
  return '(()=>{const d=' + this.policy.domRead + ';return new URL(d.url).origin===' + JSON.stringify(this.policy.origin) + '&&!d.generating&&!d.loginRequired&&!d.challenge&&'
   + 'd.conversationId===' + JSON.stringify(dom.conversationId) + '&&d.composer?.value===' + JSON.stringify(prompt)
   + '&&JSON.stringify(d.messages.map(m=>m.id))===' + JSON.stringify(JSON.stringify(dom.messages.map(message => message.id))) + '})()';
 }
 private async input(kind: 'fill' | 'click', selector: string, dom: ProviderDom, expectedDraft: string, signal: AbortSignal, value?: string): Promise<void> {
  this.admit(signal); await this.ports.activate(this.target, AbortSignal.any([signal, this.lifetime])); this.admit(signal);
  await this.automation.providerInput({ kind, selector, value, guard: this.guard(dom, expectedDraft) }, () => this.admit(signal));
 }
 async newConversation(signal: AbortSignal): Promise<ProviderReadiness> {
  const before = await this.read(signal);
  if (!before.newConversation || !before.composer || before.composer.value !== '' || before.generating || before.loginRequired || before.challenge)
   throw new BrowserError('browser_workspace_new_conversation');
  await this.input('click', before.newConversation, before, '', signal);
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
   const dom = await this.read(signal);
   if (dom.messageRootCount === 0 && dom.composer?.value === '' && (before.conversationId === undefined || dom.conversationId !== before.conversationId)) {
    const ready = this.readiness(dom); if (ready.state === 'ready') return ready;
   }
   await this.wait(signal);
  }
  throw new BrowserError('browser_workspace_new_conversation');
 }
 async stage(prompt: string, expected: ProviderReadiness, signal: AbortSignal): Promise<ProviderReadiness> {
  const dom = await this.read(signal), before = this.readiness(dom);
  verifyReadiness(this.binding, before);
  if (!dom.composer || before.draft !== '' || before.currentMessageId !== expected.currentMessageId || JSON.stringify(before.messageIds) !== JSON.stringify(expected.messageIds))
   throw new BrowserError('browser_workspace_draft_changed');
  await this.input('fill', dom.composer.selector, dom, '', signal, prompt);
  const staged = await this.inspect(signal); verifyStaged(this.binding, expected, staged, prompt); return staged;
 }
 private accepted(dom: ProviderDom, prompt: string, staged: ProviderReadiness): AcceptedMessage | undefined {
  if (!dom.conversationId) return undefined;
  const history = this.history(dom);
  const messages = history ? history.messages.filter(message => history.branch.includes(message.id)).map(message => ({ ...message, text: message.markdown })) : dom.messages;
  const candidates = messages.filter(message => message.role === 'user' && message.parentKnown && message.text === prompt && !staged.messageIds.includes(message.id) && message.parentId === staged.currentMessageId);
  if (candidates.length !== 1) return undefined;
  const message = candidates[0]!;
  const accepted = { conversationId: dom.conversationId, messageId: message.id, parentId: message.parentId, text: message.text };
  verifyAccepted(accepted, staged, prompt); return accepted;
 }
 async commit(prompt: string, staged: ProviderReadiness, signal: AbortSignal): Promise<ProviderSubmission> {
  const dom = await this.read(signal); verifyStaged(this.binding, staged, this.readiness(dom), prompt);
  if (!dom.submit) return { status: 'not-sent', reason: 'browser_workspace_control_missing' };
  this.ports.override?.commit();
  this.generatingObserved = false;
  await this.input('click', dom.submit.selector, dom, prompt, signal);
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
   const current = await this.read(signal), message = this.accepted(current, prompt, staged);
   if (message) return { status: 'accepted', message };
   await this.wait(signal);
  }
  return { status: 'unknown', reason: 'browser_workspace_submission_unknown' };
 }
 private captureCandidate(dom: ProviderDom, message: AcceptedMessage): ProviderCapture | undefined {
  if (dom.conversationId !== message.conversationId) throw new BrowserError('browser_workspace_identity_changed');
  const history = this.history(dom), terminalEvidence = this.generatingObserved && !dom.generating && !dom.interrupted ? ['observed-generation-ended'] : [];
  const reason = dom.interrupted ? ['interrupted'] : terminalEvidence.length ? [] : ['terminal-unobserved'];
  const candidates = history?.messages.filter(row => row.role === 'assistant' && row.parentId === message.messageId && history.branch.includes(row.id)) ?? [];
  if (candidates.length === 1) {
   const answer = candidates[0]!, reasons = [...history!.reasons, ...reason, ...answerContentReasons(answer.markdown, history!.title)];
   return { source: 'provider-api', adapterVersion: this.policy.version + '-history-v1', conversationId: message.conversationId, messageId: answer.id,
    parentId: answer.parentId, branchId: history!.currentMessageId, markdown: answer.markdown, complete: !reasons.length, reasons, terminalEvidence: [...terminalEvidence, ...(history!.terminalEvidence ?? [])] };
  }
  const rows = dom.messages.filter(row => row.role === 'assistant' && row.parentId === message.messageId);
  if (rows.length !== 1) return undefined;
  const answer = rows[0]!, markdown = htmlToMarkdown(answer.html);
  if (this.ports.override && !dom.generating && !markdown.trim()) throw new BrowserError('browser_adapter_answer');
  // This read-only fallback has no verified virtual-list coverage contract. Preserve useful content as partial.
  return { source: 'scoped-dom', adapterVersion: this.policy.version + '-dom-v1', conversationId: message.conversationId, messageId: answer.id,
   parentId: answer.parentId, markdown, complete: false,
   reasons: [...reason, ...answerContentReasons(markdown), 'scoped-dom-coverage-unverified', ...(answer.partial ? ['truncated-dom'] : [])], terminalEvidence };
 }
	private async copyCandidate(candidate: ProviderCapture, signal: AbortSignal): Promise<ProviderCapture> {
		if (candidate.source !== 'scoped-dom') return candidate;
		// The synthetic copy never gains user activation. Wait finitely for activation from Submit to expire.
		const deadline = Date.now() + 6000;
		while (await this.automation.readProviderDom('navigator.userActivation.isActive', () => this.admit(signal)) === true) {
			if (Date.now() >= deadline) return candidate;
			await this.wait(signal);
		}
		const dom = await this.read(signal), rows = dom.messages.filter(row => row.role === 'assistant' && row.id === candidate.messageId
			&& row.parentKnown && row.parentId === candidate.parentId);
		if (dom.conversationId !== candidate.conversationId || dom.generating || dom.loginRequired || dom.challenge || rows.length !== 1 || !rows[0]!.copy) return candidate;
		const answer = rows[0]!, copy = answer.copy!, markdown = htmlToMarkdown(answer.html);
		// Freeze the entire public message, control, branch and human draft through the copy dispatch.
		const evidence = JSON.stringify({ conversationId: dom.conversationId,
			messages: dom.messages.map(row => [row.id, row.parentId, row.parentKnown, row.role, row.text, row.html, row.partial]), draft: dom.composer?.value });
		const guard = '(()=>{const d=' + this.policy.domRead + ';return !d.generating&&!d.loginRequired&&!d.challenge&&JSON.stringify({conversationId:d.conversationId,messages:d.messages.map(m=>[m.id,m.parentId,m.parentKnown,m.role,m.text,m.html,m.partial]),draft:d.composer?.value})==='
			+ JSON.stringify(evidence) + '})()';
		const program = '(()=>{const d=' + this.policy.domRead + ';if(!d.messages.some(m=>m.id===' + JSON.stringify(answer.id)
			+ '&&m.copy?.root===' + JSON.stringify(copy.root) + '&&m.copy.button===' + JSON.stringify(copy.button) + '))return;return ' + websiteCopyProgram(copy, guard) + '})()';
		const copied = await this.automation.providerCopy(program, () => this.admit(signal)) as WebsiteCopy | undefined;
		if (!copied) return candidate;
		const text = copied.mime === 'text/html' ? htmlToMarkdown(copied.text) : copied.text;
		// Exact whole-content comparison permits whitespace differences; no prefix/suffix or longest-text guessing.
		if (!text.trim() || text.replace(/\s/g, '') !== markdown.replace(/\s/g, '')) return candidate;
		return { ...candidate, source: 'native-copy', adapterVersion: this.policy.version + '-copy-v1', markdown: text,
			complete: false, reasons: [...candidate.reasons.filter(reason => reason !== 'scoped-dom-coverage-unverified'), 'native-copy-coverage-unverified'] };
	}
 async capture(message: AcceptedMessage, signal: AbortSignal): Promise<ProviderCapture> {
  const deadline = Date.now() + 180000; let previous = '', stableAt = Date.now(), latest: ProviderCapture | undefined;
  try {
   while (Date.now() < deadline) {
    const dom = await this.read(signal), candidate = this.captureCandidate(dom, message);
    if (candidate) {
     latest = candidate; const signature = JSON.stringify(candidate);
     if (signature !== previous) { previous = signature; stableAt = Date.now(); }
     if (!dom.generating && Date.now() - stableAt >= 1500) return await this.copyCandidate(candidate, signal);
    }
    await this.wait(signal, 500);
   }
  } catch (error) {
   if (!latest || !(error instanceof BrowserError) || !['browser_workspace_paused', 'browser_stale_target', 'browser_page_closed'].includes(error.code)) throw error;
   return { ...latest, complete: false, reasons: [...new Set([...latest.reasons, 'interrupted'])] };
  }
  if (latest) return { ...latest, complete: false, reasons: [...new Set([...latest.reasons, 'acquisition-timeout'])] };
  throw new BrowserError('browser_workspace_answer_missing');
 }
 async rollback(prompt: string, signal: AbortSignal): Promise<void> {
  const dom = await this.read(signal);
  if (dom.composer?.value !== prompt || dom.generating) return;
  await this.input('fill', dom.composer.selector, dom, prompt, signal, '');
 }
 dispose(): void { this.abort.abort(); this.responses?.dispose(); }
}
