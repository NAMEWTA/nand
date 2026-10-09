import { Setting } from 'obsidian';
import { normalizeValues } from '../core/resources';
import { t } from '../../../shared/i18n';

const label = (key: string) => t('contacts.' + key);
export interface FormField {
	input: HTMLElement;
	error: HTMLElement;
}
export function fieldSetting(parent: HTMLElement, name: string): Setting {
	const setting = new Setting(parent).setName(label(name));
	setting.nameEl.id = 'nand-field-' + crypto.randomUUID();
	return setting;
}
export function labelInput(setting: Setting, input: HTMLElement): void {
	input.setAttribute('aria-labelledby', setting.nameEl.id);
}
export function fieldError(setting: Setting, input: HTMLElement): FormField {
	const error = setting.settingEl.createDiv({ cls: 'nand-contacts-field-error', attr: { role: 'alert' } });
	error.id = 'nand-error-' + crypto.randomUUID();
	input.setAttribute('aria-describedby', error.id);
	return { input, error };
}
/** Multi-value text fields stay strings, including leading zeroes and international prefixes. */
export function multiValueField(
	parent: HTMLElement,
	name: string,
	initial: string[],
	update: (values: string[]) => void,
	chips = false,
): FormField {
	const setting = fieldSetting(parent, name);
	setting.settingEl.addClass('nand-contacts-multi-setting');
	const host = setting.controlEl.createDiv({ cls: 'nand-contacts-multi' });
	let values = [...initial];
	if (chips) {
		const tags = host.createDiv({ cls: 'nand-contacts-chips' });
		const entry = host.createDiv({ cls: 'nand-contacts-value-row' });
		const input = entry.createEl('input', { type: 'text' });
		labelInput(setting, input);
		const add = entry.createEl('button', {
			text: label('addItem'),
			cls: 'nand-ui-btn nand-ui-btn-ghost',
			attr: { type: 'button' },
		});
		let composing = false;
		const changed = () => update(normalizeValues([...values, input.value]));
		const paint = () => {
			tags.empty();
			for (const value of values) {
				const tag = tags.createSpan({ cls: 'nand-ui-badge nand-contacts-value-chip' });
				tag.createSpan({ text: value });
				const remove = tag.createEl('button', {
					text: '×',
					attr: { type: 'button', 'aria-label': label('removeItem') + ': ' + value },
				});
				remove.addEventListener('click', () => {
					values = values.filter((item) => item !== value);
					paint();
					changed();
				});
			}
		};
		const commit = () => {
			if (composing) return;
			values = normalizeValues([...values, input.value]);
			input.value = '';
			paint();
			changed();
		};
		input.addEventListener('compositionstart', () => {
			composing = true;
		});
		input.addEventListener('compositionend', () => {
			composing = false;
			changed();
		});
		input.addEventListener('input', changed);
		input.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' && !event.isComposing && !composing) {
				event.preventDefault();
				commit();
			}
		});
		input.addEventListener('paste', (event) => {
			const value = event.clipboardData?.getData('text');
			if (value?.includes('\n')) {
				event.preventDefault();
				values = normalizeValues([...values, input.value, value]);
				input.value = '';
				paint();
				changed();
			}
		});
		add.addEventListener('click', commit);
		paint();
		return fieldError(setting, input);
	}
	const rows = host.createDiv();
	const add = host.createEl('button', {
		text: label('addItem'),
		cls: 'nand-ui-btn nand-ui-btn-ghost',
		attr: { type: 'button' },
	});
	let first!: HTMLInputElement;
	const paint = (focus = -1) => {
		rows.empty();
		if (!values.length) values = [''];
		values.forEach((value, index) => {
			const row = rows.createDiv({ cls: 'nand-contacts-value-row' });
			const input = row.createEl('input', { type: 'text', value });
			labelInput(setting, input);
			if (index === 0) first = input;
			input.addEventListener('input', () => {
				values[index] = input.value;
				update(normalizeValues(values));
			});
			input.addEventListener('paste', (event) => {
				const text = event.clipboardData?.getData('text');
				if (text?.includes('\n')) {
					event.preventDefault();
					values.splice(index, 1, ...normalizeValues([text]));
					values = normalizeValues(values);
					paint(index);
					update(values);
				}
			});
			const remove = row.createEl('button', {
				text: '×',
				cls: 'nand-ui-icon-btn',
				attr: { type: 'button', 'aria-label': label('removeItem') + ': ' + label(name) + ' ' + (index + 1) },
			});
			remove.addEventListener('click', () => {
				values.splice(index, 1);
				paint(Math.max(0, index - 1));
				update(normalizeValues(values));
			});
			if (index === focus) input.focus();
		});
	};
	add.addEventListener('click', () => {
		values.push('');
		paint(values.length - 1);
	});
	paint();
	return fieldError(setting, first);
}
