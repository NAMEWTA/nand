import type { LunarLookup } from '../../core/anniversaries/lunar-map';

/** Lunar conversion for anniversary dates. The library loads only when a lunar anniversary is shown. */
export async function createLunarLookup(): Promise<LunarLookup> {
	return (await import('../../core/anniversaries/lunar-calendar')).lunarLookup;
}
