import { expect, test, vi } from 'vitest';
import { El } from '../../../../../scripts/mini-dom';
import { showPromptDialog } from './prompt-dialog';

test('a note prompt belongs to its board document even when the host active document is blank', async () => {
	const body = new El('body');
	const doc = { body, querySelector: () => null, addEventListener: () => {}, removeEventListener: () => {}, defaultView: { setTimeout: () => 1, clearTimeout: () => {} } };
	body.ownerDocument = doc;
	Object.assign(doc, { createElement: (tag: string) => { const element = new El(tag); element.ownerDocument = doc; return element; } });
	vi.stubGlobal('activeDocument', { body: new El('body') });
	try {
		const result = showPromptDialog(undefined, { title: 'Title', owner: { contentEl: { ownerDocument: doc } } });
		expect(body.querySelector('.dashboard-prompt-input')).toBeTruthy();
		body.querySelector('.dashboard-confirm-cancel')!.click();
		expect(await result).toBeNull();
	} finally { vi.unstubAllGlobals(); }
});
