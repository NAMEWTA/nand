/** Presentation only: maps a run/definition status to a semantic badge tone. */
export const STATUS_TONE: Record<string, string> = {
	succeeded: 'success',
	failed: 'error',
	running: 'info',
	unknown: 'info',
	cancelled: 'warning',
	interrupted: 'warning',
};
export const badge = (tone?: string) => `nand-ui-badge${tone ? ` nand-ui-badge--${tone}` : ''}`;
export const statusBadge = (status: string) => badge(STATUS_TONE[status]);

