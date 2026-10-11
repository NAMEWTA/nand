import { BrowserError } from '../model';
import type { TargetBinding } from '../workspace/model';
import type { AcceptedMessage, ProviderCapture, ProviderReadiness } from './contracts';

const identity = (value: string): boolean => /^[\w-]{1,100}$/.test(value);
export function verifyReadiness(binding: TargetBinding, value: ProviderReadiness): void {
	const expected = binding.page, actual = value.identity.page;
	if (!expected || expected.pageId !== actual.pageId || expected.profileId !== actual.profileId || expected.generation !== actual.generation
		|| binding.provider !== value.identity.provider || binding.conversationId !== value.identity.conversationId || binding.adapterVersion !== value.identity.adapterVersion)
		throw new BrowserError('browser_workspace_identity_changed');
	if (value.state !== 'ready') throw new BrowserError('browser_workspace_target_not_ready');
	if (new Set(value.messageIds).size !== value.messageIds.length || !value.messageIds.every(identity)
		|| (value.currentMessageId !== undefined && !value.messageIds.includes(value.currentMessageId))
		|| (value.messageIds.length > 0 && !value.currentMessageId)) throw new BrowserError('browser_workspace_message_identity');
}

export function verifyStaged(binding: TargetBinding, before: ProviderReadiness, staged: ProviderReadiness, prompt: string): void {
	verifyReadiness(binding, staged);
	if (staged.draft !== prompt || staged.currentMessageId !== before.currentMessageId
		|| JSON.stringify(staged.messageIds) !== JSON.stringify(before.messageIds)) throw new BrowserError('browser_workspace_draft_changed');
}

export function verifyAccepted(message: AcceptedMessage | undefined, staged: ProviderReadiness, prompt: string): asserts message is AcceptedMessage {
	if (!message || !identity(message.messageId) || !identity(message.conversationId) || message.text !== prompt
		|| staged.messageIds.includes(message.messageId) || message.parentId !== staged.currentMessageId
		|| (staged.identity.conversationId !== undefined && message.conversationId !== staged.identity.conversationId))
		throw new BrowserError('browser_workspace_submission_identity');
}

export function verifyCapture(capture: ProviderCapture, message: AcceptedMessage): void {
	if (capture.conversationId !== message.conversationId || capture.parentId !== message.messageId || !identity(capture.messageId)
		|| capture.messageId === message.messageId || !capture.adapterVersion
		|| (capture.complete && (!capture.markdown.trim() || capture.reasons.length > 0 || !capture.terminalEvidence.length)))
		throw new BrowserError('browser_workspace_capture_identity');
}
