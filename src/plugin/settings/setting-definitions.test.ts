import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';

const nodeRequire = createRequire(path.join(process.cwd(), 'package.json'));
(globalThis as unknown as { window: { require: NodeRequire } }).window = { require: nodeRequire };
class SvgElement {}
const activeDocument = {
	createElementNS: () => {
		const svg = new El('svg');
		return Object.assign(svg, { instanceOf: (ctor: unknown) => ctor === SvgElement });
	},
	createElement: () => new El('div'),
	importNode: (node: El) => node,
};
(globalThis as unknown as { activeDocument: typeof activeDocument }).activeDocument = activeDocument;
(globalThis as unknown as { DOMParser: new () => { parseFromString: () => { documentElement: El } } }).DOMParser =
	class {
		parseFromString() {
			const svg = new El('svg');
			return { documentElement: Object.assign(svg, { instanceOf: (ctor: unknown) => ctor === SvgElement }) };
		}
	};
(globalThis as unknown as { SVGSVGElement: typeof SvgElement }).SVGSVGElement = SvgElement;

import { El } from '../../../scripts/mini-dom';
import { setLanguage, type Language } from '../../shared/i18n/runtime';
import { DashboardSettingTab } from './settings-tab';

function definitionNames(): string[] {
	const tab = Object.create(DashboardSettingTab.prototype) as DashboardSettingTab;
	Object.assign(tab, { plugin: { iconicHost: { isActive: () => true } } });
	const names: string[] = [];
	const walk = (node: unknown): void => {
		if (!node || typeof node !== 'object') return;
		if (Array.isArray(node)) {
			for (const item of node) walk(item);
			return;
		}
		const record = node as { name?: unknown; items?: unknown };
		if (typeof record.name === 'string') names.push(record.name);
		if (record.items) walk(record.items);
	};
	walk(tab.getSettingDefinitions());
	return names;
}

function assertUnique(names: string[]): void {
	const seen = new Set<string>();
	for (const name of names) {
		assert.equal(seen.has(name), false, `duplicate setting name ${name}`);
		seen.add(name);
	}
}

test('declarative setting names are unique in both languages', () => {
	const previous = 'zh' as Language;
	try {
		setLanguage('zh');
		const zh = definitionNames();
		assertUnique(zh);
		assert.ok(zh.includes('资料与显示'));
		assert.equal(zh.includes('settings.widgetTheme'), false);
		assert.equal(zh.filter((name) => name === '通用').length, 1);
		assert.equal(zh.includes('导航'), true);
		assert.ok(zh.indexOf('导航') < zh.indexOf('规则书'));
		assert.equal(zh.includes('快捷与天气'), true);
		assert.equal(zh.includes('其余小组件'), true);

		setLanguage('en');
		const en = definitionNames();
		assertUnique(en);
		assert.ok(en.includes('Storage and display'));
		assert.equal(en.includes('settings.widgetTheme'), false);
		assert.equal(en.filter((name) => name === 'General').length, 1);
		assert.equal(en.includes('Navigation'), true);
		assert.equal(en.includes('Quick actions and weather'), true);
		assert.equal(en.includes('Other widgets'), true);
	} finally {
		setLanguage(previous);
	}
});

test('language is searchable on Home, independently of dashboard availability', () => {
	const tab = Object.create(DashboardSettingTab.prototype) as DashboardSettingTab;
	Object.assign(tab, { plugin: { iconicHost: { isActive: () => false } } });
	for (const language of ['zh', 'en'] as const) {
		setLanguage(language);
		const definitions = tab.getSettingDefinitions() as Array<{ items?: Array<{ name?: string; aliases?: string[]; searchable?: boolean }> }>;
		const rows = definitions.flatMap((group) => group.items ?? []);
		const alias = language === 'zh' ? '语言（Language）' : 'Language';
		const matches = rows.filter((row) => row.aliases?.includes(alias));
		assert.equal(matches.length, 1);
		assert.equal(matches[0]?.name, language === 'zh' ? '全局设置' : 'Global settings');
		assert.notEqual(matches[0]?.searchable, false);
	}
	setLanguage('zh');
});
