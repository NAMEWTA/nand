import type { HomeHost } from '../../services/home-host';
/** Keep React, the dialog and its recipes behind the command's actual invocation. */
export async function openAppearanceStudio(host: HomeHost, doc: Document): Promise<() => void> {
	const [{ AppearanceStudio }, { openRecordOverlay }] = await Promise.all([
		import('./AppearanceStudio'),
		import('../dialogs/open-record-dialog'),
	]);
	return openRecordOverlay(doc, (close) => <AppearanceStudio host={host} onClose={close} />);
}
