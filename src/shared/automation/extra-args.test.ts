import { expect, test } from 'vitest';
import { validatedExtraArgs } from './extra-args';

test('allowlist accepts model/effort pairs and Claude directories with one portable quoting grammar', () => {
	expect(
		validatedExtraArgs('claude-code', '--model opus --effort high --add-dir "notes and docs" --add-dir=notes'),
	).toEqual(['--model', 'opus', '--effort', 'high', '--add-dir', 'notes and docs', '--add-dir', 'notes']);
	expect(validatedExtraArgs('codex', '-m gpt-6 --reasoning-effort=high')).toEqual([
		'-m',
		'gpt-6',
		'--reasoning-effort',
		'high',
	]);
	expect(validatedExtraArgs('gemini', '  ')).toEqual([]);
});
test.each([
	'--dangerously-skip-permissions',
	'--permission-mode bypassPermissions',
	'-c model=x',
	'--config=file',
	'--resume abc',
	'--prompt hi',
	'--print',
	'--cwd /tmp',
	'--',
	'a prompt',
	'--model',
	'--model --effort high',
	'--model=""',
	'--add-dir notes',
	'--model a -m b',
	'--effort low --reasoning-effort high',
	'--model "unterminated',
	'--model x;echo',
	'--model $(id)',
	'--model `id`',
	'--model x\n--resume y',
	'--model ' + 'x'.repeat(4096),
])('rejects unsafe or ambiguous extras: %s', (text) => {
	expect(() => validatedExtraArgs('codex', text)).toThrow();
});
