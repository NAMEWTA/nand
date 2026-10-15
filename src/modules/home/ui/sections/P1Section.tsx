// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/renderer.ts
import { p1Classes } from '../theme/p1-classes';
import { createPortal } from 'react-dom';
import { RefreshCw, Settings } from 'lucide-react';
import { IconButton } from '../board/controls';
import { toast } from 'sonner';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOwnerDocument, useVisible } from '../../../../ui/react/contexts';
import { Input } from '../../../../ui/components/input';
import { Textarea } from '../../../../ui/components/textarea';
import { Label } from '../../../../ui/components/label';
import { Button } from '../../../../ui/components/button';
import { useT } from '../../../../ui/react/hooks';
import type { BoardStore } from '../../services/board-store';
import type { DashboardColumn } from '../../core/board/types';
import { DataviewPanel } from '../dataview/DataviewPanel';
import { executeDql } from '../../core/dql';
import { CalendarWidget } from '../widgets/CalendarWidget';
import { MediaPanel } from '../media/MediaPanel';
import { WebPanel } from '../web/WebPanel';
import { PipelineSection } from '../pipeline/PipelineSection';
import { homeServices } from '../../services/instances';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { resolvePipelineSkill } from '../../services/pipeline';
import { PipelineVault } from '../../platform/pipeline/vault';
import { dispatchSkillShortcut, type SkillDraft } from '../../services/skill-shortcuts';
export function P1Section({
	store,
	column,
	actions,
}: {
	store: BoardStore;
	column: DashboardColumn;
	actions?: HTMLElement | null;
}) {
	const type = column.sectionType,
		doc = useOwnerDocument(),
		visible = useVisible(),
		t = useT(),
		[root, setRoot] = useState<HTMLDivElement | null>(null),
		[editing, setEditing] = useState(false),
		[draft, setDraft] = useState(() => structuredClone(column)),
		[preview, setPreview] = useState<SkillDraft | null>(null);
	const reload = useRef<() => void>(() => {}),
		resolve = useRef<((value: SkillDraft | null) => void) | null>(null),
		abort = useMemo(() => new AbortController(), []);
	useEffect(
		() => () => {
			abort.abort();
			resolve.current?.(null);
		},
		[abort],
	);
	const register = useCallback((fn: () => void) => {
		reload.current = fn;
	}, []);
	const context = useMemo(
		() => ({
			app: store.host.app,
			hoverParent: null,
			opener: (file: { path: string }) => {
				void store.openFile(file.path);
			},
		}),
		[store],
	);
	const patch = (value: Partial<DashboardColumn>) =>
		store.edit((data) => {
			const col = data.columns.find((c) => c.id === column.id && c.name === column.name);
			if (col) Object.assign(col, value);
		});
	const run = async (
		name: string,
		skillId: string,
		stageId: string,
		path?: string,
		input?: string,
		signal?: AbortSignal,
	) => {
		const config = column.pipelineConfig,
			skill = config?.skills.find((s) => s.id === skillId);
		if (!config || !skill) return;
		const ctx = await resolvePipelineSkill(
			new PipelineVault(store.host.app),
			store.state.getState().path + '.md',
			column.id ?? name,
			config,
			skill,
			stageId,
			path,
			input,
			signal,
		);
		await dispatchSkillShortcut(skill, ctx, {
			dispatch: homeServices.acquireDispatch ?? (async () => undefined),
			signal: signal ?? abort.signal,
			notify: (message) => toast(message),
			preview: (_skill, _ctx, value) =>
				new Promise((done) => {
					resolve.current = done;
					setPreview(value);
				}),
		});
	};
	const query = executeDql(draft.dataviewConfig?.query ?? '', []);
	if (!visible) return null;
	return (
		<div
			ref={setRoot}
			className={
				type === 'dataview'
					? p1Classes('dashboard-dataview-content')
					: type === 'images' || type === 'videos'
						? p1Classes('dashboard-library-content dashboard-media-content')
						: type === 'web'
							? p1Classes('dashboard-web-content')
							: 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
			}
			onClick={(e) => {
				if ((e.target as Element).closest('[data-config]')) setEditing(true);
			}}
		>
			{actions &&
				['dataview', 'web', 'images', 'videos'].includes(type ?? '') &&
				createPortal(
					<div className="flex items-center gap-1">
						<IconButton label={t('home.pipeline.refresh')} onClick={() => reload.current()}>
							<RefreshCw />
						</IconButton>
						{type === 'web' && (
							<>
								<Input
									className="w-24"
									aria-label={t('home.p1.zoom')}
									type="number"
									min={50}
									max={125}
									step={5}
									value={Math.round((column.webConfig?.zoom ?? 1) * 100)}
									onChange={(e) => {
										void patch({
											webConfig: {
												url: column.webConfig?.url ?? '',
												zoom: +e.target.value / 100,
											},
										});
									}}
								/>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => {
										void store.host.openBrowser({ url: column.webConfig?.url ?? '' });
									}}
								>
									{t('web.openExternal')}
								</Button>
							</>
						)}
						<IconButton
							label={t('home.dashboard.settings')}
							onClick={() => {
								setDraft(structuredClone(column));
								setEditing(true);
							}}
						>
							<Settings />
						</IconButton>
					</div>,
					actions,
				)}
			{type === 'dataview' && (
				<DataviewPanel
					context={context}
					config={column.dataviewConfig ?? { query: '' }}
					reloadRegister={register}
					change={(dataviewConfig) => {
						void patch({ dataviewConfig });
					}}
				/>
			)}
			{type === 'calendar' && <CalendarWidget store={store} section />}
			{(type === 'images' || type === 'videos') && (
				<MediaPanel
					app={store.host.app}
					column={column}
					openNote={(file) => {
						void store.openFile(file.path);
					}}
					tagService={homeServices.mediaTags}
				/>
			)}
			{type === 'web' && root && (
				<WebPanel app={store.host.app} root={root} column={column} reloadRegister={register} />
			)}
			{type === 'pipeline' && (
				<PipelineSection
					actions={actions}
					app={store.host.app}
					column={column}
					win={doc.defaultView!}
					signal={abort.signal}
					callbacks={{
						onOpenNoteInPopover: (file) => {
							void store.openFile(file.path);
						},
						onPipelineConfigChange: (_name, pipelineConfig) => patch({ pipelineConfig }),
						onPipelineSkill: run,
					}}
				/>
			)}
			{editing && (
				<DashboardDialog
					title={t('home.dashboard.settings')}
					onClose={() => setEditing(false)}
					onSave={() => {
						void patch({
							dataviewConfig: draft.dataviewConfig,
							webConfig: draft.webConfig,
							libraryConfig: draft.libraryConfig,
						}).then(() => setEditing(false));
					}}
				>
					{type === 'dataview' ? (
						<>
							<Label>
								{t('dataview.configure')}
								<Textarea
									className="min-h-48 font-mono"
									value={draft.dataviewConfig?.query ?? ''}
									onChange={(e) =>
										setDraft({
											...draft,
											dataviewConfig: { ...draft.dataviewConfig, query: e.target.value },
										})
									}
								/>
							</Label>
							{!query.ok && <p role="alert">{query.error.message}</p>}
							<div className="flex flex-wrap gap-2">
								{[
									'TABLE file.name, file.mtime',
									'LIST',
									'TASK',
									'CALENDAR file.ctime',
									'HEATMAP file.ctime',
								].map((query) => (
									<Button
										key={query}
										variant="outline"
										onClick={() => setDraft({ ...draft, dataviewConfig: { query } })}
									>
										{query}
									</Button>
								))}
							</div>
						</>
					) : type === 'web' ? (
						<Label>
							{t('web.urlLabel')}
							<Input
								value={draft.webConfig?.url ?? ''}
								onChange={(e) =>
									setDraft({ ...draft, webConfig: { ...draft.webConfig, url: e.target.value } })
								}
							/>
						</Label>
					) : (
						<>
							<Label>
								{t('media.includeFolders')}
								<Textarea
									value={draft.libraryConfig?.includeFolders?.join('\n') ?? ''}
									onChange={(e) =>
										setDraft({
											...draft,
											libraryConfig: {
												filters: [],
												viewMode: 'grid',
												sortBy: 'modified',
												sortDesc: true,
												...draft.libraryConfig,
												includeFolders: e.target.value.split('\n').filter(Boolean),
											},
										})
									}
								/>
							</Label>
							<Label>
								{t('exclude.folders')}
								<Textarea
									value={draft.libraryConfig?.excludeFolders?.join('\n') ?? ''}
									onChange={(e) =>
										setDraft({
											...draft,
											libraryConfig: {
												filters: [],
												viewMode: 'grid',
												sortBy: 'modified',
												sortDesc: true,
												...draft.libraryConfig,
												excludeFolders: e.target.value.split('\n').filter(Boolean),
											},
										})
									}
								/>
							</Label>
						</>
					)}
				</DashboardDialog>
			)}
			{preview && (
				<DashboardDialog
					title={t('home.dashboard.skills')}
					onClose={() => {
						resolve.current?.(null);
						resolve.current = null;
						setPreview(null);
					}}
					onSave={() => {
						resolve.current?.(preview);
						resolve.current = null;
						setPreview(null);
					}}
				>
					<Textarea
						value={preview.finalPrompt}
						onChange={(e) => setPreview({ ...preview, finalPrompt: e.target.value })}
					/>
				</DashboardDialog>
			)}
		</div>
	);
}
