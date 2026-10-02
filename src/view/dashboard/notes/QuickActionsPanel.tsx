import type { AutomationUiPort } from '../../../shared/automation/types';
import { useEffect, useRef, useState } from 'preact/hooks';
import { buildOrderedActions } from '../../../core/dashboard/quick-actions';
import type { QuickAction } from '../../../core/dashboard/types';
import { t } from '../../../shared/i18n';
import { Icon } from '../../primitives/Icon';
import { KANBAN_FILE_DRAG_TYPE } from '../ui/dnd';
export function QuickActionsPanel({
	actions,
	execute,
	automation,
	remove,
	add,
	order,
	reorder,
	removeKey,
	hidden,
	edit,
}: {
	actions: QuickAction[];
	automation?: AutomationUiPort;
	execute: (action: QuickAction) => void;
	remove: (index: number) => void;
	add: () => void;
	order?: string[];
	reorder?: (keys: string[]) => void;
	removeKey?: (key: string) => void;
	hidden?: string[];
	edit?: (action: QuickAction) => void;
}) {
	const [, refresh] = useState(0);
	const [error, setError] = useState('');
	const run = (work: () => unknown) => {
		setError('');
		void Promise.resolve().then(work).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)));
	};
	useEffect(() => automation?.subscribe?.(() => refresh(n => n + 1)), [automation]);
	const saved = new Map(automation?.actions?.().map(action => [action.id, action]) ?? []);
	const ordered = buildOrderedActions(actions, order, hidden).map((item) =>
		item.isPreset
			? {
					...item,
					action: {
						...item.action,
						name: t(item.action.target === 'daily-notes' ? 'quickActions.newJournal' : 'quickActions.newNote'),
					},
				}
			: item,
	),
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
				{ordered.map(({ action, isPreset, key }) => {
					const current = action.type === 'action' ? saved.get(action.target) : undefined;
					const name = current?.name ?? action.name;
					const unavailable = action.type === 'action' ? current?.unavailable ?? (!current ? t('automation.missingAction') : '') : '';
					return (
					<div
						key={key}
						data-qa-key={key}
						class={`dashboard-qa-item${action.type === 'action' ? ' dashboard-qa-item--saved' : ''}${isPreset ? ' dashboard-qa-item--preset' : ''}${dragging === key ? ' dashboard-qa-item--dragging' : ''}${over === key ? ' dashboard-qa-item--drag-over' : ''}`}
						draggable
						title={action.name}
						onKeyDown={event => {
							if (!event.altKey || !reorder || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
							event.preventDefault();
							const keys = ordered.map(item => item.key), index = keys.indexOf(key);
							const target = Math.max(0, Math.min(keys.length - 1, index + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1)));
							keys.splice(index, 1); keys.splice(target, 0, key); reorder(keys);
						}}
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
						<button type="button" class="dashboard-qa-run" disabled={!!unavailable || current?.running} title={unavailable || t('automation.reorderKeys')} onClick={() => execute(action)}>
							<Icon className="dashboard-qa-icon" name={action.icon} />
							<span class="dashboard-qa-name">{name}</span>
							{current?.status && <span class="nand-ui-badge">{t(`automation.${current.status}`)}</span>}
							{unavailable && <span>{unavailable}</span>}
						</button>
						{action.type === 'action' && <button type="button" class="nand-ui-icon-btn" aria-label={t('automation.open')} onClick={() => run(() => automation?.openAction?.(action.target))}><Icon name="external-link" /></button>}
						{current?.running && <button type="button" class="nand-ui-icon-btn" aria-label={t('automation.stop')} onClick={() => run(() => automation?.stopAction?.(action.target))}><Icon name="square" /></button>}
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
				); })}
			</div>
			{!ordered.length && <span class="dashboard-empty">{t('quickActions.empty')}</span>}
			{error && <span role="alert" class="nand-ui-error">{error}</span>}
		</>
	);
}
