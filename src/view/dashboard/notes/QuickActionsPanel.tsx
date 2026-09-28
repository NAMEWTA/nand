import { useRef, useState } from 'preact/hooks';
import { buildOrderedActions } from '../../../core/dashboard/quick-actions';
import type { QuickAction } from '../../../core/dashboard/types';
import { t } from '../../../shared/i18n';
import { Icon } from '../../primitives/Icon';
import { KANBAN_FILE_DRAG_TYPE } from '../ui/dnd';
export function QuickActionsPanel({
	actions,
	execute,
	remove,
	add,
	order,
	reorder,
	removeKey,
	hidden,
	edit,
}: {
	actions: QuickAction[];
	execute: (action: QuickAction) => void;
	remove: (index: number) => void;
	add: () => void;
	order?: string[];
	reorder?: (keys: string[]) => void;
	removeKey?: (key: string) => void;
	hidden?: string[];
	edit?: (action: QuickAction) => void;
}) {
	const ordered = buildOrderedActions(actions, order, hidden),
		drag = useRef<string | null>(null),
		[dragging, setDragging] = useState<string | null>(null),
		[over, setOver] = useState<string | null>(null);
	return (
		<>
			<div class="dashboard-qa-header">
				<h3 class="dashboard-section-title">{t('quickActions.title')}</h3>
				<div class="dashboard-qa-btn-group">
					<button class="dashboard-qa-add-btn" aria-label={t('quickActions.addAction')} onClick={add}>
						<Icon name="plus" />
					</button>
				</div>
			</div>
			<div class="dashboard-qa-list">
				{ordered.map(({ action, isPreset, key }) => (
					<div
						key={key}
						data-qa-key={key}
						class={`dashboard-qa-item${isPreset ? ' dashboard-qa-item--preset' : ''}${dragging === key ? ' dashboard-qa-item--dragging' : ''}${over === key ? ' dashboard-qa-item--drag-over' : ''}`}
						draggable
						title={action.name}
						role="button"
						onClick={() => execute(action)}
						onDragStart={(e) => {
							drag.current = key;
							setDragging(key);
							if (e.dataTransfer) {
								e.dataTransfer.effectAllowed = 'move';
								e.dataTransfer.setData('text/plain', key);
							}
						}}
						onDragEnd={() => {
							drag.current = null;
							setDragging(null);
							setOver(null);
						}}
						onDragOver={(e) => {
							if (!drag.current || e.dataTransfer?.types.includes(KANBAN_FILE_DRAG_TYPE)) return;
							e.preventDefault();
							if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
							if (key !== drag.current) setOver(key);
						}}
						onDragLeave={() => setOver(null)}
						onDrop={(e) => {
							e.preventDefault();
							setOver(null);
							const source = drag.current;
							if (!source || source === key || !reorder) return;
							const keys = ordered.map((item) => item.key),
								at = keys.indexOf(key),
								next = keys.filter((item) => item !== source);
							next.splice(at, 0, source);
							reorder(next);
							drag.current = null;
							setDragging(null);
						}}
					>
						<Icon className="dashboard-qa-icon" name={action.icon} />
						<span class="dashboard-qa-name">{action.name}</span>
						<button
							class="dashboard-qa-remove"
							aria-label={t('common.remove', { name: action.name })}
							onClick={(e) => {
								e.stopPropagation();
								if (removeKey) removeKey(key);
								else if (!isPreset) remove(actions.indexOf(action));
							}}
						>
							<Icon name="x" />
						</button>
						{edit && !isPreset && (
							<button
								class="dashboard-qa-edit"
								aria-label={t('quickActions.editAction')}
								onClick={(e) => {
									e.stopPropagation();
									edit(action);
								}}
							>
								<Icon name="pencil" />
							</button>
						)}
					</div>
				))}
			</div>
			{!ordered.length && <span class="dashboard-empty">{t('quickActions.empty')}</span>}
		</>
	);
}
