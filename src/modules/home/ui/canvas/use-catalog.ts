import { useEffect, useState } from 'react';
import { homeServices } from '../../services/instances';

/** Bumps whenever a provider is registered, removed or changes its instances, independent of board edits and timers. */
export function useCatalogRevision(): number {
	const [revision, setRevision] = useState(0);
	useEffect(() => homeServices.watchWidgets?.(() => setRevision((value) => value + 1)), []);
	return revision;
}
