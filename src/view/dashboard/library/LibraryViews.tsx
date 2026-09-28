import { Notice, type App, type TFile } from 'obsidian';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { LibraryConfig } from '../../../core/dashboard/types/index';
import { t } from '../../../shared/i18n/index';
import { Icon } from '../../primitives/Icon';
import { GALLERY_COVER_PLACEHOLDER_DATA_URL } from '../assets/gallery-cover-placeholder';
import { noteHover } from '../cards/InlineLinks';
import type { DashboardRenderContext } from '../renderer/render-context';
import { formatDate, loadPreview, str, type LibraryFileResult } from './library-file-result';
import {
	extractCoverValue,
	formatBadgeValue,
	omitFrontmatterKey,
	openFile,
	resolveLibraryCover,
	selectBadgeKeys,
} from './library-presentation';

export interface LibraryViewProps {
	results: LibraryFileResult[];
	app: App;
	config: LibraryConfig;
	context: DashboardRenderContext;
	showTags?: boolean;
	onDelete?: (file: TFile) => void;
}
export function Cover({ result, app, kanban = false }: { result: LibraryFileResult; app: App; kanban?: boolean }) {
	const cover = extractCoverValue(result.frontmatter);
	const [url, setUrl] = useState('');
	useLayoutEffect(() => {
		let disposed = false;
		setUrl('');
		if (cover)
			void resolveLibraryCover(cover.value, result.file, app)
				.then((value) => {
					if (!disposed) setUrl(value);
				})
				.catch(() => {});
		return () => {
			disposed = true;
		};
	}, [cover?.value, result.file.path, app]);
	const background = url || GALLERY_COVER_PLACEHOLDER_DATA_URL;
	return (
		<div
			class={`dashboard-library-card-cover${kanban ? ' dashboard-library-kanban-card-cover' : ''}${url ? '' : ' dashboard-library-card-cover--placeholder'}`}
			style={background ? { backgroundImage: `url(${background})` } : undefined}
		>
			{!background && <Icon name="image" />}
		</div>
	);
}
export function PropertyBadges({
	frontmatter,
	config,
}: {
	frontmatter: Record<string, unknown>;
	config: LibraryConfig;
}) {
	if (config.showProperties === false) return null;
	const keys = selectBadgeKeys(frontmatter, config.visibleProperties, Math.max(0, config.propertyLimit ?? 6));
	return keys.length ? (
		<div class="dashboard-library-badges">
			{keys.map((key) => (
				<div class="dashboard-library-badge" key={key}>
					<div class="dashboard-library-badge-key">{key}</div>
					<div class="dashboard-library-badge-val">{formatBadgeValue(frontmatter[key])}</div>
				</div>
			))}
		</div>
	) : null;
}
function Preview({ app, result }: { app: App; result: LibraryFileResult }) {
	const [text, setText] = useState<string | null>(null);
	useLayoutEffect(() => {
		let disposed = false;
		setText(null);
		void loadPreview(app, result.file)
			.then((value) => {
				if (!disposed) setText(value);
			})
			.catch(() => {
				if (!disposed) setText('');
			});
		return () => {
			disposed = true;
		};
	}, [app, result.file, result.mtime]);
	return text === '' ? null : (
		<div class={`dashboard-library-card-preview${text === null ? ' dashboard-library-card-preview--loading' : ''}`}>
			{text}
		</div>
	);
}
export function FileCards({
	results,
	app,
	config,
	context,
	showTags,
	covers = false,
}: LibraryViewProps & { covers?: boolean }) {
	const size = config.cardSize && config.cardSize !== 'medium' ? ` dashboard-library-cards--${config.cardSize}` : '';
	return (
		<div class={(covers ? 'dashboard-library-gallery' : 'dashboard-library-grid') + size}>
			{results.map((result) => {
				const cover = covers ? extractCoverValue(result.frontmatter) : null;
				const parent = result.file.path.split('/').slice(0, -1).join('/');
				return (
					<div
						key={result.file.path}
						class="dashboard-library-card"
						onMouseOver={(event) => noteHover(app, context, result.file, event)}
						onClick={(event) => openFile(app, result.file, event.currentTarget)}
					>
						{covers && <Cover app={app} result={result} />}
						<div class="dashboard-library-card-title">{result.basename}</div>
						<div class="dashboard-library-card-meta">
							{showTags
								? result.tags.length > 0 && (
										<div class="dashboard-library-card-tags">
											{result.tags.slice(0, 2).map((tag) => (
												<div class="dashboard-library-card-tag" key={tag}>
													{tag}
												</div>
											))}
											{result.tags.length > 2 && (
												<div class="dashboard-library-card-tag dashboard-library-card-tag--more">
													+{result.tags.length - 2}
												</div>
											)}
										</div>
									)
								: parent && <div class="dashboard-library-card-path">{parent}/</div>}
							<div class="dashboard-library-card-date">{formatDate(result.ctime)}</div>
						</div>
						<Preview app={app} result={result} />
						<PropertyBadges
							config={config}
							frontmatter={cover ? omitFrontmatterKey(result.frontmatter, cover.key) : result.frontmatter}
						/>
					</div>
				);
			})}
		</div>
	);
}
export function FileList({ results, app, context }: Pick<LibraryViewProps, 'results' | 'app' | 'context'>) {
	return (
		<div class="dashboard-library-list">
			{results.map((result) => (
				<div
					key={result.file.path}
					class="dashboard-library-list-item"
					onMouseOver={(event) => noteHover(app, context, result.file, event)}
					onClick={(event) => openFile(app, result.file, event.currentTarget)}
				>
					<div class="dashboard-library-list-name">{result.basename}</div>
					<div class="dashboard-library-list-spacer" />
					<div class="dashboard-library-list-date">{formatDate(result.ctime)}</div>
				</div>
			))}
		</div>
	);
}
function PropertyCell({
	app,
	file,
	property,
	original,
}: {
	app: App;
	file: TFile;
	property: string;
	original: unknown;
}) {
	const [editing, setEditing] = useState(false),
		[value, setValue] = useState(original);
	const input = useRef<HTMLInputElement>(null),
		finishing = useRef(false);
	const display = value == null ? '' : Array.isArray(value) ? value.map(String).join(', ') : str(value);
	useLayoutEffect(() => setValue(original), [original]);
	useLayoutEffect(() => {
		if (editing && input.current) {
			finishing.current = false;
			input.current.value = display;
			input.current.focus();
			input.current.select();
		}
	}, [editing]);
	const finish = (save: boolean) => {
		if (finishing.current) return;
		finishing.current = true;
		const raw = input.current?.value.trim() ?? '';
		setEditing(false);
		if (!save || raw === display) return;
		const next: unknown = !raw
			? null
			: Array.isArray(value)
				? raw
						.split(',')
						.map((part) => part.trim())
						.filter(Boolean)
				: Number.isNaN(Number(raw))
					? raw
					: Number(raw);
		const previous = value;
		setValue(next);
		void app.fileManager
			.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
				if (next === null) delete frontmatter[property];
				else frontmatter[property] = next;
			})
			.catch((error) => {
				setValue(previous);
				console.error('[Dashboard] property edit failed:', error);
				new Notice(t('library.propertyMoveFailed'));
			});
	};
	return (
		<td
			class={`dashboard-library-table-editable${display ? '' : ' dashboard-library-table-empty'}`}
			onDblClick={(event) => {
				event.stopPropagation();
				setEditing(true);
			}}
		>
			{editing ? (
				<input
					ref={input}
					type="text"
					class="dashboard-library-table-edit-input"
					onKeyDown={(event) => {
						if (event.key === 'Enter' && !event.isComposing) {
							event.preventDefault();
							finish(true);
						} else if (event.key === 'Escape') {
							event.preventDefault();
							finish(false);
						}
					}}
					onBlur={() => finish(true)}
				/>
			) : (
				display || '—'
			)}
		</td>
	);
}
export function FileTable({ results, app, config, context, onDelete }: LibraryViewProps) {
	const keys = new Set(
		config.filters
			.map((filter) => filter.property)
			.filter((key) => !['tags', 'modified', 'created', 'path'].includes(key)),
	);
	for (const result of results.slice(0, 20))
		for (const key of Object.keys(result.frontmatter)) {
			if (key === 'position') continue;
			keys.add(key);
			if (keys.size >= 6) break;
		}
	return (
		<table class="dashboard-library-table">
			<thead>
				<tr>
					{['name', 'modified', ...keys].map((key) => (
						<th key={key} data-sort-key={key}>
							{key === 'name'
								? t('library.sortName')
								: key === 'modified'
									? t('library.sortModified')
									: key}
						</th>
					))}
					<th class="dashboard-library-table-op-col" aria-label={t('library.delete')} />
				</tr>
			</thead>
			<tbody>
				{results.map((result) => (
					<tr key={result.file.path}>
						<td
							class="dashboard-library-table-name"
							onMouseOver={(event) => noteHover(app, context, result.file, event)}
							onClick={(event) => {
								event.stopPropagation();
								openFile(app, result.file, event.currentTarget);
							}}
						>
							{result.basename}
						</td>
						<td>{formatDate(result.mtime)}</td>
						{Array.from(keys, (key) => (
							<PropertyCell
								key={key}
								app={app}
								file={result.file}
								property={key}
								original={result.frontmatter[key]}
							/>
						))}
						<td class="dashboard-library-table-op">
							<button
								class="dashboard-library-table-delete"
								title={t('library.delete')}
								aria-label={t('library.delete')}
								onClick={(event) => {
									event.stopPropagation();
									onDelete?.(result.file);
								}}
							>
								<Icon name="trash-2" />
							</button>
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}
