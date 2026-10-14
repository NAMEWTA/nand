import type { ImportCookie } from '../../../core/cookies';
import { normalizeCookieDomain } from './policy';
export function validateCookie(value: unknown): ImportCookie | null {
	if (!value || typeof value !== 'object') return null;
	const c = value as Record<string, unknown>;
	if (typeof c.domain !== 'string' || typeof c.name !== 'string' || typeof c.value !== 'string') return null;
	const domain = normalizeCookieDomain(c.domain);
	if (
		!domain ||
		(typeof c.expirationDate === 'number' && c.expirationDate > 0 && c.expirationDate <= Date.now() / 1000) ||
		c.name.length + c.value.length > 4096 ||
		[...c.name].some((c) => c.charCodeAt(0) <= 32 || ';,='.includes(c)) ||
		[...c.value].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
	)
		return null;
	const path = typeof c.path === 'string' && c.path.startsWith('/') && !/[\r\n]/.test(c.path) ? c.path : '/';
	const raw = c.sameSite;
	const sameSite =
		raw === 'strict'
			? 'strict'
			: raw === 'lax'
				? 'lax'
				: raw === 'no_restriction' || raw === 'none'
					? 'no_restriction'
					: 'unspecified';
	return {
		domain: (c.domain.startsWith('.') ? '.' : '') + domain,
		hostOnly: typeof c.hostOnly === 'boolean' ? c.hostOnly : !c.domain.startsWith('.'),
		name: c.name,
		value: c.value,
		path,
		secure: c.secure === true,
		httpOnly: c.httpOnly === true,
		sameSite,
		...(typeof c.expirationDate === 'number' && Number.isFinite(c.expirationDate) && c.expirationDate > 0
			? { expirationDate: c.expirationDate }
			: {}),
	};
}
