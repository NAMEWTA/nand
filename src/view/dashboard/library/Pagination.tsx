export function Pagination({ page, pages, change }: { page: number; pages: number; change: (page: number) => void }) {
	let start = Math.max(1, page - 2);
	const end = Math.min(pages, start + 4);
	start = Math.max(1, end - 4);
	const button = (value: number) => (
		<div
			key={value}
			role="button"
			tabIndex={0}
			class={`dashboard-library-pagination-page${value === page ? ' active' : ''}`}
			onClick={() => {
				if (value !== page) change(value);
			}}
		>
			{value}
		</div>
	);
	return (
		<div class="dashboard-library-pagination-nav">
			<div
				role="button"
				tabIndex={0}
				class={`dashboard-library-pagination-btn${page <= 1 ? ' disabled' : ''}`}
				onClick={() => {
					if (page > 1) change(page - 1);
				}}
			>
				&lt;
			</div>
			{start > 1 && button(1)}
			{start > 2 && <div class="dashboard-library-pagination-ellipsis">...</div>}
			{Array.from({ length: end - start + 1 }, (_, index) => button(start + index))}
			{end < pages - 1 && <div class="dashboard-library-pagination-ellipsis">...</div>}
			{end < pages && button(pages)}
			<div
				role="button"
				tabIndex={0}
				class={`dashboard-library-pagination-btn${page >= pages ? ' disabled' : ''}`}
				onClick={() => {
					if (page < pages) change(page + 1);
				}}
			>
				&gt;
			</div>
		</div>
	);
}
