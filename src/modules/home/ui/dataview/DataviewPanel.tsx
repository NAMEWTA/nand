import { Platform } from 'obsidian';
import { useCallback, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { DataviewConfig } from '../../core/board/types';
import { executeDql } from '../../core/dql';
import type { QueryResult } from '../../core/dql/types';
import { buildPages } from '../../platform/dql/page-builder';
import { isUnderExcludedFolder, normalizeExcludeFolders } from '../../../../shared/exclude-folders';
import { t } from '../../../../shared/i18n';
import { Icon } from '../../../../ui/primitives/Icon';
import { Pagination } from '../library/Pagination';
import type { DataviewContext } from './context';
import {
	DEFAULT_PAGE_SIZE,
	PAGE_SIZE_OPTIONS,
	PAGINATED_TYPES,
	compareRowsForSort,
	rowSearchText,
	visibleRowWindow,
} from './result-model';
import { EmptyResult, FreeList, ResultCalendar, ResultHeatmap, ResultList, ResultTable } from './ResultViews';
import type { ViewState } from './table-model';
export function DataviewPanel({
	context,
	config,
	reloadRegister,
	change,
}: {
	context: DataviewContext;
	config: DataviewConfig;
	reloadRegister: (reload: () => void) => void;
	change: ((config: DataviewConfig) => void) | null;
}) {
	const [result, setResult] = useState<QueryResult | null>(null),
		[status, setStatus] = useState(Platform.isMobile ? 'manual' : 'scanning'),
		[error, setError] = useState('');
	const hasResult = useRef(false);
	const epoch = useRef(0),
		mounted = useRef(true);
	const load = useCallback(async () => {
		const version = ++epoch.current;
		if (!config.query.trim()) {
			setStatus('emptyQuery');
			return;
		}
		if (!hasResult.current) setStatus('scanning');
		try {
			const pages = await buildPages(context.app);
			if (!mounted.current || epoch.current !== version) return;
			const excluded = normalizeExcludeFolders(config.excludeFolders ?? []);
			const outcome = executeDql(
				config.query,
				excluded.length ? pages.filter((page) => !isUnderExcludedFolder(page.file.path, excluded)) : pages,
			);
			if (!outcome.ok) {
				setError(outcome.error.message);
				setStatus('error');
			} else if (outcome.empty) setStatus('emptyQuery');
			else {
				hasResult.current = true;
				setResult(outcome.result);
				setStatus('ready');
			}
		} catch (error) {
			if (mounted.current && version === epoch.current) {
				setError(error instanceof Error ? error.message : String(error));
				setStatus('error');
			}
		}
	}, [context, config]);
	useLayoutEffect(() => {
		mounted.current = true;
		reloadRegister(() => {
			if (mounted.current) void load();
		});
		if (!Platform.isMobile) void load();
		return () => {
			mounted.current = false;
			epoch.current++;
		};
	}, [load]);
	if (status === 'manual')
		return <EmptyResult message="dataview.mobileManualRun" hint="dataview.mobileManualRunHint" />;
	if (status === 'emptyQuery') return <EmptyResult message="dataview.emptyQuery" hint />;
	if (status === 'scanning')
		return (
			<div class="dashboard-dataview-scanning">
				<Icon className="dashboard-dataview-spinner" name="loader-circle" />
				<span>{t('dataview.scanning')}</span>
			</div>
		);
	if (status === 'error')
		return (
			<div class="dashboard-dataview-error">
				<Icon className="dashboard-dataview-error-icon" name="alert-triangle" />
				<div class="dashboard-dataview-error-text">{t('dataview.parseError', { message: error })}</div>
			</div>
		);
	return result ? (
		<ResultPanel result={result} context={context} config={config} change={change} reload={() => void load()} />
	) : null;
}
function ResultPanel({
	result,
	context,
	config,
	change,
	reload,
}: {
	result: QueryResult;
	context: DataviewContext;
	config: DataviewConfig;
	change: ((config: DataviewConfig) => void) | null;
	reload: () => void;
}) {
	const [view, setView] = useState<ViewState>({ filter: '', sortCol: null, sortDir: 'asc' }),
		[page, setPage] = useState(1),
		[size, setSize] = useState(config.pageSize ?? DEFAULT_PAGE_SIZE),
		[shown, setShown] = useState(0),
		[mode, setMode] = useState(config.viewMode ?? 'auto');
	const paginated = PAGINATED_TYPES.has(result.queryType),
		windowed = visibleRowWindow(result.rows.length, shown),
		capped = result.rows.slice(0, windowed.count);
	let rows = capped;
	const needle = view.filter.trim().toLowerCase();
	if (paginated && needle) rows = rows.filter((row) => rowSearchText(row).includes(needle));
	if (paginated && view.sortCol !== null)
		rows = [...rows].sort((a, b) => compareRowsForSort(a, b, view.sortCol!, view.sortDir));
	const pages = Math.max(1, Math.ceil(rows.length / size)),
		current = Math.min(page, pages),
		offset = paginated ? (current - 1) * size : 0;
	const pageRows = paginated ? rows.slice(offset, offset + size) : rows;
	const props = { result, rows: pageRows, context, reload, config: { ...config, viewMode: mode } };
	const body = !pageRows.length ? (
		<EmptyResult message="dataview.noMatch" />
	) : result.queryType === 'CALENDAR' ? (
		<ResultCalendar {...props} />
	) : result.queryType === 'HEATMAP' ? (
		<ResultHeatmap rows={pageRows} />
	) : mode === 'list' ? (
		<ResultList {...props} />
	) : mode === 'auto' && result.queryType !== 'TABLE' ? (
		<FreeList {...props} />
	) : (
		<ResultTable
			{...props}
			config={mode === 'auto' ? { ...props.config, showSource: false } : props.config}
			view={view}
			sort={(value) => {
				setView(value);
				setPage(1);
			}}
			offset={offset}
		/>
	);
	const count = (
		<>
			{t(
				needle ? 'dataview.filteredCount' : 'dataview.resultCount',
				needle ? { shown: rows.length, total: capped.length } : { count: capped.length },
			)}
			{!needle && windowed.truncated && (
				<button type="button" class="dashboard-dataview-capped" onClick={() => setShown(windowed.next)}>
					{t('dataview.capped', { count: windowed.count })}
				</button>
			)}
		</>
	);
	if (!result.rows.length) return <EmptyResult message="dataview.empty" />;
	if (!paginated)
		return (
			<>
				<div class="dashboard-dataview-count">{count}</div>
				<div class="dashboard-dataview-body">{body}</div>
			</>
		);
	return (
		<>
			<div class="dashboard-dataview-toolbar">
				<input
					class="dashboard-dataview-search"
					type="text"
					placeholder={t('dataview.filterPlaceholder')}
					spellcheck={false}
					value={view.filter}
					onInput={(e) => {
						setView({ ...view, filter: e.currentTarget.value });
						setPage(1);
					}}
				/>
				<span class="dashboard-dataview-count">{count}</span>
				<div class="dashboard-dataview-toolbar-spacer" />
				<select
					class="dashboard-library-page-size"
					value={String(size)}
					onChange={(e) => {
						const value = Number(e.currentTarget.value) || DEFAULT_PAGE_SIZE;
						setSize(value);
						setPage(1);
						change?.({ ...config, pageSize: value, viewMode: mode });
					}}
				>
					{PAGE_SIZE_OPTIONS.map((value) => (
						<option key={value} value={String(value)}>
							{t('dataview.pageSize', { count: value })}
						</option>
					))}
				</select>
				<div class="dashboard-library-view-toggle dashboard-dataview-view-toggle">
					{(['table', 'list', 'auto'] as const).map((value) => (
						<div
							key={value}
							class={`dashboard-library-view-btn${value === mode ? ' active' : ''}`}
							data-view={value}
							role="button"
							title={t(`dataview.view${value[0]!.toUpperCase()}${value.slice(1)}`)}
							onClick={() => {
								setMode(value);
								setPage(1);
								change?.({ ...config, pageSize: size, viewMode: value });
							}}
						>
							<Icon name={value === 'table' ? 'table' : value === 'list' ? 'list' : 'sparkles'} />
						</div>
					))}
				</div>
			</div>
			<div class="dashboard-dataview-pages">
				<div class="dashboard-dataview-body">{body}</div>
				<div class="dashboard-dataview-pagination">
					{pages > 1 && <Pagination page={current} pages={pages} change={setPage} />}
				</div>
			</div>
		</>
	);
}
