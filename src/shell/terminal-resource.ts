/** What a terminal navigation may do. A missing PTY is not a missing note. */
export interface TerminalNavigationPlan {
	selectId?: string;
	openSection: boolean;
}

/**
 * Terminal ids live only as long as the process. Restarted workspaces still
 * contain the last id; opening that id must show the session section.
 */
export function planTerminalNavigation(
	resourceId: string | undefined,
	sessionExists: boolean,
	aborted: boolean,
): TerminalNavigationPlan {
	if (aborted) return { openSection: false };
	return { selectId: resourceId && sessionExists ? resourceId : undefined, openSection: true };
}
