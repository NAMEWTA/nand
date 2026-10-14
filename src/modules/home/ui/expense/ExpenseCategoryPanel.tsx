// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/expense-category-ui.ts
import { useState, type ReactNode } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import {
	SortableContext,
	useSortable,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
	arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import type { ExpenseService } from '../../platform/expense/expense-service';
import { categoriesFor, EXPENSE_CATEGORY_NAME_MAX, type ExpenseType } from '../../core/expense/model';
import { useService } from '../widgets/use-record-service';
import { useT } from '../../../../ui/react/hooks';
import { Input } from '../../../../ui/components/input';
import { RecordButton as Button } from '../dialogs/RecordButton';
import { RecordConfirm } from '../dialogs/RecordConfirm';
import { Choice } from '../board/controls';
import { widgetClasses } from '../theme/widget-classes';
import { categoryLabel } from './expense-label';
function CategoryRow({
	name,
	children,
	index,
	total,
	move,
}: {
	name: string;
	children: ReactNode;
	index: number;
	total: number;
	move(this: void, from: number, to: number): void;
}) {
	const { setNodeRef, attributes, listeners, transform, isDragging } = useSortable({ id: name }),
		t = useT();
	return (
		<div
			ref={setNodeRef}
			style={{ transform: CSS.Transform.toString(transform), opacity: isDragging ? 0.4 : undefined }}
			className={widgetClasses('dashboard-expense-catmgr-row')}
		>
			<Button variant="ghost" aria-label={t('home.dashboard.drag')} {...attributes} {...listeners}>
				<GripVertical className="size-3" />
			</Button>
			<span className={widgetClasses('dashboard-expense-catmgr-name')}>{categoryLabel(name)}</span>
			{children}
			<div className="ml-auto flex">
				<Button
					variant="ghost"
					disabled={!index}
					aria-label={t('expense.cat.moveUp')}
					onClick={() => move(index, index - 1)}
				>
					<ChevronUp className="size-3" />
				</Button>
				<Button
					variant="ghost"
					disabled={index === total - 1}
					aria-label={t('expense.cat.moveDown')}
					onClick={() => move(index, index + 1)}
				>
					<ChevronDown className="size-3" />
				</Button>
			</div>
		</div>
	);
}
export function ExpenseCategoryPanel({ service, close }: { service: ExpenseService; close(this: void): void }) {
	useService(service);
	const t = useT(),
		[type, setType] = useState<ExpenseType>('expense'),
		[names, setNames] = useState({ secondary: '', primary: '' }),
		[error, setError] = useState(''),
		[remove, setRemove] = useState<{ name: string; primary: boolean } | null>(null);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);
	return (
		<>
			<div className={widgetClasses('dashboard-expense-stats-header')}>
				<div className={widgetClasses('dashboard-expense-stats-header-title')}>
					{t('expense.cat.manageTitle')}
				</div>
				<Button variant="ghost" aria-label={t('common.close')} onClick={close}>
					×
				</Button>
			</div>
			<div className="p-4">
				<Choice
					value={type}
					onChange={(value) => setType(value as ExpenseType)}
					label={t('expense.colType')}
					options={(['expense', 'income'] as const).map((value) => ({
						value,
						label: t(value === 'expense' ? 'expense.typeExpense' : 'expense.typeIncome'),
					}))}
				/>
				{(['secondary', 'primary'] as const).map((kind) => {
					const primary = kind === 'primary',
						items = primary ? service.getPrimaryCategories(type) : service.getOrderedCategories(type),
						move = (from: number, to: number) => {
							const next = arrayMove(items, from, to);
							if (primary) service.reorderPrimaryCategories(type, next);
							else service.reorderCategories(type, next);
						};
					return (
						<section key={type + kind} className="mt-4">
							<h3 className={widgetClasses('dashboard-expense-catmgr-subtitle')}>
								{t(primary ? 'expense.cat.primarySection' : 'expense.cat.secondarySection')}
							</h3>
							<DndContext
								sensors={sensors}
								collisionDetection={closestCenter}
								onDragEnd={({ active, over }) => {
									if (over && active.id !== over.id)
										move(items.indexOf(String(active.id)), items.indexOf(String(over.id)));
								}}
							>
								<SortableContext items={items} strategy={verticalListSortingStrategy}>
									{items.map((name, index) => (
										<CategoryRow
											name={name}
											key={name}
											index={index}
											total={items.length}
											move={move}
										>
											{!primary && (
												<Choice
													className="ml-auto h-6 w-28 text-xs"
													label={t('expense.cat.primarySection')}
													value={service.getCategoryParent(type, name) ?? '_none'}
													onChange={(value) => {
														service.setCategoryParent(
															type,
															name,
															value === '_none' ? null : value,
														);
													}}
													options={[
														{ value: '_none', label: t('expense.cat.ungrouped') },
														...service
															.getPrimaryCategories(type)
															.map((value) => ({ value, label: value })),
													]}
												/>
											)}
											<span className="text-xs text-muted-foreground">
												{t(primary ? 'expense.cat.primaryCount' : 'expense.cat.usage', {
													n: primary
														? service.countPrimaryUsage(type, name)
														: service.countCategoryUsage(type, name),
												})}
											</span>
											{(primary || !categoriesFor(type).includes(name)) && (
												<Button
													variant="ghost"
													aria-label={t('common.delete')}
													onClick={() => setRemove({ name, primary })}
												>
													<Trash2 className="size-3" />
												</Button>
											)}
										</CategoryRow>
									))}
								</SortableContext>
							</DndContext>
							<form
								className="mt-2 flex gap-2"
								onSubmit={(e) => {
									e.preventDefault();
									const result = primary
										? service.addPrimaryCategory(type, names[kind])
										: service.addCustomCategory(type, names[kind]);
									if (result.ok) {
										setNames({ ...names, [kind]: '' });
										setError('');
									} else
										setError(
											t(
												result.reason === 'duplicate'
													? 'expense.cat.exists'
													: result.reason === 'limit'
														? primary
															? 'expense.cat.primaryLimit'
															: 'expense.cat.limit'
														: 'expense.cat.invalid',
											),
										);
								}}
							>
								<Input
									aria-label={t(
										primary ? 'expense.cat.primaryNamePlaceholder' : 'expense.cat.namePlaceholder',
									)}
									maxLength={EXPENSE_CATEGORY_NAME_MAX}
									value={names[kind]}
									onChange={(e) => setNames({ ...names, [kind]: e.target.value })}
								/>
								<Button type="submit" className="px-2">
									{t('common.add')}
								</Button>
							</form>
						</section>
					);
				})}
				{error && (
					<p role="alert" className="text-destructive">
						{error}
					</p>
				)}
			</div>
			<RecordConfirm
				open={!!remove}
				onOpenChange={(open) => {
					if (!open) setRemove(null);
				}}
				title={t(remove?.primary ? 'expense.cat.primaryRemoveConfirmTitle' : 'expense.cat.removeConfirmTitle')}
				description={
					remove
						? t(
								remove.primary
									? 'expense.cat.primaryRemoveConfirmMessage'
									: 'expense.cat.removeConfirmMessage',
								{ name: categoryLabel(remove.name), n: service.countPrimaryUsage(type, remove.name) },
							)
						: ''
				}
				onConfirm={() => {
					if (remove) {
						if (remove.primary) service.removePrimaryCategory(type, remove.name);
						else service.removeCustomCategory(type, remove.name);
					}
					setRemove(null);
				}}
			/>
		</>
	);
}
