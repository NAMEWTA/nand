import type { BrowserPageTarget } from '../control';
import { BrowserError, type BrowserRect } from '../model';
import type { WorkspaceProvider } from '../providers/ids';
import type { MaiwExchange, MaiwSession, MaiwTurn } from './maiw-format';
import type { SynthesisRecord } from './synthesis-model';

export { WORKSPACE_PROVIDERS, type WorkspaceProvider } from '../providers/ids';
export interface HistoryImport<T> { format: 'maiw-v3'; sourceId: string; fingerprint: string; record: T }
export interface ImportedTurn extends HistoryImport<Omit<MaiwTurn, 'prompt' | 'userQuestion' | 'appliedPromptTemplates'>> {
	hasQuestion: boolean; templates?: Array<{ id: string; order: number }>;
}
export interface ImportedAnswer extends HistoryImport<Omit<MaiwExchange, 'responseText' | 'responseMarkdown'>> { text?: string; markdown?: string }
/** Transient live observation; website draft text and message bodies never enter readiness reports. */
export interface TargetCheck {
	targetId: string;
	state: 'checking' | 'ready' | 'login-required' | 'generating' | 'draft-present' | 'unverified' | 'disconnected' | 'needs-attention';
	reason?: string;
}
export interface TargetBinding {
	id: string;
	provider: WorkspaceProvider;
	profileId: string;
	accountLabel: string;
	page?: BrowserPageTarget;
	conversationId?: string;
	officialUrl?: string;
	adapterVersion?: string;
	verifiedAt?: number;
	status: 'unverified' | 'ready' | 'login-required' | 'disconnected' | 'needs-attention';
}
export interface PromptSnapshot { id: string; revision: number; title: string; body: string }
export interface PromptTemplate extends PromptSnapshot { order: number; createdAt: number; updatedAt: number }
export interface WorkspacePanelLayout { order: string[]; widths: Record<string, number>; focused?: string; maximized?: string }
export interface WorkspaceTask {
	id: string;
	title: string;
	pinned: boolean;
	createdAt: number;
	updatedAt: number;
	draft: string;
	promptTemplateIds?: string[];
	targets: TargetBinding[];
	selectedTargetIds: string[];
	visibleTargetIds: string[];
	panelLayout?: WorkspacePanelLayout;
	imported?: HistoryImport<MaiwSession>;
}
export interface WorkspaceTurn {
	id: string;
	taskId: string;
	sequence: number;
	question: string;
	finalPrompt: string;
	templates: PromptSnapshot[];
	targets: TargetBinding[];
	createdAt: number;
	imported?: ImportedTurn;
}
export interface WorkspaceRetryPreview {
	id: string;
	taskId: string;
	exchangeId: string;
	finalPrompt: string;
	target: TargetBinding;
	duplicateRisk: boolean;
}
export interface SendAttempt {
	id: string;
	expectedTarget: BrowserPageTarget;
	expectedConversationId?: string;
	intentPersistedAt: number;
	promptHash: string;
	dispatchStartedAt?: number;
	acceptedMessageId?: string;
	acceptedConversationId?: string;
	acceptedParentId?: string;
	finishedAt?: number;
	outcome: 'intent' | 'staged' | 'dispatching' | 'accepted' | 'not-sent' | 'unknown';
	errorCode?: string;
}
export interface AnswerCapture {
	id: string;
	exchangeId: string;
	revision: number;
	source: 'provider-api' | 'native-copy' | 'scoped-dom';
	adapterVersion: string;
	conversationId: string;
	messageId: string;
	parentId?: string;
	branchId?: string;
	markdown: string;
	complete: boolean;
	reasons: string[];
	terminalEvidence: string[];
	capturedAt: number;
}
export interface WorkspaceExchange {
	id: string;
	turnId: string;
	targetId: string;
	attempts: SendAttempt[];
	receipt?: { attemptId: string; conversationId: string; messageId: string; parentId?: string };
	submitState: 'idle' | 'staging' | 'staged' | 'submitting' | 'submitted' | 'not-sent' | 'unknown' | 'paused';
	acquisitionState: 'idle' | 'waiting' | 'collecting' | 'complete' | 'incomplete' | 'failed';
	saveState: 'pending' | 'saved' | 'failed';
	captures: AnswerCapture[];
	/** Explicit user associations stay separate from provider captures and their current pointer. */
	selections?: SelectedExcerpt[];
	currentCaptureId?: string;
	lastError?: string;
	imported?: ImportedAnswer;
}
export interface SelectionSource {
	page: BrowserPageTarget; url: string; title: string; selector: string; rect: BrowserRect;
	viewport: { width: number; height: number }; conversationId?: string; messageId?: string;
}
export interface SelectedExcerpt {
	id: string; exchangeId: string; revision: number; source: 'user-selection'; complete: false;
	markdown: string; capturedAt: number; reasons: ['user-selection']; selection: SelectionSource;
}
export interface WorkspaceData {
	version: 1;
	tasks: WorkspaceTask[];
	turns: WorkspaceTurn[];
	exchanges: WorkspaceExchange[];
	templates: PromptTemplate[];
	syntheses: SynthesisRecord[];
}
export const emptyWorkspace = (): WorkspaceData => ({ version: 1, tasks: [], turns: [], exchanges: [], templates: [], syntheses: [] });

