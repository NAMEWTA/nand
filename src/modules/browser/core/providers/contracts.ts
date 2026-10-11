import type { BrowserPageTarget } from '../control';
import type { AnswerCapture, TargetBinding, WorkspaceProvider } from '../workspace/model';

/** Necessary identity fields projected from an allowlisted provider request; never a raw request record. */
export interface ProviderRequestIdentity { conversationId: string; cursor?: string }

export interface ProviderIdentity {
	page: BrowserPageTarget;
	provider: WorkspaceProvider;
	url: string;
	conversationId?: string;
	adapterVersion?: string;
}
export interface ProviderReadiness {
	identity: ProviderIdentity;
	state: 'ready' | 'login-required' | 'generating' | 'unsupported' | 'disconnected';
	/** Current composer only; never passwords, cookies or network request headers. */
	draft: string;
	messageIds: string[];
	/** Active branch tip, required for a nonempty conversation. */
	currentMessageId?: string;
	reason?: string;
}
export interface AcceptedMessage {
	conversationId: string;
	messageId: string;
	parentId?: string;
	/** Exact observed text of the new user message, compared with the immutable prompt. */
	text: string;
}
export interface ProviderSubmission {
	status: 'accepted' | 'not-sent' | 'unknown';
	message?: AcceptedMessage;
	reason?: string;
}
export type ProviderCapture = Omit<AnswerCapture, 'id' | 'exchangeId' | 'revision' | 'capturedAt'>;

/** A driver owns one verified page generation. A later call cannot choose a different active page. */
export interface ProviderSession {
	readonly target: BrowserPageTarget;
	inspect(signal: AbortSignal): Promise<ProviderReadiness>;
	/** Verifies that the website changed to an empty conversation; opening its home is insufficient. */
	newConversation(signal: AbortSignal): Promise<ProviderReadiness>;
	/** Must reject another user's nonempty draft and read back the complete staged prompt. */
	stage(prompt: string, expected: ProviderReadiness, signal: AbortSignal): Promise<ProviderReadiness>;
	/** One dispatch; unknown results are never retried by the adapter. */
	commit(prompt: string, staged: ProviderReadiness, signal: AbortSignal): Promise<ProviderSubmission>;
	capture(message: AcceptedMessage, signal: AbortSignal): Promise<ProviderCapture>;
	/** Explicit user navigation to one saved public answer; never matches by body text. */
	reveal?(message: Pick<AnswerCapture, 'conversationId' | 'messageId' | 'parentId'>, signal: AbortSignal): Promise<void>;
	/** Rollback only the exact draft this operation staged. */
	rollback(prompt: string, signal: AbortSignal): Promise<void>;
	/** Removes task-scoped network observation and native listeners. */
	dispose(): void;
}
export interface ProviderFactory {
	/** A missing/stale binding is a failure, never an implicit current-page fallback. */
	connect(binding: TargetBinding, taskId: string, signal: AbortSignal): Promise<ProviderSession>;
}
