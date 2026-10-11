import { serviceKey } from '../../app/contracts/module';
import type { BrowserOpenRequest, BrowserSettings } from './core/model';
import type { BrowserProfile, ProfilePage } from './core/profiles';
import type { BrowserActionReceipt, BrowserActionReview, BrowserReviewableAction, BrowserElementRef, BrowserElementValue, BrowserObservation, BrowserPageAction, BrowserPageInfo, BrowserPageTarget } from './core/control';
import type { WorkspaceData, WorkspaceTask, WorkspaceTurn, WorkspaceProvider, WorkspaceRetryPreview, TargetCheck } from './core/workspace/model';
import type { AssistantRequest, AssistantTask } from './core/assistant/model';
import type { BrowserWorkflowSpec, WorkflowExecution, WorkflowReview } from './core/workflows/model';
import type { AutomationWorkflowReceipt } from '../automations/api';
import type { BrowserWorkflowAction } from '../../shared/automation/types';
import type { ExternalAccessGrant, ExternalAccessRequest } from './core/external-access';

export type { BrowserOpenRequest, BrowserSettings };
export type { BrowserProfile, ProfilePage };
export type { BrowserActionReceipt, BrowserActionReview, BrowserReviewableAction, BrowserElementRef, BrowserElementValue, BrowserObservation, BrowserPageAction, BrowserPageInfo, BrowserPageTarget };
export type { WorkspaceData, WorkspaceTask, WorkspaceTurn, WorkspaceProvider, WorkspaceRetryPreview, TargetCheck };
export type { AssistantRequest, AssistantTask };

/** Durable task actions. Initializing reads local documents; it never opens a website or resumes sending. */
export interface BrowserWorkspace {
	initialize(): Promise<void>;
	snapshot(): WorkspaceData | undefined;
	busy(taskId: string): boolean;
	createTask(title: string, profileId: string, accountLabel: string, provider?: WorkspaceProvider): Promise<string>;
	addTarget(taskId: string, provider: WorkspaceProvider, profileId: string, accountLabel: string): Promise<string>;
	removeTarget(taskId: string, targetId: string): Promise<void>;
	updateTask(taskId: string, change: Partial<Pick<WorkspaceTask, 'title' | 'pinned' | 'draft' | 'selectedTargetIds' | 'visibleTargetIds'>>): Promise<void>;
	prepareTarget(taskId: string, targetId: string, newConversation: boolean): Promise<void>;
	checkTargets(taskId: string): Promise<TargetCheck[]>;
	preview(taskId: string, templateIds?: readonly string[], finalPrompt?: string, onlyReady?: boolean): Promise<WorkspaceTurn>;
	send(previewId: string): Promise<void>;
	pause(taskId: string): void;
	takeover(taskId: string, targetId: string): Promise<void>;
	/** Fresh read-only checks after manual intervention; this never resumes a submission. */
	resume(taskId: string): Promise<TargetCheck[]>;
	/** Read only the answer linked to a confirmed receipt; retains earlier capture revisions. */
	recollect(exchangeId: string): Promise<void>;
	previewRetry(exchangeId: string): Promise<WorkspaceRetryPreview>;
	retrySend(previewId: string): Promise<void>;
	followUp(exchangeId: string): Promise<void>;
	openAnswer(exchangeId: string, captureId: string): Promise<void>;
	retrySave(): Promise<void>;
	subscribe(listener: () => void): () => void;
}

/** Explicit target control. Observation and actions never activate another workbench page. */
export interface BrowserControl {
	list(): BrowserPageInfo[];
	open(request: BrowserOpenRequest): Promise<BrowserPageTarget>;
	observe(target: BrowserPageTarget): Promise<BrowserObservation>;
	readElement(target: BrowserPageTarget, ref: BrowserElementRef): Promise<BrowserElementValue>;
	/** Requires a visible page; never reveals it implicitly. */
	screenshot(target: BrowserPageTarget, full?: boolean): Promise<string>;
	/** Native input requires a visible page and focuses that guest. Navigation can run in the background. */
	act(target: BrowserPageTarget, action: BrowserPageAction): Promise<BrowserActionReceipt>;
	/** Read the exact control, destination and visible form before asking for a one-use confirmation. */
	reviewAction(target: BrowserPageTarget, action: BrowserReviewableAction): Promise<BrowserActionReview>;
	/** Rechecks that material inside the same native queue; a changed or consumed review fails closed. */
	actReviewed(target: BrowserPageTarget, reviewId: string): Promise<BrowserActionReceipt>;
	/** Explicit foreground navigation, used only when the caller intends to reveal a page. */
	activate(target: BrowserPageTarget): Promise<void>;
	close(target: BrowserPageTarget): Promise<void>;
}

