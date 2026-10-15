// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/renderer.ts
import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ArrowUp, Plus } from 'lucide-react';
import { Button } from '../../../../ui/components/button';
import { useT } from '../../../../ui/react/hooks';
import type { BoardStore } from '../../services/board-store';
import { Section, sectionId } from '../sections/Section';
import { SectionTypePicker } from '../sections/SectionTypePicker';
import { IconButton } from './controls';
import { QuickNotesBar } from '../quickbar/QuickNotesBar';
export function Board({
	store,
	mobile,
	quickbar = true,
	scrolling = true,
}: {
	store: BoardStore;
	mobile: boolean;
	quickbar?: boolean;
	scrolling?: boolean;
}) {
	const { data, dialog, settings } = useStore(store.state),
		t = useT(),
		ref = useRef<HTMLDivElement>(null),
		[scrolled, setScrolled] = useState(false);
	const previousCount = useRef(data?.columns.length ?? 0);
	useEffect(() => {
		if ((data?.columns.length ?? 0) > previousCount.current)
			ref.current?.querySelector('.dashboard-section-row:last-of-type')?.scrollIntoView({ block: 'nearest' });
		previousCount.current = data?.columns.length ?? 0;
	}, [data?.columns.length]);
	return (
		<div className="dashboard-kanban-wrapper relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
			<div
				ref={ref}
				className={`dashboard-kanban flex min-h-0 flex-1 flex-wrap content-start ${['mono', 'neon', 'volt', 'magma', 'onyx', 'tundra', 'blossom', 'matcha'].includes(settings.stylePreset) ? 'gap-2' : 'gap-2.5'} ${scrolling ? 'overflow-y-auto' : ''}`}
				onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 200)}
			>
				{quickbar && settings.quickNotesEnabled && <QuickNotesBar store={store} />}
				<SortableContext items={data!.columns.map(sectionId)} strategy={verticalListSortingStrategy}>
					{data!.columns.map((column, i) => (
						<Section
							key={column.id ?? column.name}
							store={store}
							column={column}
							index={i}
							mobile={mobile}
						/>
					))}
				</SortableContext>
				<Button
					variant="outline"
					className="dashboard-add-section mb-[60px] h-auto basis-full rounded-[var(--db-radius-lg)] border-2 border-dashed border-[var(--db-border-add-section)] bg-[var(--db-bg-add-section)] p-3 text-[.82em] text-muted-foreground"
					onClick={() => store.setDialog('section')}
				>
					<Plus className="size-4" />
					{t('home.dashboard.addSection')}
				</Button>
			</div>
			{scrolled && (
				<IconButton
					label={t('home.dashboard.top')}
					className="absolute right-4 bottom-4 rounded-full bg-secondary shadow-sm"
					onClick={() => ref.current?.scrollTo({ top: 0, behavior: 'auto' })}
				>
					<ArrowUp />
				</IconButton>
			)}
			{dialog === 'section' && <SectionTypePicker store={store} />}
		</div>
	);
}
