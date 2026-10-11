/** Inventory follows ownership: durable guides are bilingual, captured/workflow artifacts retain their language. */
export function documentationKind(rel) {
	if (rel === 'NOTICE' || rel === 'THIRD-PARTY-NOTICES.md' || rel.endsWith('/NOTICE.txt')) return 'license';
	if (rel.startsWith('docs/')) return 'user-doc';
	if (/^(README|CHANGELOG|CLAUDE|SECURITY)(\.ZH)?\.md$/.test(rel)) return 'root-entry';
	if (rel === 'AGENTS.md') return 'agent-handbook';
	if (rel.startsWith('.agents/')) return 'skill';
	if (/^speculo\/\.speculo\/specdev\/(?:changes|archive)\//.test(rel)) return 'specdev-change';
	if (rel.startsWith('speculo/.speculo/specdev/')) return 'specdev';
	if (rel.startsWith('speculo/')) return 'speculo-tooling';
	if (rel.startsWith('src/')) return 'source-template';
	if (rel.startsWith('scripts/')) return 'script-doc';
	if (rel.startsWith('test/')) return 'test-fixture';
	if (rel.startsWith('processes/')) return 'process-doc';
	if (rel.startsWith('.github/')) return 'workflow-doc';
	return '';
}

/** Captured issue titles contain literal adjacent labels. Body links and all inline URLs still get checked. */
export function referenceLinkBody(file, body) {
	const metadata = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(body)?.[1] ?? '';
	if (documentationKind(file) !== 'specdev-change' || !/^artifact:\s*["']?source["']?\s*$/m.test(metadata) || !/^source_type:\s*["']?github-issue["']?\s*$/m.test(metadata)) return body;
	return body.replace(/^# Source: #\d+ [^\r\n]*$/m, '');
}
