import { expect, test } from 'vitest';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { documentationKind, referenceLinkBody } from '../../scripts/documentation-policy.mjs';

test('current project guides have one Chinese source, with only the root README bilingual', () => {
	const copies: string[] = [];
	const walk = (directory: string) => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const file = path.join(directory, entry.name);
			if (entry.isDirectory()) walk(file);
			else if (entry.isFile() && entry.name.endsWith('.ZH.md')) copies.push(file);
		}
	};
	walk('docs');
	expect(copies).toEqual([]);
	for (const file of ['CHANGELOG.ZH.md', 'SECURITY.ZH.md']) expect(existsSync(file) && lstatSync(file).isFile()).toBe(false);
	expect(existsSync('README.md') && existsSync('README.ZH.md')).toBe(true);
	for (const [file, heading] of [['docs/data.md', '# 数据与恢复'], ['docs/privacy.md', '# 隐私与数据边界'], ['docs/agent-workbench.md', '# 智能体工作台']]) expect(readFileSync(file!, 'utf8')).toContain(heading);
});

test('change artifacts retain source language while permanent knowledge and third-party guides keep their guide contracts', () => {
	expect(documentationKind('speculo/.speculo/specdev/changes/example/ticket/01.md')).toBe('specdev-change');
	expect(documentationKind('speculo/.speculo/specdev/archive/2026-10/example/source.md')).toBe('specdev-change');
	expect(documentationKind('speculo/.speculo/specdev/context/current-baseline.md')).toBe('specdev');
	expect(documentationKind('speculo/.speculo/specdev/.config/domain-layout.ZH.md')).toBe('specdev');
	expect(documentationKind('docs/third-party/aihot-news.md')).toBe('user-doc');
	expect(documentationKind('THIRD-PARTY-NOTICES.md')).toBe('license');
});

test('only captured GitHub issue title labels are literal; body references and ordinary document headings stay checked', () => {
	const file = 'speculo/.speculo/specdev/changes/example/source.md';
	const title = '# Source: #136 [News][Feature] Title';
	const body = `---\nartifact: "source"\nsource_type: "github-issue"\n---\n\n${title}\n\n[Read more][missing]\n[Source](https://example.com/)\n`;
	const checked = referenceLinkBody(file, body);
	expect(checked).not.toContain('[News][Feature]');
	expect(checked).toContain('[Read more][missing]');
	expect(checked).toContain('[Source](https://example.com/)');
	expect(referenceLinkBody('docs/guide.md', body)).toBe(body);
	expect(referenceLinkBody(file, body.replace('github-issue', 'local-file'))).toBe(body.replace('github-issue', 'local-file'));
	expect(referenceLinkBody(file, body.replace('artifact: "source"', 'artifact: "spec"'))).toContain(title);
	expect(referenceLinkBody(file, body.replace(title, '# Requirements [News][Feature]'))).toContain('# Requirements [News][Feature]');
});
