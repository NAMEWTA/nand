import type { App } from 'obsidian';
import { createPortal } from 'preact/compat';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../../shared/i18n';
import { MultiFolderSelectModal } from '../../primitives/folder-select-modal';
import { applyModalTheme } from '../appearance/modal-theme';
export interface MediaFilterValue {
	property: 'created' | 'modified';
	start: string;
	end: string;
	folders: string[];
	tags: string[];
}
export const emptyMediaFilter: MediaFilterValue = { property: 'modified', start: '', end: '', folders: [], tags: [] };
export const normalizeMediaFolder = (path: string) => path.trim().replace(/^\/+|\/+$/g, '');
export function MediaFilter({
	app,
	anchor,
	value,
	update,
	tags,
	close,
}: {
	app: App;
	anchor: HTMLElement;
	value: MediaFilterValue;
	update: (value: MediaFilterValue) => void;
	tags?: string[];
	close: () => void;
}) {
	const popup = useRef<HTMLDivElement>(null);
	const [folder, setFolder] = useState('');
	const rect = anchor.getBoundingClientRect();
	useLayoutEffect(() => {
		const doc = anchor.ownerDocument;
		if (popup.current) applyModalTheme(popup.current);
		const outside = (event: MouseEvent) => {
			const target = event.target as HTMLElement;
			if (!popup.current?.contains(target) && !anchor.contains(target) && !target.closest?.('.modal-container'))
				close();
		};
		const key = (event: KeyboardEvent) => {
			if (event.key === 'Escape') close();
		};
		doc.addEventListener('click', outside);
		doc.addEventListener('keydown', key);
		return () => {
			doc.removeEventListener('click', outside);
			doc.removeEventListener('keydown', key);
		};
	}, [anchor]);
	const remove = (path: string) => update({ ...value, folders: value.folders.filter((f) => f !== path) });
	return createPortal(
		<div
			ref={popup}
			class="dashboard-library-filter-popup"
			style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, zIndex: 10000 }}
		>
			{tags && (
				<div class="dashboard-library-quickfilter-row">
					<div class="dashboard-library-quickfilter-label">{t('media.filterTags')}</div>
					<div class="dashboard-library-filter-chips">
						{tags.map((tag) => (
							<div
								key={tag}
								class={`dashboard-library-filter-chip${value.tags.includes(tag) ? ' selected' : ''}`}
								role="button"
								onClick={() =>
									update({
										...value,
										tags: value.tags.includes(tag)
											? value.tags.filter((v) => v !== tag)
											: [...value.tags, tag],
									})
								}
							>
								#{tag}
							</div>
						))}
					</div>
				</div>
			)}
			<div class="dashboard-library-quickfilter-row">
				<div class="dashboard-library-quickfilter-label">{t('library.filterProperty')}</div>
				<select
					class="dashboard-library-filter-popup-prop"
					value={value.property}
					onChange={(e) =>
						update({ ...value, property: e.currentTarget.value as MediaFilterValue['property'] })
					}
				>
					<option value="created">{t('library.created')}</option>
					<option value="modified">{t('library.modified')}</option>
				</select>
			</div>
			<div class="dashboard-library-quickfilter-row">
				<div class="dashboard-library-quickfilter-label">{t('library.filterDateRange')}</div>
				<div class="dashboard-media-filter-dates">
					<input
						class="dashboard-media-filter-date"
						type="date"
						value={value.start}
						onChange={(e) => update({ ...value, start: e.currentTarget.value })}
					/>
					<input
						class="dashboard-media-filter-date"
						type="date"
						value={value.end}
						onChange={(e) => update({ ...value, end: e.currentTarget.value })}
					/>
				</div>
			</div>
			<div class="dashboard-library-quickfilter-row">
				<div class="dashboard-library-quickfilter-label">{t('media.filterFolder')}</div>
				<div class="dashboard-alltasks-exclude-chips">
					{value.folders.length ? (
						value.folders.map((path) => (
							<div key={path} class="dashboard-alltasks-exclude-chip">
								<span>{path}</span>
								<span class="dashboard-alltasks-exclude-chip-x" onClick={() => remove(path)}>
									×
								</span>
							</div>
						))
					) : (
						<div class="dashboard-library-filter-empty">{t('folder.noFolders')}</div>
					)}
				</div>
				<div class="dashboard-media-folder-input-row">
					<input
						class="dashboard-media-filter-folder"
						placeholder={t('media.filterFolderPlaceholder')}
						value={folder}
						onInput={(e) => setFolder(e.currentTarget.value)}
						onKeyDown={(e) => {
							if (e.key !== 'Enter' || e.isComposing) return;
							e.preventDefault();
							const path = normalizeMediaFolder(folder);
							if (path && !value.folders.some((f) => f.toLowerCase() === path.toLowerCase()))
								update({ ...value, folders: [...value.folders, path] });
							setFolder('');
						}}
					/>
					<button
						class="dashboard-media-folder-browse"
						onClick={() =>
							new MultiFolderSelectModal(app, value.folders, (folders) =>
								update({ ...value, folders }),
							).open()
						}
					>
						{t('media.browseFolder')}
					</button>
				</div>
				<div class="dashboard-library-config-hint">{t('media.filterFolderHint')}</div>
			</div>
			<button
				class="dashboard-library-filter-popup-clear"
				onClick={() => {
					update(emptyMediaFilter);
					close();
				}}
			>
				{t('reminder.clearReminder')}
			</button>
		</div>,
		anchor.ownerDocument.body,
	);
}
