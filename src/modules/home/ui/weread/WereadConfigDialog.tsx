// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/weread-config-modal.ts
import { useState } from 'react';
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import {
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
	sortableKeyboardCoordinates,
	arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronUp, ChevronDown, Trash2, GripVertical } from 'lucide-react';
import type { WereadConfig, WereadWidget, WereadStatItem } from '../../core/board/types';
import type {
	WereadContentType,
	WereadGroupBy,
	WereadNoteState,
	WereadReadingState,
	WereadRecency,
} from '../../core/weread/weread-shelf-model';
import { normalizedWidgets } from '../../core/weread/widget-model';
import { useT } from '../../../../ui/react/hooks';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import { Checkbox } from '../../../../ui/components/checkbox';
import { Choice, IconButton } from '../board/controls';
import { P2Dialog } from '../dialogs/P2Dialog';
import { p2Classes as c } from '../theme/p2-classes';
import { ALL_STAT_ITEMS, STAT_ITEM_LABEL_KEYS, normalizeStatItems } from './stats-model';
const VIEW_OPTIONS: Array<{ value: WereadWidget['view']; labelKey: string }> = [
	{ value: 'shelf', labelKey: 'weread.viewShelf' },
	{ value: 'stats', labelKey: 'weread.viewStats' },
	{ value: 'notes', labelKey: 'weread.viewNotes' },
];
const PROGRESS_OPTIONS: Array<{ value: WereadReadingState; labelKey: string }> = [
	{ value: 'notStarted', labelKey: 'weread.progressNotStarted' },
	{ value: 'reading', labelKey: 'weread.progressReading' },
	{ value: 'finished', labelKey: 'weread.progressFinished' },
];
const CONTENT_TYPE_OPTIONS: Array<{ value: WereadContentType; labelKey: string }> = [
	{ value: 'book', labelKey: 'weread.contentBook' },
	{ value: 'audio', labelKey: 'weread.contentAudio' },
	{ value: 'article', labelKey: 'weread.contentArticle' },
];
const RECENCY_OPTIONS: Array<{ value: WereadRecency; labelKey: string }> = [
	{ value: 'recent7', labelKey: 'weread.recent7' },
	{ value: 'recent30', labelKey: 'weread.recent30' },
	{ value: 'older', labelKey: 'weread.recentOlder' },
	{ value: 'never', labelKey: 'weread.recentNever' },
];
const NOTE_OPTIONS: Array<{ value: WereadNoteState; labelKey: string }> = [
	{ value: 'highlights', labelKey: 'weread.notesHighlights' },
	{ value: 'ideas', labelKey: 'weread.notesIdeas' },
	{ value: 'none', labelKey: 'weread.notesNone' },
];
const GROUP_OPTIONS: Array<{ value: WereadGroupBy; labelKey: string }> = [
	{ value: 'readingState', labelKey: 'weread.groupReadingState' },
	{ value: 'contentType', labelKey: 'weread.groupContentType' },
	{ value: 'recency', labelKey: 'weread.groupRecency' },
	{ value: 'notes', labelKey: 'weread.groupNotes' },
	{ value: 'none', labelKey: 'weread.groupNone' },
];

