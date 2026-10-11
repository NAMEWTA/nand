/** Methods the local bridge may run. Anything else is out of scope. */
export const BRIDGE_SCOPE = [
	'tab.list', 'tab.create', 'tab.close', 'tab.switch',
	'snapshot', 'goto', 'back', 'forward', 'reload', 'stop', 'screenshot', 'console', 'network', 'viewport', 'scroll', 'wait',
	'click', 'dblclick', 'hover', 'drag', 'fill', 'type', 'focus', 'select', 'check', 'get', 'keypress',
] as const;

/** The bridge is off unless enabled. Expired, revoked and out-of-scope calls do nothing. */
export function admitBridge(input: {
	enabled: boolean;
	tokenOk: boolean;
	scope: readonly string[];
	method: string;
	expiresAt: number;
	revoked: boolean;
	now: number;
}): { allowed: boolean; reason?: 'disabled' | 'unauthorized' | 'expired' | 'revoked' | 'scope' } {
	if (!input.enabled) return { allowed: false, reason: 'disabled' };
	if (input.revoked) return { allowed: false, reason: 'revoked' };
	if (input.now >= input.expiresAt) return { allowed: false, reason: 'expired' };
	if (!input.tokenOk) return { allowed: false, reason: 'unauthorized' };
	if (!input.scope.includes(input.method)) return { allowed: false, reason: 'scope' };
	return { allowed: true };
}
