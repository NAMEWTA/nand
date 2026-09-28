import { Menu } from 'obsidian';
import { Icon } from '../../primitives/Icon';
import type { ToolbarDropdownItem } from './toolbar-dropdown';
export function ToolbarDropdown({
	currentKey,
	items,
	pick,
}: {
	currentKey: string;
	items: readonly ToolbarDropdownItem[];
	pick: (key: string) => void;
}) {
	const current = items.find((item) => item.key === currentKey) ?? items[0]!;
	return (
		<div
			class="dashboard-library-view-btn dashboard-toolbar-dropdown"
			role="button"
			tabIndex={0}
			title={current.label}
			aria-label={current.label}
			aria-haspopup="menu"
			onClick={(event) => {
				event.stopPropagation();
				const menu = new Menu();
				for (const item of items)
					menu.addItem((entry) =>
						entry
							.setTitle(item.label)
							.setIcon(item.icon ?? '')
							.setChecked(item.key === currentKey)
							.onClick(() => {
								if (item.key !== currentKey) pick(item.key);
							}),
					);
				menu.showAtMouseEvent(event);
			}}
			onKeyDown={(event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					event.currentTarget.click();
				}
			}}
		>
			{current.icon ? (
				<Icon name={current.icon} />
			) : (
				<span class="dashboard-toolbar-dropdown-text">{current.short ?? current.label}</span>
			)}
		</div>
	);
}
