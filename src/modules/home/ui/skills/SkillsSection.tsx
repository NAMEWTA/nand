import { skillGroup, retainSkillAssignments } from '../../core/skills/groups';
import { SkillCard, SkillDetail } from './SkillCard';
import type { LibrarySkill } from '../../services/skill-library';
import { observeBoardAction } from '../board/actions';
// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/skill-section.ts
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useStore } from 'zustand';
import { ChevronDown, Layers, Columns3, RefreshCw, Settings } from 'lucide-react';
import type { BoardStore } from '../../services/board-store';
import type { DashboardColumn, SkillsSectionConfig } from '../../core/board/types';
import { SkillLibrary } from '../../services/skill-library';
import { Input } from '../../../../ui/components/input';
import { Textarea } from '../../../../ui/components/textarea';
import { Button } from '../../../../ui/components/button';
import { useT } from '../../../../ui/react/hooks';
import { useVisible } from '../../../../ui/react/contexts';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { IconButton, Choice } from '../board/controls';
import { p1Classes } from '../theme/p1-classes';
import { Pagination, IconChoice } from '../sections/P1Controls';
export function SkillsSection({
	store,
	column,
	actions,
}: {
	store: BoardStore;
	column: DashboardColumn;
	actions?: HTMLElement | null;
}) {
	const isVisible = useVisible();
	const folderInput = useRef<HTMLInputElement>(null);
	const service = useMemo(() => new SkillLibrary(store.host.app), [store]);
	useEffect(() => {
		if (!isVisible) return;
		void service.refresh();
		const stop = store.widgets.watchAgents?.(() => void service.refresh());
		return () => {
			stop?.();
			service.dispose();
		};
	}, [service, store, isVisible]);
	const state = useStore(service.state),
		t = useT(),
		config = column.skillsConfig ?? {},
		[search, setSearch] = useState(''),
		[collapsed, setCollapsed] = useState<string[]>([]),
		[groupFilter, setGroupFilter] = useState('_all'),
		[page, setPage] = useState(1),
		[importing, setImporting] = useState(false),
		[markdown, setMarkdown] = useState(''),
		[error, setError] = useState(''),
		[detail, setDetail] = useState<LibrarySkill | null>(null),
		[deleteDetail, setDeleteDetail] = useState(false),
		[groupEdit, setGroupEdit] = useState(false),
		[groups, setGroups] = useState(config.groups ?? []);
	const patch = (prefs: Partial<SkillsSectionConfig>) =>
		store.edit((data) => {
			const col = data.columns.find((c) => c.id === column.id && c.name === column.name);
			if (col) col.skillsConfig = { ...col.skillsConfig, ...prefs };
		});
	const groupFor = (name: string) => skillGroup(name, config);
	const filtered = state.entries
		.filter(
			(e) =>
				e.name.toLowerCase().includes(search.toLowerCase()) &&
				(groupFilter === '_all' || groupFor(e.name) === groupFilter),
		)
		.sort(
			(a, b) =>
				Number(config.pinned?.includes(b.name) ?? false) - Number(config.pinned?.includes(a.name) ?? false) ||
				a.name.localeCompare(b.name) * (config.sortDir === 'desc' ? -1 : 1),
		);
	// Curated groups stay complete; only their ungrouped backlog is paginated.
	const paginated = config.groupView ? filtered.filter((entry) => groupFor(entry.name) === '_none') : filtered;
	const size = config.pageSize ?? 50,
		pages = Math.max(1, Math.ceil(paginated.length / size)),
		current = Math.min(page, pages);
	const visible = paginated.slice((current - 1) * size, current * size);
	const pin = (name: string) =>
		observeBoardAction(
			patch({
				pinned: config.pinned?.includes(name)
					? config.pinned.filter((n) => n !== name)
					: [...(config.pinned ?? []), name],
			}),
		);
	const assign = (name: string, group: string) =>
		observeBoardAction(patch({ assignments: { ...config.assignments, [name]: group } }));
	const renderCards = (entries: typeof visible, className = 'dashboard-skillsec-grid') => (
		<div className={p1Classes(className)}>
			{entries.map((entry) => (
				<SkillCard
					key={entry.name}
					store={store}
					entry={entry}
					config={config}
					pinned={config.pinned?.includes(entry.name) ?? false}
					pin={() => {
						void pin(entry.name);
					}}
					detail={() => {
						setDeleteDetail(false);
						setDetail(entry);
					}}
					reveal={() => {
						void service.reveal(entry.sources[0]!).catch((e) => setError(String(e)));
					}}
					remove={() => {
						setDeleteDetail(true);
						setDetail(entry);
					}}
					assign={(group) => {
						void assign(entry.name, group);
					}}
				/>
			))}
		</div>
	);

	return (
		<div className={p1Classes('dashboard-skillsec-content')}>
			{actions &&
				createPortal(
					<>
						<IconButton
							label={t('home.pipeline.refresh')}
							disabled={state.loading}
							onClick={() => {
								void service.refresh();
							}}
						>
							<RefreshCw />
						</IconButton>
						<IconButton
							label={t('home.p1.group')}
							onClick={() => {
								setGroups(config.groups ?? []);
								setGroupEdit(true);
							}}
						>
							<Settings />
						</IconButton>
					</>,
					actions,
				)}
			<div className={p1Classes('dashboard-skillsec-toolbar')}>
				<Input
					data-hit-control
					className={`${p1Classes('dashboard-skillsec-search')} h-[30px]`}
					aria-label={t('skills.searchPh')}
					placeholder={t('skills.searchPh')}
					value={search}
					onChange={(e) => {
						setSearch(e.target.value);
						setPage(1);
					}}
				/>
				<IconChoice
					icon="filter"
					label={t('home.p1.group')}
					value={groupFilter}
					options={[
						{ value: '_all', label: t('pm.filterAllStages') },
						...(config.groups ?? []).map((g) => ({ value: g.id, label: g.name })),
						{ value: '_manage', label: t('home.p1.group') },
					]}
					onChange={(value) => {
						if (value === '_manage') {
							setGroups(config.groups ?? []);
							setGroupEdit(true);
						} else {
							setGroupFilter(value);
							setPage(1);
						}
					}}
				/>
				<IconChoice
					icon="arrow-down-up"
					label={t('home.p1.sort')}
					value={config.sortDir ?? 'asc'}
					options={[
						{ value: 'asc', label: t('home.p1.asc') },
						{ value: 'desc', label: t('home.p1.desc') },
					]}
					onChange={(sortDir) => {
						void observeBoardAction(patch({ sortDir: sortDir as 'asc' | 'desc' }));
					}}
				/>
				<IconButton
					className={p1Classes('dashboard-library-view-btn')}
					label={t('home.p1.groups')}
					aria-pressed={config.groupView === 'groups'}
					onClick={() => {
						void observeBoardAction(
							patch({ groupView: config.groupView === 'groups' ? undefined : 'groups' }),
						);
					}}
				>
					<Layers className="size-4" />
				</IconButton>
				<IconButton
					className={p1Classes('dashboard-library-view-btn')}
					label={t('home.p1.kanban')}
					aria-pressed={config.groupView === 'kanban'}
					onClick={() => {
						void observeBoardAction(
							patch({ groupView: config.groupView === 'kanban' ? undefined : 'kanban' }),
						);
					}}
				>
					<Columns3 className="size-4" />
				</IconButton>
				<Button
					data-hit-control
					size="sm"
					variant="outline"
					className={`${p1Classes('dashboard-skillsec-import')} h-[30px]`}
					onClick={() => setImporting(true)}
				>
					{t('skills.import')}
				</Button>

				<div className="flex-1" />
				<Choice
					compact
					label={t('dataview.pageSize', { count: size })}
					value={String(size)}
					options={[10, 20, 50, 100].map((value) => ({
						value: String(value),
						label: t('dataview.pageSize', { count: value }),
					}))}
					onChange={(value) => {
						setPage(1);
						void observeBoardAction(patch({ pageSize: Number(value) }));
					}}
				/>
			</div>
			<div className={p1Classes('dashboard-skillsec-results')}>
				<div className={p1Classes('dashboard-skillsec-stats')}>
					{t('skills.statSummary', {
						total: String(filtered.length),
						claude: String(
							filtered.filter((e) => e.sources.some((s) => s.path.includes('.claude/'))).length,
						),
						codex: String(filtered.filter((e) => e.sources.some((s) => s.path.includes('.codex/'))).length),
						workbuddy: '0',
					})}
				</div>
				{filtered.length > 0 &&
					(config.groupView ? (
						<div
							className={p1Classes(
								config.groupView === 'kanban'
									? 'dashboard-skillsec-kanban'
									: 'dashboard-skillsec-groups',
							)}
						>
							{[...(config.groups ?? []), { id: '_none', name: t('home.p1.ungrouped') }].map((group) => (
								<section
									data-group-key={group.id}
									className={p1Classes(
										`${config.groupView === 'kanban' ? 'dashboard-skillsec-kcol' : 'dashboard-skillsec-group'} ${collapsed.includes(group.id) ? 'is-collapsed' : ''}`,
									)}
									key={group.id}
									onDragOver={(event) => {
										if (event.dataTransfer.types.includes('application/x-nand-skill'))
											event.preventDefault();
									}}
									onDrop={(event) => {
										const name = event.dataTransfer.getData('application/x-nand-skill');
										if (state.entries.some((entry) => entry.name === name)) {
											event.preventDefault();
											void assign(name, group.id);
										}
									}}
								>
									<Button
										variant="ghost"
										className={p1Classes('dashboard-skillsec-group-head')}
										aria-expanded={!collapsed.includes(group.id)}
										onClick={() =>
											setCollapsed(
												collapsed.includes(group.id)
													? collapsed.filter((id) => id !== group.id)
													: [...collapsed, group.id],
											)
										}
									>
										<span className={p1Classes('dashboard-skillsec-group-chevron')}>
											<ChevronDown />
										</span>
										<span className={p1Classes('dashboard-skillsec-group-name')}>{group.name}</span>
										<span className={p1Classes('dashboard-skillsec-group-count')}>
											{filtered.filter((e) => groupFor(e.name) === group.id).length}
										</span>
									</Button>
									{renderCards(
										(group.id === '_none' ? visible : filtered).filter(
											(e) => groupFor(e.name) === group.id,
										),
										config.groupView === 'kanban'
											? 'dashboard-skillsec-kcol-list'
											: 'dashboard-skillsec-grid dashboard-skillsec-group-grid',
									)}
								</section>
							))}
						</div>
					) : (
						renderCards(visible)
					))}
				{pages > 1 && <Pagination page={current} pages={pages} change={setPage} />}
				{(state.loading || state.error || !filtered.length) && (
					<div className={p1Classes('dashboard-skillsec-empty')} role="status">
						{!state.loading && !state.error && !filtered.length
							? t(search ? 'skills.noMatches' : 'skills.emptyHint')
							: state.loading
								? t('dataview.scanning')
								: state.error}
					</div>
				)}
			</div>
			{detail && (
				<SkillDetail
					store={store}
					entry={state.entries.find((e) => e.name === detail.name) ?? detail}
					service={service}
					pinned={config.pinned?.includes(detail.name) ?? false}
					pin={() => {
						void pin(detail.name);
					}}
					focusDelete={deleteDetail}
					close={() => setDetail(null)}
				/>
			)}
			{importing && (
				<DashboardDialog
					title={t('home.p1.importSkills')}
					onClose={() => setImporting(false)}
					onSave={() => {
						void service
							.importMarkdown(markdown)
							.then(() => {
								setImporting(false);
								setMarkdown('');
							})
							.catch((e) => setError(String(e)));
					}}
				>
					<LabelText />
					<input
						ref={folderInput}
						type="file"
						multiple
						{...{ webkitdirectory: '' }}
						className="hidden"
						aria-label={t('home.p1.importFolder')}
						onChange={(e) => {
							const selected = [...(e.target.files ?? [])];
							void Promise.all(
								selected.map(async (file) => ({
									path: file.webkitRelativePath,
									bytes: await file.arrayBuffer(),
								})),
							)
								.then((files) => service.importFiles(files))
								.then(() => setImporting(false))
								.catch((e) => setError(String(e)));
						}}
					/>
					<Button variant="outline" onClick={() => folderInput.current?.click()}>
						{t('home.p1.importFolder')}
					</Button>
					<Textarea
						className="min-h-60 font-mono"
						aria-label="SKILL.md"
						value={markdown}
						onChange={(e) => setMarkdown(e.target.value)}
					/>
					{error && <p role="alert">{error}</p>}
				</DashboardDialog>
			)}
			{groupEdit && (
				<DashboardDialog
					title={t('home.p1.group')}
					onClose={() => setGroupEdit(false)}
					onSave={() => {
						void observeBoardAction(
							patch({ groups, assignments: retainSkillAssignments(config, groups) }).then(() => {
								setGroupEdit(false);
								setGroupFilter('_all');
							}),
						);
					}}
				>
					{groups.map((g, i) => (
						<div className="flex gap-2" key={g.id}>
							<Input
								aria-label={t('home.dashboard.name')}
								value={g.name}
								onChange={(e) =>
									setGroups(groups.map((v, n) => (n === i ? { ...v, name: e.target.value } : v)))
								}
							/>
							<Input
								aria-label={t('home.p1.keywords')}
								value={g.keywords ?? ''}
								onChange={(e) =>
									setGroups(groups.map((v, n) => (n === i ? { ...v, keywords: e.target.value } : v)))
								}
							/>
							<Button variant="ghost" onClick={() => setGroups(groups.filter((v) => v.id !== g.id))}>
								{t('common.delete')}
							</Button>
						</div>
					))}
					<Button
						variant="outline"
						onClick={() => setGroups([...groups, { id: crypto.randomUUID(), name: '', keywords: '' }])}
					>
						{t('common.add')}
					</Button>
				</DashboardDialog>
			)}
		</div>
	);
}
function LabelText() {
	const t = useT();
	return <p>{t('home.p1.skillImportHint')}</p>;
}
