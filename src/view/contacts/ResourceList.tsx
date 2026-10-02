import { useState } from 'preact/compat';
import type { ArchiveRecord } from '../../core/contacts/model';
import { queryResources } from '../../core/contacts/resources';
import { ct } from './labels';
import type { ContactsPanelHost } from './panel-contract';
import { Icon, Pager } from './ContactsPrimitives';

export function ResourceList({ view, record }: { view: ContactsPanelHost; record: ArchiveRecord }) {
	const [search, setSearch] = useState('');
	const [sort, setSort] = useState<'modified' | 'name'>('modified');
	const [requestedPage, setPage] = useState(0);
	const [dragging, setDragging] = useState(false);
	const resources = view.resources(record);
	const matches = queryResources(resources, search, sort);
	const pages = Math.max(1, Math.ceil(matches.length / 60)),
		page = Math.min(requestedPage, pages - 1);
	return (
		<section
			className={`nand-contacts-resources nand-contacts-section nand-ui-card${dragging ? ' is-dragging' : ''}`}
			onDragOver={(event) => {
				if (event.dataTransfer?.types.includes('Files')) {
					event.preventDefault();
					setDragging(true);
				}
			}}
			onDragLeave={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
			}}
			onDrop={(event) => {
				event.preventDefault();
				setDragging(false);
				if (event.dataTransfer?.files.length) view.addResources(record, Array.from(event.dataTransfer.files));
			}}
		>
			<div className="nand-contacts-section-title">
				<h3>{ct('resources', { count: resources.length })}</h3>
				<div className="nand-contacts-resource-actions">
					<button className="nand-ui-btn nand-ui-btn-ghost" onClick={() => view.newNote(record)}>
						{ct('newNote')}
					</button>
					<button className="nand-ui-btn nand-ui-btn-ghost" onClick={() => view.addResources(record)}>
						{ct('addResources')}
					</button>
				</div>
			</div>
			<div className="nand-contacts-resource-toolbar">
				<input
					type="search"
					aria-label={ct('searchResources')}
					placeholder={ct('searchResources')}
					value={search}
					onInput={(event) => {
						setSearch(event.currentTarget.value);
						setPage(0);
					}}
				/>
				<select
					aria-label={ct('sort')}
					value={sort}
					onChange={(event) => {
						setSort(event.currentTarget.value as 'modified' | 'name');
						setPage(0);
					}}
				>
					<option value="modified">{ct('byModified')}</option>
					<option value="name">{ct('resourceByName')}</option>
				</select>
			</div>
			{!matches.length && <p className="nand-contacts-muted">{ct(search ? 'noResults' : 'resourcesEmpty')}</p>}
			{!!matches.length && (
				<div className="nand-contacts-resource-list">
					<div className="nand-contacts-resource-row nand-contacts-resource-labels" aria-hidden="true">
						<span>{ct('fileName')}</span>
						<span>{ct('location')}</span>
						<span>{ct('fileType')}</span>
						<span>{ct('modified')}</span>
						<span>{ct('fileSize')}</span>
					</div>
					{matches.slice(page * 60, page * 60 + 60).map((file) => (
						<button
							className="nand-contacts-resource-row"
							key={file.path}
							onClick={() => view.openResource(file.path)}
							title={file.relativePath}
						>
							<span className="nand-contacts-resource-name">
								<Icon
									name={
										file.extension === 'pdf'
											? 'file-text'
											: /^(png|jpg|jpeg|gif|webp|svg)$/.test(file.extension)
												? 'image'
												: file.extension === 'md'
													? 'file-pen-line'
													: 'file'
									}
								/>
								<span>{file.name}</span>
							</span>
							<span className="nand-contacts-resource-location">
								{file.relativePath.includes('/')
									? file.relativePath.slice(0, file.relativePath.lastIndexOf('/'))
									: ct('folderRoot')}
							</span>
							<span className="nand-contacts-resource-type">{file.extension.toUpperCase() || '—'}</span>
							<time dateTime={new Date(file.modified).toISOString()}>
								{new Date(file.modified).toLocaleDateString()}
							</time>
							<span className="nand-contacts-resource-size">
								{file.size < 1024
									? `${file.size} B`
									: file.size < 1048576
										? `${Math.ceil(file.size / 1024)} KB`
										: `${(file.size / 1048576).toFixed(1)} MB`}
							</span>
						</button>
					))}
				</div>
			)}
			{pages > 1 && <Pager page={page} pages={pages} count={matches.length} go={setPage} live />}
		</section>
	);
}
