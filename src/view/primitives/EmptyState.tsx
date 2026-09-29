import { setIcon } from 'obsidian';
import type { EmptyStateOptions } from './empty-state';

/** Mirrors renderEmptyState: the icon badge holds Obsidian's SVG directly. */
export function EmptyState({ icon, title, description, layout, action }: EmptyStateOptions) {
	return (
		<div className={`nand-empty-state${layout === 'content' ? ' nand-empty-state--content' : ''}`}>
			<div
				className="nand-empty-state-icon"
				aria-hidden="true"
				ref={(element) => {
					if (element) setIcon(element, icon);
				}}
			/>
			<div className="nand-empty-state-title">{title}</div>
			<div className="nand-empty-state-description">{description}</div>
			{action && (
				<button type="button" className="nand-empty-state-action mod-cta" onClick={action.run}>
					{action.label}
				</button>
			)}
		</div>
	);
}
