import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { expect, test } from 'vitest';

interface Step { uses?: string; run?: string; if?: string; 'continue-on-error'?: boolean; with?: Record<string, unknown> }
interface Job {
	uses?: string;
	needs?: string[];
	if?: string;
	'continue-on-error'?: boolean;
	env?: Record<string, string>;
	strategy?: { 'fail-fast'?: boolean; matrix: { include: { os: string; 'node-version': string }[] } };
	steps?: Step[];
}
const workflow = (name: string) => parse(readFileSync(`.github/workflows/${name}.yml`, 'utf8')) as { on: Record<string, unknown>; jobs: Record<string, Job> };

test('tag releases require successful checks and all helpers from the calling commit', () => {
	const release = workflow('release'), checks = workflow('lint'), terminal = workflow('terminal-build');
	expect(checks.on).toHaveProperty('workflow_call');
	expect(release.jobs.checks?.uses).toBe('./.github/workflows/lint.yml');
	expect(release.jobs.terminal?.uses).toBe('./.github/workflows/terminal-build.yml');
	expect(release.jobs.release?.needs).toEqual(['checks', 'terminal']);
	expect(release.jobs.release?.if).toBe("${{ needs.checks.result == 'success' && needs.terminal.result == 'success' }}");
	for (const file of [release, checks, terminal]) for (const job of Object.values(file.jobs)) {
		expect(job['continue-on-error']).not.toBe(true);
		for (const step of job.steps ?? []) {
			expect(step['continue-on-error']).not.toBe(true);
			if (step.uses?.startsWith('actions/checkout@')) expect(step.with?.ref).toBe('${{ github.sha }}');
		}
	}
});

test('the reusable quality matrix runs the full checks on Linux 22/24 and Windows 24', () => {
	const checks = workflow('lint'), build = checks.jobs.build!;
	expect(build.if).toBeUndefined();
	for (const value of Object.values(build.env ?? {})) {
		for (const expression of value.matchAll(/\$\{\{([\s\S]*?)\}\}/g)) expect(expression[1]).not.toMatch(/\b(?:runner|job|steps|env)\./);
	}
	expect(build.strategy?.matrix.include).toEqual([
		{ os: 'ubuntu-latest', 'node-version': '22.x' },
		{ os: 'ubuntu-latest', 'node-version': '24.x' },
		{ os: 'windows-latest', 'node-version': '24.x' },
	]);
	expect(build.strategy?.['fail-fast']).toBe(false);
	const commands = (build.steps ?? []).flatMap(step => step.run ? [step.run] : []);
	for (const required of ['pnpm install --frozen-lockfile', 'pnpm run build', 'pnpm run check:bundle', 'git diff --exit-code -- main.js styles.css', 'pnpm run lint', 'pnpm run lint:css', 'pnpm run test:all', 'pnpm run check:notices', 'pnpm run check:native']) {
		expect(commands).toContain(required);
		expect(build.steps?.find(step => step.run === required)?.if).toBeUndefined();
	}
});
