/** Static read-only program. Neither the page nor a model can supply the comparison program. */
export const READ_ACTION_REVIEW = function (this: HTMLElement) {
	if (!this.isConnected || !this.getClientRects().length || this.hasAttribute('disabled') || this.getAttribute('aria-disabled') === 'true')
		throw Error('unavailable control');
	const doc = this.ownerDocument, form = (this as HTMLButtonElement).form ?? this.closest('form');
	const container = form ?? this.closest('[role="dialog"],dialog') ?? doc.body;
	const credential = /password|secret|token|api[-_]?key|one[-_]?time[-_]?code|cc-number|cc-csc|credit.?card|card.?number/i;
	const elements = [...container.querySelectorAll<HTMLElement>('input,textarea,select,[contenteditable="true"]')];
	if (elements.length > 100) throw Error('review too large');
	const fields = elements.filter(element => element.getAttribute('type') !== 'hidden' && element.getClientRects().length).map(element => {
		const input = element as HTMLInputElement;
		const type = input.type || element.getAttribute('type') || element.tagName.toLowerCase();
		const label = input.labels?.[0]?.cloneNode(true) as HTMLElement | undefined;
		label?.querySelectorAll('input,textarea,select,[contenteditable]').forEach(control => control.remove());
		const name = element.getAttribute('aria-label') || label?.textContent?.trim() || input.name || element.id;
		const purpose = [name, element.getAttribute('autocomplete'), type].join(' ');
		if (credential.test(purpose)) throw Error('manual sensitive action');
		const value = element.isContentEditable ? element.innerText : input.value ?? '';
		if (value.length > 20_000) throw Error('review too large');
		return { name, type, value, ...(['checkbox', 'radio'].includes(type) ? { checked: input.checked } : {}) };
	});
	const content = container.innerText;
	if (content.length > 40_000) throw Error('review too large');
	const link = this.closest<HTMLAnchorElement>('a[href]');
	const destination = link?.href || this.getAttribute('formaction') || form?.getAttribute('action');
	return {
		frameUrl: doc.location.href,
		object: { tag: this.tagName, role: this.getAttribute('role') ?? '',
			name: this.getAttribute('aria-label') || this.innerText || this.getAttribute('value') || '', type: this.getAttribute('type') ?? '' },
		destination: destination ? new URL(destination, doc.location.href).href : '',
		method: this.getAttribute('formmethod') || form?.getAttribute('method') || '',
		content, fields,
	};
}.toString();
