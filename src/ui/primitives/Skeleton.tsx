/** Loading placeholder sized by its caller. */
export function Skeleton({ width = '100%', height = 12 }: { width?: string | number; height?: number }) {
	return <div class="nand-skeleton" aria-hidden="true" style={{ width: typeof width === 'number' ? `${width}px` : width, height: `${height}px` }} />;
}
