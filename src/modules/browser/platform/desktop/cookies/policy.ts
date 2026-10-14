// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/main/browser/browser-cookie-import-policy.ts
export function normalizeCookieDomain(domain: string): string | null {
	const candidate = domain.trim().replace(/^\.+/, '');
	const ipv6 = candidate.startsWith('[') && candidate.endsWith(']');
	if (!candidate || /[/\\@?#%\s]/.test(candidate) || (!ipv6 && candidate.includes(':'))) return null;
	try {
		const u = new URL(`https://${candidate}/`),
			host = u.hostname.toLowerCase();
		if (u.username || u.password || u.port || host.endsWith('.') || host.includes('..')) return null;
		if (
			!ipv6 &&
			!host.split('.').every((label) => label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))
		)
			return null;
		return host;
	} catch {
		return null;
	}
}
export function isNonTransplantableCookieDomain(domain: string): boolean {
	const host = normalizeCookieDomain(domain);
	return host === 'google.com' || host?.endsWith('.google.com') === true;
}
/** Exact imported domains and their descendants; never unrelated siblings or parent domains. */
export function domainIsInImportedScope(domains: readonly string[], domain: string): boolean {
	const host = normalizeCookieDomain(domain);
	return (
		!!host && !isNonTransplantableCookieDomain(host) && domains.some((d) => host === d || host.endsWith(`.${d}`))
	);
}