export function WereadConfigDialog({
	config,
	onSave,
	onClose,
}: {
	config?: WereadConfig;
	onSave: (config: WereadConfig) => Promise<void>;
	onClose: () => void;
}) {
	const t = useT(),
		[widgets, setWidgets] = useState(() => structuredClone(normalizedWidgets(config)));
	const update = (id: string, patch: Partial<WereadWidget>) =>
		setWidgets((rows) => rows.map((w) => (w.id === id ? { ...w, ...patch } : w)));
	return (
		<P2Dialog
			title={t('weread.configure')}
			onClose={onClose}
			onSave={() =>
				onSave({ widgets: widgets.length ? widgets : [{ id: 'w1', view: 'shelf', groupBy: 'readingState' }] })
			}
		>
			<div className={c('dashboard-library-config-section-title')}>{t('weread.widgetsLabel')}</div>
			<div className={c('dashboard-weread-cfg-list')}>
				{widgets.map((w, i) => (
					<div key={w.id} className={c('dashboard-weread-cfg-row')}>
						<div className={c('dashboard-weread-cfg-main')}>
							<Input
								className={c('dashboard-weread-cfg-title')}
								placeholder={t('weread.widgetTitlePlaceholder')}
								aria-label={t('weread.widgetTitlePlaceholder')}
								value={w.title ?? ''}
								onChange={(e) => update(w.id, { title: e.target.value || undefined })}
							/>
							<Choice
								compact
								label={t('weread.widgetsLabel')}
								className={c('dashboard-library-filter-property w-[75px]')}
								value={w.view}
								options={VIEW_OPTIONS.map((v) => ({ value: v.value, label: t(v.labelKey) }))}
								onChange={(v) => update(w.id, { view: v as WereadWidget['view'] })}
							/>
							{w.view === 'shelf' && (
								<>
									<div className={c('dashboard-weread-cfg-grouping')}>
										<div className={c('dashboard-weread-cfg-filter-label')}>
											{t('weread.groupBy')}
										</div>
										<Choice
											compact
											label={t('weread.groupBy')}
											className={c('dashboard-library-filter-property w-[200px]')}
											value={w.groupBy ?? 'readingState'}
											options={GROUP_OPTIONS.map((v) => ({
												value: v.value,
												label: t(v.labelKey),
											}))}
											onChange={(v) => update(w.id, { groupBy: v as WereadGroupBy })}
										/>
									</div>
									<div className={c('dashboard-weread-cfg-filter-panel')}>
										<div className={c('dashboard-weread-cfg-filter-panel-title')}>
											{t('weread.filters')}
										</div>
										<Facet
											label={t('weread.filterProgress')}
											options={PROGRESS_OPTIONS}
											selected={w.progressFilters}
											onChange={(values) => update(w.id, { progressFilters: values })}
										/>
										<Facet
											label={t('weread.filterContentType')}
											options={CONTENT_TYPE_OPTIONS}
											selected={w.contentTypeFilters}
											onChange={(values) => update(w.id, { contentTypeFilters: values })}
										/>
										<Facet
											label={t('weread.filterRecency')}
											options={RECENCY_OPTIONS}
											selected={w.recencyFilters}
											onChange={(values) => update(w.id, { recencyFilters: values })}
										/>
										<Facet
											label={t('weread.filterNotes')}
											options={NOTE_OPTIONS}
											selected={w.noteFilters}
											onChange={(values) => update(w.id, { noteFilters: values })}
										/>
									</div>
								</>
							)}
							{w.view === 'stats' && (
								<StatItems
									values={normalizeStatItems(w.statsItems)}
									change={(statsItems) => update(w.id, { statsItems })}
								/>
							)}
						</div>
						<div className={c('dashboard-weread-cfg-ops')}>
							<IconButton
								label={t('home.p2.moveUp')}
								className={c('dashboard-weread-cfg-op')}
								disabled={i === 0}
								onClick={() => setWidgets(arrayMove(widgets, i, i - 1))}
							>
								<ChevronUp />
							</IconButton>
							<IconButton
								label={t('home.p2.moveDown')}
								className={c('dashboard-weread-cfg-op')}
								disabled={i === widgets.length - 1}
								onClick={() => setWidgets(arrayMove(widgets, i, i + 1))}
							>
								<ChevronDown />
							</IconButton>
							<IconButton
								label={t('common.delete')}
								className={c('dashboard-weread-cfg-op')}
								onClick={() => setWidgets(widgets.filter((row) => row.id !== w.id))}
							>
								<Trash2 />
							</IconButton>
						</div>
					</div>
				))}
			</div>
			<Button
				size="xs"
				className={c('dashboard-modal-btn dashboard-modal-btn--confirm dashboard-weread-cfg-add')}
				onClick={() =>
					setWidgets([...widgets, { id: crypto.randomUUID(), view: 'shelf', groupBy: 'readingState' }])
				}
			>
				{t('weread.addWidget')}
			</Button>
			<div className={c('dashboard-library-config-hint')}>{t('weread.configHint')}</div>
		</P2Dialog>
	);
}
function Facet<T extends string>({
	label,
	options,
	selected,
	onChange,
}: {
	label: string;
	options: { value: T; labelKey: string }[];
	selected?: T[];
	onChange: (values: T[] | undefined) => void;
}) {
	const t = useT();
	return (
		<div className={c('dashboard-weread-cfg-filter-group')}>
			<div className={c('dashboard-weread-cfg-filter-label')}>{label}</div>
			<div className={c('dashboard-alltasks-exclude-chips')}>
				{options.map((option) => (
					<Button
						size="xs"
						key={option.value}
						variant="ghost"
						className={c(`dashboard-weread-cfg-chip ${selected?.includes(option.value) ? 'active' : ''}`)}
						aria-pressed={selected?.includes(option.value) ?? false}
						onClick={() => {
							const next = selected?.includes(option.value)
								? selected.filter((v) => v !== option.value)
								: [...(selected ?? []), option.value];
							onChange(next.length ? next : undefined);
						}}
					>
						{t(option.labelKey)}
					</Button>
				))}
			</div>
		</div>
	);
}
function StatItems({ values, change }: { values: WereadStatItem[]; change: (values: WereadStatItem[]) => void }) {
	const t = useT(),
		sensors = useSensors(
			useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
			useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
		);
	return (
		<div className={c('dashboard-weread-cfg-filter-panel')}>
			<div className={c('dashboard-weread-cfg-filter-panel-title')}>{t('weread.statsItems')}</div>
			<div className={c('dashboard-library-config-hint')}>{t('weread.statsItemsHint')}</div>
			<DndContext
				sensors={sensors}
				onDragEnd={({ active, over }) => {
					if (over && active.id !== over.id)
						change(
							arrayMove(
								values,
								values.indexOf(active.id as WereadStatItem),
								values.indexOf(over.id as WereadStatItem),
							),
						);
				}}
			>
				<SortableContext items={values} strategy={verticalListSortingStrategy}>
					<div className={c('dashboard-weread-cfg-stats-list')}>
						{[...values, ...ALL_STAT_ITEMS.filter((item) => !values.includes(item))].map((item) => (
							<StatRow
								key={item}
								item={item}
								checked={values.includes(item)}
								toggle={() =>
									change(values.includes(item) ? values.filter((v) => v !== item) : [...values, item])
								}
							/>
						))}
					</div>
				</SortableContext>
			</DndContext>
		</div>
	);
}
function StatRow({ item, checked, toggle }: { item: WereadStatItem; checked: boolean; toggle: () => void }) {
	const t = useT(),
		{ setNodeRef, attributes, listeners, transform } = useSortable({ id: item, disabled: !checked });
	return (
		<div
			ref={setNodeRef}
			style={{ transform: CSS.Transform.toString(transform) }}
			className={c(`dashboard-weread-cfg-stats-row ${checked ? '' : 'dashboard-weread-cfg-stats-row--hidden'}`)}
		>
			<IconButton
				label={t('home.dashboard.drag')}
				disabled={!checked}
				className={c('dashboard-weread-cfg-stats-handle')}
				{...attributes}
				{...listeners}
			>
				<GripVertical />
			</IconButton>
			<Checkbox checked={checked} onCheckedChange={toggle} aria-label={t(STAT_ITEM_LABEL_KEYS[item])} />
			<span className={c('dashboard-weread-cfg-stats-label')}>{t(STAT_ITEM_LABEL_KEYS[item])}</span>
		</div>
	);
}
