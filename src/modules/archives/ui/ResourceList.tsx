// Layout adapted from stablyai/orca 464bd5a54b3364021c5cc0319859616e5ec41bbf (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/settings/SettingsFormControls.tsx
import { Button } from '../../../ui/components/button';
import { Input } from '../../../ui/components/input';
import { Choice } from '../../../ui/components/nand/Choice';
import { useState } from 'react';
import type { ArchiveRecord } from '../core/model';
import { queryResources } from '../core/resources';
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
			className={`space-y-3 rounded-lg border border-border bg-card p-4 ${dragging ? 'ring-2 ring-ring' : ''}`}
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
			<div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
				<h3>{ct('resources', { count: resources.length })}</h3>
				<div className="flex flex-wrap gap-2">
					<Button variant="ghost" className="" onClick={() => view.newNote(record)}>
						{ct('newNote')}
					</Button>
					<Button variant="ghost" className="" onClick={() => view.addResources(record)}>
						{ct('addResources')}
					</Button>
				</div>
			</div>
			<div className="flex flex-wrap gap-2">
				<Input
					type="search"
					aria-label={ct('searchResources')}
					placeholder={ct('searchResources')}
					value={search}
					onChange={(event) => {
						setSearch(event.currentTarget.value);
						setPage(0);
					}}
				/>
				<Choice
					label={ct('sort')}
					value={sort}
					onChange={(value) => {
						setSort(value === 'name' ? 'name' : 'modified');
						setPage(0);
					}}
					options={[
						['modified', ct('byModified')],
						['name', ct('resourceByName')],
					]}
				/>
			</div>
			{!matches.length && (
				<p className="text-xs text-muted-foreground">{ct(search ? 'noResults' : 'resourcesEmpty')}</p>
			)}
			{!!matches.length && (
				<div className="overflow-x-auto">
					<div
						className="grid h-auto w-full min-w-[32rem] grid-cols-[2fr_1fr_4rem_6rem_5rem] items-center gap-2 whitespace-normal py-2 text-left text-xs text-muted-foreground"
						aria-hidden="true"
					>
						<span>{ct('fileName')}</span>
						<span>{ct('location')}</span>
						<span>{ct('fileType')}</span>
						<span>{ct('modified')}</span>
						<span>{ct('fileSize')}</span>
					</div>
					{matches.slice(page * 60, page * 60 + 60).map((file) => (
						<Button
							variant="ghost"
							className="grid h-auto w-full min-w-[32rem] grid-cols-[2fr_1fr_4rem_6rem_5rem] items-center gap-2 whitespace-normal py-2 text-left text-xs"
							key={file.path}
							data-resource-path={file.path}
							onClick={() => view.openResource(file.path)}
							title={file.relativePath}
						>
							<span className="flex items-center gap-2 break-all">
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
							<span className="truncate text-muted-foreground">
								{file.relativePath.includes('/')
									? file.relativePath.slice(0, file.relativePath.lastIndexOf('/'))
									: ct('folderRoot')}
							</span>
							<span className="text-muted-foreground">{file.extension.toUpperCase() || '—'}</span>
							<time dateTime={new Date(file.modified).toISOString()}>
								{new Date(file.modified).toLocaleDateString()}
							</time>
							<span className="tabular-nums">
								{file.size < 1024
									? `${file.size} B`
									: file.size < 1048576
										? `${Math.ceil(file.size / 1024)} KB`
										: `${(file.size / 1048576).toFixed(1)} MB`}
							</span>
						</Button>
					))}
				</div>
			)}
			{pages > 1 && <Pager page={page} pages={pages} count={matches.length} go={setPage} live />}
		</section>
	);
}
