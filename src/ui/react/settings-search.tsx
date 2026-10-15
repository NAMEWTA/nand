// Adapted from stablyai/orca 464bd5a54b3364021c5cc0319859616e5ec41bbf (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/settings/SearchableSetting.tsx
import { createContext, useContext, type ReactNode } from 'react';
import { cn } from '../lib/utils';
export const SettingsSearchContext = createContext('');
export function matchesSettingsSearch(
	query: string,
	entry: { title: string; description?: string; keywords?: readonly string[] },
) {
	const needle = query.trim().toLocaleLowerCase();
	return (
		!needle ||
		[entry.title, entry.description, ...(entry.keywords ?? [])].some((value) =>
			value?.toLocaleLowerCase().includes(needle),
		)
	);
}
export function SearchHighlight({ text }: { text: string }) {
	const query = useContext(SettingsSearchContext).trim();
	const start = query ? text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) : -1;
	return start < 0 ? (
		text
	) : (
		<>
			{text.slice(0, start)}
			<mark className="rounded-sm bg-accent text-accent-foreground">
				{text.slice(start, start + query.length)}
			</mark>
			{text.slice(start + query.length)}
		</>
	);
}
export function SearchableSetting({
	title,
	description,
	keywords,
	children,
	className,
}: {
	title: string;
	description?: string;
	keywords?: readonly string[];
	children: ReactNode;
	className?: string;
}) {
	const query = useContext(SettingsSearchContext);
	if (!matchesSettingsSearch(query, { title, description, keywords })) return null;
	return (
		<div data-searchable-setting className={cn('scroll-mt-6 w-full max-w-3xl', className)}>
			{children}
		</div>
	);
}