export function retryContext(data: WorkspaceData, exchangeId: string): { exchange: WorkspaceExchange; turn: WorkspaceTurn; binding: TargetBinding } {
	const exchange = data.exchanges.find(row => row.id === exchangeId), turn = data.turns.find(row => row.id === exchange?.turnId);
	const binding = data.tasks.find(row => row.id === turn?.taskId)?.targets.find(row => row.id === exchange?.targetId);
	const original = turn?.targets.find(row => row.id === exchange?.targetId), attempt = exchange?.attempts.at(-1);
	if (!exchange || !turn || exchange.imported || exchange.receipt || !['not-sent', 'unknown', 'paused'].includes(exchange.submitState)
		|| (attempt && ['accepted', 'dispatching'].includes(attempt.outcome))) throw new BrowserError('browser_workspace_retry_review');
	if (!binding?.page || !original || binding.provider !== original.provider || binding.profileId !== original.profileId)
		throw new BrowserError('browser_workspace_identity_changed');
	return { exchange, turn, binding };
}

/** Called before durable intent. Visibility never selects recipients; every turn owns immutable snapshots. */
export function freezeTurn(task: WorkspaceTask, id: string, sequence: number, finalPrompt: string, templates: readonly PromptSnapshot[], now: number): WorkspaceTurn {
	if (!finalPrompt.trim()) throw new BrowserError('browser_workspace_empty_prompt');
	const selected = new Set(task.selectedTargetIds);
	if (!selected.size || selected.size !== task.selectedTargetIds.length) throw new BrowserError('browser_workspace_targets');
	const targets = task.targets.filter(target => selected.has(target.id));
	if (targets.length !== selected.size) throw new BrowserError('browser_workspace_targets');
	if (targets.some(target => target.status !== 'ready' || !target.page || target.page.profileId !== target.profileId))
		throw new BrowserError('browser_workspace_target_not_ready');
	return structuredClone({ id, taskId: task.id, sequence, question: task.draft, finalPrompt, templates: [...templates], targets, createdAt: now });
}

/** A crash after dispatch must never be reclassified as unsent or silently retried. */
export function recoverExchange(exchange: WorkspaceExchange): WorkspaceExchange {
	const next = structuredClone(exchange), attempt = next.attempts.at(-1);
	const awaitingCapture = next.acquisitionState === 'collecting' || next.acquisitionState === 'waiting';
	if (!attempt || (attempt.finishedAt !== undefined && !awaitingCapture)) return next;
	if (attempt.finishedAt === undefined && attempt.dispatchStartedAt !== undefined && attempt.outcome !== 'accepted') {
		attempt.outcome = 'unknown'; next.submitState = 'unknown';
	} else if (attempt.finishedAt === undefined && attempt.outcome !== 'accepted') next.submitState = 'paused';
	if (awaitingCapture) next.acquisitionState = 'incomplete';
	next.lastError = 'browser_workspace_interrupted';
	return next;
}

/** The newest capture is authoritative even when it is partial; a late revision cannot replace it. */
export function applyCapture(exchange: WorkspaceExchange, capture: AnswerCapture): WorkspaceExchange {
	if (capture.exchangeId !== exchange.id || exchange.captures.some(row => row.revision >= capture.revision))
		throw new BrowserError('browser_workspace_stale_capture');
	const next = structuredClone(exchange);
	next.captures.push(structuredClone(capture));
	next.currentCaptureId = capture.id;
	next.acquisitionState = capture.complete ? 'complete' : 'incomplete';
	next.saveState = 'pending';
	return next;
}
