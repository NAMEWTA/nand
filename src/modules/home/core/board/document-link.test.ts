import { expect, test } from 'vitest';
import { documentLink } from './document-link';

test('document navigation separates heading or block targets from aliases without rewriting the stored reference', () => {
	expect(documentLink('Notes/Project.md#Next steps|Roadmap')).toEqual({ path: 'Notes/Project.md', subpath: '#Next steps', alias: 'Roadmap' });
	expect(documentLink('Project#^block-id|Alias # unchanged')).toEqual({ path: 'Project', subpath: '#^block-id', alias: 'Alias # unchanged' });
	expect(documentLink('Project.md')).toEqual({ path: 'Project.md', subpath: undefined, alias: undefined });
	expect(documentLink('Project|First | second')).toEqual({ path: 'Project', subpath: undefined, alias: 'First | second' });
});
