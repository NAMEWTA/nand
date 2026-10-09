import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'vitest';

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
import { NandSettingTab } from './entry-tab';

function definitionNames(): string[] {
	const tab = Object.create(NandSettingTab.prototype) as NandSettingTab;
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

test('the Obsidian settings tab is a short entry point into the workbench settings', () => {
	try {
		for (const [language, open, home] of [['zh', 'NAND 设置', '全局设置'], ['en', 'NAND settings', 'Global settings']] as const) {
			setLanguage(language);
			const names = definitionNames();
			assertUnique(names);
			assert.equal(names[0], open);
			assert.ok(names.includes(home), `${language}: ${names.join(', ')}`);
			assert.equal(names.length, 2);
		}
	} finally {
		setLanguage('zh');
	}
});
