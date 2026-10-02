import { setIcon } from 'obsidian';
import { useEffect, useRef } from 'preact/compat';
import { ct } from './labels';

export function Icon({ name, className }: { name: string; className?: string }) {
	const ref = useRef<HTMLSpanElement>(null);
	useEffect(() => {
		if (ref.current) setIcon(ref.current, name);
	}, [name]);
	return <span ref={ref} className={className} aria-hidden="true" />;
}
export function Pager({
	page,
	pages,
	count,
	go,
	live = false,
	footer = false,
}: {
	page: number;
	pages: number;
	count: number;
	go: (page: number) => void;
	live?: boolean;
	footer?: boolean;
}) {
	const body = (
		<>
			<button className="nand-ui-btn nand-ui-btn-ghost" disabled={page === 0} onClick={() => go(page - 1)}>
				<Icon name="chevron-left" />
				{ct('previous')}
			</button>
			<span aria-live={live ? 'polite' : undefined}>{ct('page', { page: page + 1, total: pages, count })}</span>
			<button className="nand-ui-btn nand-ui-btn-ghost" disabled={page + 1 >= pages} onClick={() => go(page + 1)}>
				{ct('next')}
				<Icon name="chevron-right" />
			</button>
		</>
	);
	return footer ? (
		<footer className="nand-contacts-pagination">{body}</footer>
	) : (
		<div className="nand-contacts-pagination">{body}</div>
	);
}
