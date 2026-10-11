/** Executed on one snapshot-resolved DOM element, never on a guessed active input. */
export const READ_ELEMENT_VALUE = function (this: HTMLElement) {
	const tag = this.tagName;
	const type = this.getAttribute('type')?.toLowerCase();
	const purpose = ['id', 'name', 'autocomplete'].map(key => this.getAttribute(key) ?? '').join(' ');
	const sensitive = type === 'password' || type === 'hidden' || /password|secret|token|api[-_]?key|one[-_]?time[-_]?code/i.test(purpose);
	let value: string | undefined;
	if (!sensitive) {
		if (tag === 'INPUT' || tag === 'TEXTAREA') value = (this as HTMLInputElement | HTMLTextAreaElement).value;
		else if (this.isContentEditable) value = this.innerText;
	}
	return {
		text: sensitive ? '' : this.innerText || this.textContent || '',
		tag,
		attributes: Object.fromEntries([...this.attributes].filter(attribute => !/^value$/i.test(attribute.name)).map(attribute => [attribute.name, attribute.value])),
		...(value === undefined ? {} : { value }),
	};
}.toString();
