import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import { transformSync } from 'esbuild';

// Execute production constructors with the native void-returning setter contract.
// This is an isolated API-contract test, not a native Obsidian rendering test.
function fixture() {
	let language = 'zh';
	const opened: SuggestModal[] = [];
	const translate = (key: string) => `${language}:${key}`;
	class Element {
		private attrs = new Map<string, string>();
		value = '';
		textContent = '';
		children: Element[] = [];
		get attributes() { return [...this.attrs].map(([name, value]) => ({ name, value })); }
		setAttribute(name: string, value: string) { this.attrs.set(name, value); }
		getAttribute(name: string) { return this.attrs.get(name) ?? null; }
		removeAttribute(name: string) { this.attrs.delete(name); }
		querySelectorAll() { return []; }
	}
	class Modal {
		constructor(readonly app: unknown) {}
		onClose() {}
	}
	class SuggestModal extends Modal {
		inputEl = new Element();
		setPlaceholder(value: string): void { this.inputEl.setAttribute('placeholder', value); }
		open() { opened.push(this); }
		close() { this.onClose(); }
	}
	class FuzzySuggestModal extends SuggestModal {}
	const native = { Modal, SuggestModal, FuzzySuggestModal, MarkdownView: class {}, Notice: class {}, Setting: class {}, setIcon() {} };
	let bindings: Record<string, (...args: unknown[]) => unknown> = {};
	function load(file: string, extra = ''): Record<string, any> {
		const source = readFileSync(path.resolve(file), 'utf8') + extra;
		const { code } = transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2022' });
		const module = { exports: {} };
		vm.runInNewContext(code, {
			module, exports: module.exports, queueMicrotask, Promise,
			require: (name: string) => {
				if (name === 'obsidian') return native;
				if (name.endsWith('/localized-dom')) return bindings;
				if (name.endsWith('/terminal-accessor')) return { t: (key: string) => translate(`terminalAgent.${key}`) };
				if (/\/shared\/i18n(?:\/index)?$/.test(name)) return { t: translate };
				if (name === './labels') return { ct: (key: string) => translate(`contacts.${key}`) };
				if (name === './session-label') return { sessionLabel: () => 'session' };
				return {};
			},
		}, { filename: file });
		return module.exports;
	}
	bindings = load('src/view/primitives/localized-dom.ts');
	return { load, opened, translate, bindings, language: (next: string) => { language = next; } };
}

const cases = [
	['src/view/terminal/recent-session-modal.ts', 'RecentSessionModal', 'terminalAgent.workbench.searchSessions', []],
	['src/view/automations/session-picker.ts', 'AutomationSessionPicker', 'automation.sessions', []],
	['src/view/dashboard/ui/icon-picker-modal.ts', 'IconPickerModal', 'quickNote.iconPickerPlaceholder', null],
	['src/view/contacts/forms.ts', 'RecordPicker', 'contacts.searchPeople', ['person']],
	['src/view/contacts/forms.ts', 'RecordPicker', 'contacts.searchCompanies', ['company']],
	['src/view/dashboard/appearance/theme-studio-modal.ts', 'ImageFileSuggestModal', 'themeStudio.bg.browsePlaceholder', null],
] as const;

for (const [file, name, key, kind] of cases) {
	test(`${name} ${key}: constructor and live placeholder respect the native API contract`, () => {
		const f = fixture();
		const extra = name === 'RecordPicker' || name === 'ImageFileSuggestModal' ? `\nexport { ${name} };\n` : '';
		const Picker = f.load(file, extra)[name];
		const choose = () => {};
		const picker = kind === null ? new Picker({}, choose)
			: name === 'RecordPicker' ? new Picker({}, [], kind[0], choose)
				: new Picker({}, [], choose);
		assert.equal(picker.inputEl.getAttribute('placeholder'), f.translate(key));
		assert.equal(picker.setPlaceholder(f.translate(key)), undefined, 'The fixture must not invent a chainable setter');
		picker.inputEl.value = 'user search 中文';
		for (const language of ['en', 'zh']) {
			f.language(language);
			f.bindings.refreshLocalizedDom(picker.inputEl);
			assert.equal(picker.inputEl.getAttribute('placeholder'), f.translate(key));
			assert.equal(picker.inputEl.value, 'user search 中文', 'Relocalization preserves the query');
		}
	});
}

test('context material picker opens and cancellation settles without a selection', async () => {
	const f = fixture();
	const { pickContextMaterial } = f.load('src/view/terminal/context-material-picker.ts');
	const pending = pickContextMaterial({});
	assert.equal(f.opened.length, 1);
	const picker = f.opened[0]!;
	assert.equal(picker.inputEl.getAttribute('placeholder'), f.translate('terminalAgent.context.add'));
	picker.inputEl.value = 'draft search';
	f.language('en');
	f.bindings.refreshLocalizedDom(picker.inputEl);
	assert.equal(picker.inputEl.getAttribute('placeholder'), f.translate('terminalAgent.context.add'));
	assert.equal(picker.inputEl.value, 'draft search');
	picker.close();
	assert.equal(await pending, null);
});
