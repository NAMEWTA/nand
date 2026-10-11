import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { describe, test } from 'vitest';
import { setLanguage } from '../../shared/i18n';
import { bindLocalizedOptions, refreshLocalizedDom } from './localized-dom';

describe('localized dropdown refresh', () => {
	test('a language change refreshes native measurement without changing selection or adding a listener', () => {
		const { document } = parseHTML('<!doctype html><body><select><option value="en">English</option></select></body>');
		try {
			const select = document.querySelector('select');
			assert.ok(select);
			let visible = true;
			Object.assign(select, { getClientRects: () => visible ? [{}] : [] });
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
			let measured = '';
			bindLocalizedOptions({ selectEl: select as unknown as HTMLSelectElement, getValue: () => selected, setValue(value: string) { selected = value; measured = option.textContent ?? ''; return this; } }, { en: ['news.title'] });
			const before = option.textContent;
			const listeners = select.addEventListener;
			let added = 0;
			select.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
				added += 1;
				return listeners.call(select, type, listener, options);
			}) as typeof select.addEventListener;
			setLanguage('zh');
			const root = select.parentElement ?? document.documentElement;
			visible = false;
			refreshLocalizedDom(root);
			assert.equal(measured, before, 'Hidden controls wait until the page can be measured');
			visible = true;
			refreshLocalizedDom(root);
			assert.notEqual(option.textContent, before);
			assert.equal(measured, option.textContent);
			assert.equal(select.value, 'en');
			assert.equal(added, 0);
		} finally {
			setLanguage('en');
		}
	});
});
