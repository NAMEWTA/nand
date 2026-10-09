import type { GitResult } from './ports';

export interface CloneResult {
	state: 'cloned' | 'refused' | 'failed' | 'cancelled';
	detail?: string;
}

/**
 * Clone into a new or empty directory. A non-empty target is refused.
 * Cancel and failure do not delete anything that was already there.
 */
export async function cloneIntoEmpty(
	run: (args: readonly string[]) => Promise<GitResult>,
	target: string,
	url: string,
	existing: readonly string[] | null,
	cancelled = false,
): Promise<CloneResult> {
	if (cancelled) return { state: 'cancelled' };
	if (!target || target.startsWith('-') || target.includes('\0') || target.includes('..')) return { state: 'refused', detail: 'invalid target' };
	if (existing && existing.length > 0) return { state: 'refused', detail: 'target is not empty' };
	const result = await run(['clone', '--', url, target]);
	if (cancelled) return { state: 'cancelled' };
	return result.code === 0 ? { state: 'cloned' } : { state: 'failed', detail: `${result.stderr}\n${result.stdout}`.trim() };
}
