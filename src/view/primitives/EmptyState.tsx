import { Icon } from './Icon';
import type { EmptyStateOptions } from './empty-state';

export function EmptyState({ icon, title, description, layout, action }: EmptyStateOptions) {
	return (
		<div className={`nand-empty-state${layout === 'content' ? ' nand-empty-state--content' : ''}`}>
			<div className="nand-empty-state-icon">
				<Icon name={icon} />
			</div>
			<div className="nand-empty-state-title">{title}</div>
			<div className="nand-empty-state-description">{description}</div>
			{action && (
				<button type="button" onClick={action.run}>
					{action.label}
				</button>
			)}
		</div>
	);
}
