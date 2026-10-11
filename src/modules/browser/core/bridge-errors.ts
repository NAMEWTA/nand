import { BrowserError } from './model';

/** Public IPC failures contain symbolic guidance, never native exception text or request values. */
export function bridgeFailure(error: unknown): { code: string; message: string; reason: string; retryAction: string } {
	const code = error instanceof BrowserError && /^browser_[a-z\d_]{1,80}$/.test(error.code) ? error.code : 'browser_failed';
	let reason = 'operation-failed', retryAction = 'check-page';
	if (['browser_unauthorized', 'browser_disabled', 'browser_scoped_grant_revoked', 'browser_scoped_grant_expired', 'browser_scoped_grant_limit'].includes(code)) {
		reason = 'authorization-unavailable'; retryAction = 'request-new-grant';
	} else if (code === 'browser_scoped_grant_scope') { reason = 'outside-authorized-scope'; retryAction = 'choose-authorized-page-and-operation'; }
	else if (['browser_stale_ref', 'browser_scoped_grant_stale'].includes(code)) { reason = 'stale-observation'; retryAction = 'take-new-snapshot'; }
	else if (['browser_stale_target', 'browser_page_not_live', 'browser_page_closed'].includes(code)) { reason = 'page-unavailable'; retryAction = 'review-pages-and-request-new-grant'; }
	else if (code === 'browser_workspace_busy') { reason = 'page-owned'; retryAction = 'wait-for-owner'; }
	else if (['browser_action_denied', 'browser_action_review_changed', 'browser_action_review_expired'].includes(code)) { reason = 'confirmation-required'; retryAction = 'review-in-browser'; }
	else if (code === 'browser_workspace_draft_changed') { reason = 'page-draft-changed'; retryAction = 'review-current-draft'; }
	return { code, message: code, reason, retryAction };
}
