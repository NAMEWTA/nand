import type { ReactNode } from 'react';

/** Keep the pre-migration 272px card minimum and maximum-column width caps. */
export function ArchiveCardGrid({ columns, children }: { columns: number; children: ReactNode }) {
	return (
		<div
			className={`mx-auto grid w-full grid-cols-[repeat(auto-fill,minmax(min(100%,272px),1fr))] gap-3 ${columns === 5 ? 'max-w-[1424px]' : 'max-w-[1712px]'}`}
		>
			{children}
		</div>
	);
}
