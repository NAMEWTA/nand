/** Credentials belong to Git's credential helper or SSH agent, never a URL saved by NAND. */
export function hasEmbeddedCredentials(value: string): boolean {
	if (!value.includes('://')) return false;
	try {
		const url = new URL(value);
		return !!url.password || !!url.search || !!url.hash || ((url.protocol === 'https:' || url.protocol === 'http:') && !!url.username);
	} catch {
		return true;
	}
}