export interface BrowserProfiles {
	list(): BrowserProfile[];
	create(label: string): Promise<BrowserProfile>;
	rename(id: string, label: string): Promise<void>;
	/** Review these pages before deletion; a changed set requires a fresh confirmation. */
	affectedPages(id: string): ProfilePage[];
	remove(id: string, confirmedPageIds: readonly string[]): Promise<void>;
	subscribe(listener: () => void): () => void;
}

/** Opt-in bounded tasks. Loading records never starts an agent, opens a page or grants a credential. */
export interface BrowserAssistant {
	initialize(): Promise<void>;
	snapshot(): AssistantTask[] | undefined;
	review(request: AssistantRequest): Promise<AssistantTask>;
	start(previewId: string): Promise<void>;
	busy(taskId: string): boolean;
	stop(taskId: string, reason?: 'paused' | 'cancelled'): void;
	takeover(taskId: string, target: BrowserPageTarget): Promise<void>;
	confirmation(taskId: string): { taskId: string; review: BrowserActionReview } | undefined;
	decide(taskId: string, reviewId: string, allowed: boolean): void;
	retrySave(): Promise<void>;
	subscribe(listener: () => void): () => void;
}

/** Open a web page in NAND's browser (service `browser.open`). */
export interface BrowserOpener {
	/** Resolves with the page id; rejects with a localized message when the page cannot open. */
	open(request: BrowserOpenRequest): Promise<string>;
	/** For commands and buttons: like `open`, but reports failures as a notice. */
	show(request: BrowserOpenRequest): Promise<void>;
}

/**
 * The local browser bridge for agent sessions (service `browser.agent-bridge`). `environment()` is empty
 * unless "Let agent sessions use the browser" is on, so ordinary terminals never start the bridge.
 */
export interface BrowserAgentBridge {
	environment(): Promise<Record<string, string>>;
}

export const BROWSER_OPEN = serviceKey<BrowserOpener>('browser', 'open');
export const BROWSER_PROFILES = serviceKey<BrowserProfiles>('browser', 'profiles');
export const BROWSER_CONTROL = serviceKey<BrowserControl>('browser', 'control');
export const BROWSER_WORKSPACE = serviceKey<BrowserWorkspace>('browser', 'workspace');
export const BROWSER_ASSISTANT = serviceKey<BrowserAssistant>('browser', 'assistant');
export interface BrowserWorkflowService {
	initialize(): Promise<void>;
	definitions(): BrowserWorkflowSpec[];
	records(): WorkflowExecution[];
	save(spec: BrowserWorkflowSpec, expected?: BrowserWorkflowSpec): Promise<BrowserWorkflowSpec>;
	saveVerified(runId: string): Promise<void>;
	review(workflowId: string, inputs: Record<string, unknown>, scope: BrowserWorkflowAction['scope']): Promise<WorkflowReview>;
	invoke(reviewId: string): Promise<AutomationWorkflowReceipt>;
	pause(runId: string): void;
	resume(runId: string): Promise<void>;
	cancel(runId: string): Promise<void>;
	subscribe(listener: () => void): () => void;
}
export const BROWSER_WORKFLOWS = serviceKey<BrowserWorkflowService>('browser', 'workflows');
export interface BrowserExternalAccess {
	list(): ExternalAccessGrant[];
	create(request: ExternalAccessRequest): Promise<{ grant: ExternalAccessGrant; environment: Readonly<Record<string, string>> }>;
	revoke(id: string): void;
	subscribe(listener: () => void): () => void;
}
export const BROWSER_EXTERNAL_ACCESS = serviceKey<BrowserExternalAccess>('browser', 'external-access');
export const BROWSER_AGENT_BRIDGE = serviceKey<BrowserAgentBridge>('browser', 'agent-bridge');
