import { t } from '../../shared/i18n';

type Params = Record<string, string | number>;
/** Explicit bindings only: never infer translations from user-authored DOM text. */
export function localizedAttributes(key: string, params?: Params, attribute = 'aria-label'): Record<string, string> {
	const value = t(key, params);
	return { [attribute]: value, [`data-nand-i18n-${attribute}`]: JSON.stringify([key, params, value]) };
}
export function localizedText(key: string, params?: Params): { text: string; attr: Record<string, string> } {
	const text = t(key, params);
	return { text, attr: { 'data-nand-i18n-text': JSON.stringify([key, params, text]) } };
}
export function setLocalizedText(element: HTMLElement, key: string, params?: Params): void {
	element.setAttribute('data-nand-i18n-text', JSON.stringify([key, params, t(key, params)]));
	element.textContent = t(key, params);
}
export function setLocalizedAttribute(element: HTMLElement, attribute: string, key: string, params?: Params): void {
	for (const [name, value] of Object.entries(localizedAttributes(key, params, attribute)))
		element.setAttribute(name, value);
}
export function bindLocalizedElement<T extends HTMLElement>(
	element: T,
	key: string,
	params?: Params,
	attribute = 'text',
): T {
	if (attribute === 'text') setLocalizedText(element, key, params);
	else setLocalizedAttribute(element, attribute, key, params);
	return element;
}
/** Native controls expose their label elements; binding never changes their values or callbacks.
 * Pass the control itself: native modal setters can return void rather than this.
 */
export function bindLocalizedControl<T extends object>(
	control: T,
	field: 'name' | 'desc' | 'buttonText' | 'placeholder' | 'tooltip' | 'title',
	key: string,
	params?: Params,
): T {
	const elements = control as {
		nameEl?: HTMLElement;
		descEl?: HTMLElement;
		buttonEl?: HTMLElement;
		extraSettingsEl?: HTMLElement;
		inputEl?: HTMLElement;
		titleEl?: HTMLElement;
	};
	const element =
		field === 'name'
			? elements.nameEl
			: field === 'desc'
				? elements.descEl
				: field === 'placeholder'
					? elements.inputEl
					: field === 'title'
						? elements.titleEl
						: (elements.buttonEl ?? elements.extraSettingsEl);
	if (element)
		bindLocalizedElement(
			element,
			key,
			params,
			field === 'tooltip' ? 'aria-label' : field === 'placeholder' ? 'placeholder' : 'text',
		);
	return control;
}
export function bindLocalizedOptions<T>(control: T, bindings: Record<string, [string, Params?]>): T {
	const select = (control as { selectEl?: HTMLSelectElement }).selectEl;
	if (select) {
		select.setAttribute('data-nand-i18n-options', 'true');
		for (const option of Array.from(select.options)) {
			const binding = bindings[option.value];
			if (binding) setLocalizedText(option, binding[0], binding[1]);
		}
		// Obsidian's native dropdown measures its longest option lazily. Force a
		// layout pass after replacing labels while preserving the selected value.
		const value = select.value;
		select.setCssProps({ width: '' });
		void select.offsetWidth;
		select.value = value;
	}
	return control;
}
export function refreshLocalizedDom(root: HTMLElement): void {
	for (const element of [
		root,
		...Array.from(
			root.querySelectorAll<HTMLElement>(
				'[data-nand-i18n-text], [data-nand-i18n-aria-label], [data-nand-i18n-placeholder], [data-nand-i18n-title]',
			),
		),
	]) {
		for (const attribute of Array.from(element.attributes)) {
			if (!attribute.name.startsWith('data-nand-i18n-')) continue;
			const target = attribute.name.slice('data-nand-i18n-'.length);
			if (!['text', 'aria-label', 'placeholder', 'title'].includes(target)) continue;
			let binding: [string, Params | undefined, string];
			try {
				binding = JSON.parse(attribute.value) as typeof binding;
			} catch {
				continue;
			}
			if (!Array.isArray(binding) || typeof binding[0] !== 'string') continue;
			const [key, params, previous] = binding;
			// A loading label may later become a result tree or user text. It no longer owns that content.
			if (
				(target === 'text' && element.children.length > 0) ||
				(target === 'text' ? element.textContent : element.getAttribute(target)) !== previous
			) {
				element.removeAttribute(attribute.name);
				continue;
			}
			const value = t(key, params);
			if (target === 'text') element.textContent = value;
			else element.setAttribute(target, value);
			element.setAttribute(attribute.name, JSON.stringify([key, params, value]));
		}
	}
	for (const select of [root, ...Array.from(root.querySelectorAll<HTMLSelectElement>('select[data-nand-i18n-options]'))]) {
		if (!select.instanceOf(HTMLSelectElement)) continue;
		const value = select.value;
		select.setCssProps({ width: '' });
		void select.offsetWidth;
		select.value = value;
	}
}
