export type ChordHit = { inside: boolean; address: boolean; find: boolean; toolbar: boolean; page: boolean };

/** Address and find win over the toolbar. The page and anything outside the panel do not. */
export function browserFocusTarget(hit: ChordHit): 'address' | 'toolbar' | 'find' | 'page' | 'outside' {
	if (!hit.inside) return 'outside';
	if (hit.address) return 'address';
	if (hit.find) return 'find';
	if (hit.toolbar) return 'toolbar';
	if (hit.page) return 'page';
	return 'outside';
}
