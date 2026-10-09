import { t } from '../../../shared/i18n';
import type { WorkbenchTarget } from '../../../app/contracts/workbench';

export interface ContactsNavigationSurface {
	controller?: {
		ensureLoaded(): Promise<void>;
		index: {
			get(id: string): { kind: 'person' | 'company'; path: string } | undefined;
			byPath: { get(path: string): { kind: 'person' | 'company'; path: string } | undefined };
		};
	};
	changeKind(kind: 'person' | 'company'): void;
	select(path: string): void;
	/** Leave an open record form (it asks about unsaved changes). */
	leaveEditor?(): void;
}

/** A record's own kind wins over the requested group. A group with no record opens that list. */
export async function navigateContacts(surface: ContactsNavigationSurface, target: WorkbenchTarget, signal: AbortSignal): Promise<void> {
	if (signal.aborted) return;
	surface.leaveEditor?.();
	if (target.resourceId) {
		await surface.controller?.ensureLoaded();
		if (signal.aborted) return;
		const record = surface.controller?.index.get(target.resourceId) ?? surface.controller?.index.byPath.get(target.resourceId);
		if (!record) throw new Error(t('workbench.missing'));
		surface.changeKind(record.kind);
		if (signal.aborted) return;
		surface.select(record.path);
		return;
	}
	if (target.section === 'person' || target.section === 'company') surface.changeKind(target.section);
}
