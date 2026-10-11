import type { BrowserSnapshotRef } from './model';

/** Runtime identity. A replacement guest cannot reuse an earlier controller's target. */
export interface BrowserPageTarget {
	readonly pageId: string;
	readonly profileId: string;
	readonly generation: string;
}
export interface BrowserPageInfo {
	target: BrowserPageTarget;
	url: string;
	title: string;
	loading: boolean;
	error: string | null;
}
export interface BrowserElementRef { revision: string; element: string }
export interface BrowserObservation {
	target: BrowserPageTarget;
	url: string;
	revision: string;
	snapshot: string;
	refs: BrowserSnapshotRef[];
}
export interface BrowserElementValue {
	text: string;
	tag: string;
	attributes: Record<string, string>;
	/** Editable text for staging readback; never supplied for password/hidden/credential fields. */
	value?: string;
}
export type BrowserPageAction =
	| { kind: 'navigate'; url: string }
	| { kind: 'reload'; bypassCache?: boolean }
	| { kind: 'back' | 'forward' | 'stop' }
	| { kind: 'click' | 'focus'; ref: BrowserElementRef }
	| { kind: 'fill'; ref: BrowserElementRef; value: string; expectedValue?: string }
	| { kind: 'type' | 'select'; ref: BrowserElementRef; value: string }
	| { kind: 'check'; ref: BrowserElementRef; checked: boolean }
	| { kind: 'keypress'; key: string; ref: BrowserElementRef };

/** A native operation returned; submitting a website message still requires observed acceptance. */
export interface BrowserActionReceipt { target: BrowserPageTarget; operation: BrowserPageAction['kind'] }
export type BrowserReviewableAction = { kind: 'click'; ref: BrowserElementRef } | { kind: 'keypress'; key: string; ref: BrowserElementRef };

/** Exact visible material reviewed by a person before a single submission-capable action. */
export interface BrowserActionReview {
	id: string;
	target: BrowserPageTarget;
	action: BrowserReviewableAction;
	expiresAt: number;
	pageUrl: string;
	frameUrl: string;
	object: { tag: string; role: string; name: string; type: string };
	destination: string;
	method: string;
	content: string;
	fields: Array<{ name: string; type: string; value: string; checked?: boolean }>;
}
