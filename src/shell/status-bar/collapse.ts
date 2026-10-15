// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/status-bar/status-bar-usage-collapse.ts
export function planUsageCollapse(
	avail: number,
	items: readonly { id: string; verbose: number; compact: number }[],
	chipWidth: number,
): { mode: 'verbose' | 'compact'; collapsed: string[] } {
	const sum = (widths: number[]) => widths.reduce((a, b) => a + b, 0);
	const available = Math.max(0, avail);
	if (sum(items.map((i) => i.verbose)) <= available) return { mode: 'verbose', collapsed: [] };
	if (sum(items.map((i) => i.compact)) <= available) return { mode: 'compact', collapsed: [] };
	const collapsed: string[] = [],
		visible = [...items];
	while (visible.length && sum(visible.map((i) => i.compact)) + chipWidth > available)
		collapsed.unshift(visible.pop()!.id);
	return { mode: 'compact', collapsed };
}
