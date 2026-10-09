import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { describe, test } from 'vitest';
import { setLanguage } from '../../shared/i18n';
import { refreshLocalizedDom, setLocalizedText } from './localized-dom';

describe('localized dropdown refresh', () => {
	test('a language change refreshes the label and clears the width without adding a listener', () => {
		const { document, HTMLElement, HTMLSelectElement } = parseHTML('<!doctype html><body><select data-nand-i18n-options="true" style="width: 240px"><option value="en">English</option></select></body>');
		const previous = { HTMLElement: globalThis.HTMLElement, HTMLSelectElement: globalThis.HTMLSelectElement };
		Object.assign(globalThis, { HTMLElement, HTMLSelectElement });
		const proto = HTMLElement.prototype as unknown as {
			instanceOf: (ctor: new () => object) => boolean;
			setCssProps: (props: Record<string, string>) => void;
		};
		proto.instanceOf = function instanceOf(this: HTMLElement, ctor: new () => object) {
			return this instanceof ctor;
		};
		proto.setCssProps = function setCssProps(this: HTMLElement, props: Record<string, string>) {
			for (const [key, value] of Object.entries(props)) this.style.setProperty(key, value);
		};
		try {
			const select = document.querySelector('select');
			assert.ok(select);
			const option = select.querySelector('option');
			assert.ok(option);
			let selected = 'en';
			Object.defineProperty(select, 'value', {
				configurable: true,
				get: () => selected,
				set: (value: string) => {
					selected = String(value);
				},
			});
			setLanguage('en');
			setLocalizedText(option, 'news.title');
			const before = option.textContent;
			select.style.width = '240px';
			const listeners = select.addEventListener;
			let added = 0;
			select.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
				added += 1;
				return listeners.call(select, type, listener, options);
			}) as typeof select.addEventListener;
			setLanguage('zh');
			const root = select.parentElement ?? document.documentElement;
			refreshLocalizedDom(root);
			refreshLocalizedDom(root);
			assert.notEqual(option.textContent, before);
			assert.equal(select.style.width, '');
			assert.equal(select.value, 'en');
			assert.equal(added, 0);
		} finally {
			Object.assign(globalThis, previous);
			setLanguage('en');
		}
	});
});
