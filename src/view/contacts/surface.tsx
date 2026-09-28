import { setIcon } from 'obsidian';
import { useEffect, useRef, useState, type ReactNode } from 'preact/compat';
import type { ArchiveRecord, EntityRef } from '../../core/contacts/model';
import { ct, relationDescription } from './forms';
import type { ContactsPanelHost } from './panel-contract';

function Icon({ name }: { name: string }) {
	const ref = useRef<HTMLSpanElement>(null);
	useEffect(() => {
		if (ref.current) setIcon(ref.current, name);
	}, [name]);
	return <span ref={ref} aria-hidden="true" />;
}
function Action({
	icon,
	label,
	action,
	disabled = false,
}: {
	icon: string;
	label: string;
	action: () => void;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			className="clickable-icon nand-contacts-action"
			aria-label={label}
			title={label}
			disabled={disabled}
			onClick={action}
		>
			<Icon name={icon} />
		</button>
	);
}
function Markdown({ view, text, path }: { view: ContactsPanelHost; text: string; path: string }) {
	const ref = useRef<HTMLDivElement>(null);
	const markdown = text.trim() ? text : ct('noDetails');
	useEffect(() => {
		const host = ref.current;
		if (!host) return;
		return view.mountMarkdown(host, markdown, path);
	}, [view, text, path, markdown]);
	return <div className="nand-contacts-markdown markdown-rendered" ref={ref} />;
}
function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
	return (
		<section className="nand-contacts-section">
			<div className="nand-contacts-section-title">
				<h3>{title}</h3>
				{action}
			</div>
			{children}
		</section>
	);
}
function RefLink({ view, source, target }: { view: ContactsPanelHost; source: ArchiveRecord; target: EntityRef }) {
	const record = view.controller?.index.resolve(target, source);
	return record ? (
		<button className="nand-contacts-link" onClick={() => view.select(record.path)}>
			{record.fields.name}
		</button>
	) : (
		<span className="nand-contacts-muted" title={ct('missing')}>
			{target.label || ct('none')} {target.label ? '· ' + ct('missing') : ''}
		</span>
	);
}
function People({
	view,
	records,
	companyId,
	status = 'current',
	keyOnly = false,
}: {
	view: ContactsPanelHost;
	records: ArchiveRecord[];
	companyId: string;
	status?: 'current' | 'past';
	keyOnly?: boolean;
}) {
	const [requestedPage, setPage] = useState(0);
	const pages = Math.max(1, Math.ceil(records.length / 60));
	const page = Math.min(requestedPage, pages - 1);
	return records.length ? (
		<>
			<div className="nand-contacts-people">
				{records.slice(page * 60, page * 60 + 60).map((r) => (
					<button key={r.path} onClick={() => view.select(r.path)}>
						{r.fields.name}
						<span className="nand-contacts-muted">
							{r.employments
								.filter(
									(job) =>
										job.company.id === companyId &&
										job.status === status &&
										(!keyOnly || !!job.keyRole),
								)
								.map((job) =>
									[job.title, job.keyRole ? ct(job.keyRole) : ''].filter(Boolean).join(' · '),
								)
								.join(' / ')}
						</span>
					</button>
				))}
			</div>
			{pages > 1 && (
				<div className="nand-contacts-pagination">
					<button disabled={page === 0} onClick={() => setPage(page - 1)}>
						{ct('previous')}
					</button>
					<span>{ct('page', { page: page + 1, total: pages, count: records.length })}</span>
					<button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
						{ct('next')}
					</button>
				</div>
			)}
		</>
	) : (
		<p className="nand-contacts-muted">{ct('noDetails')}</p>
	);
}
function Detail({ view, record }: { view: ContactsPanelHost; record: ArchiveRecord }) {
	const controller = view.controller!;
	const index = controller.index;
	const issues = index.issues(record),
		blocked = issues.length > 0;
	const edit = (scope: Parameters<ContactsPanelHost['edit']>[1], id?: string) => view.edit(record, scope, id);
	const rows = Object.entries(record.fields).filter(
		([key, value]) => key !== 'name' && (Array.isArray(value) ? value.length : value),
	);
	const members = record.kind === 'company' ? index.members(record.id, 'current') : [];
	const keyPeople = members.filter((person) =>
		person.employments.some((j) => j.company.id === record.id && j.status === 'current' && !!j.keyRole),
	);
	return (
		<article className="nand-contacts-detail">
			<div className="nand-contacts-detail-heading">
				<h2>{record.fields.name}</h2>
				<span className="nand-contacts-muted">{ct(record.kind)}</span>
			</div>
			{blocked && (
				<div role="alert" className="nand-contacts-error">
					{ct('problem')}
					{issues.map((key) => ct(key)).join(' ')}
				</div>
			)}
			<Section
				title={ct('basic')}
				action={<Action icon="pencil" label={ct('edit')} action={() => edit('basic')} disabled={blocked} />}
			>
				{!rows.length && <p className="nand-contacts-muted">{ct('noDetails')}</p>}
				<dl className="nand-contacts-fields">
					{rows.map(([key, value]) => (
						<div key={key}>
							<dt>{ct(key === 'region' && record.kind === 'company' ? 'companyRegion' : key)}</dt>
							<dd>{Array.isArray(value) ? value.join(' · ') : value}</dd>
						</div>
					))}
				</dl>
			</Section>
			{record.kind === 'person' && (
				<>
					<Section
						title={ct('employments')}
						action={
							<Action
								icon="plus"
								label={ct('add')}
								action={() => edit('employment')}
								disabled={blocked}
							/>
						}
					>
						{!record.employments.length && <p className="nand-contacts-muted">{ct('noDetails')}</p>}
						{[...record.employments]
							.sort((a, b) => b.start.localeCompare(a.start))
							.map((job) => (
								<div className="nand-contacts-entry" key={job.id}>
									<div>
										<RefLink view={view} source={record} target={job.company} />
										<span className="nand-contacts-tag">{ct(job.status)}</span>
										{job.keyRole && <span className="nand-contacts-tag">{ct(job.keyRole)}</span>}
										<p>{[job.department, job.title].filter(Boolean).join(' · ')}</p>
										<p className="nand-contacts-muted">
											{job.start || '—'} →{' '}
											{job.end || (job.status === 'current' ? ct('current') : '—')}
										</p>
										{job.notes && <p className="nand-contacts-prewrap">{job.notes}</p>}
									</div>
									<div className="nand-contacts-row-actions">
										<Action
											icon="pencil"
											label={ct('edit')}
											action={() => edit('employment', job.id)}
											disabled={blocked}
										/>
										<Action
											icon="trash-2"
											label={ct('delete')}
											action={() => view.deleteRow(record, 'employment', job.id)}
											disabled={blocked}
										/>
									</div>
								</div>
							))}
					</Section>
					<Section
						title={ct('relations')}
						action={
							<Action icon="plus" label={ct('add')} action={() => edit('relation')} disabled={blocked} />
						}
					>
						{!index.relationsFor(record.id).length && (
							<p className="nand-contacts-muted">{ct('noDetails')}</p>
						)}
						{index.relationsFor(record.id).map((entry) => (
							<div
								className="nand-contacts-entry"
								key={entry.owner.path + entry.relation.id + String(entry.inverse)}
							>
								<div>
									{entry.other ? (
										<button
											className="nand-contacts-link"
											onClick={() => view.select(entry.other!.path)}
										>
											{entry.other.fields.name}
										</button>
									) : (
										<span>
											{entry.relation.person.label} · {ct('missing')}
										</span>
									)}
									<span className="nand-contacts-tag">
										{relationDescription(entry.relation, entry.inverse, entry.owner)}
									</span>
									{entry.inverse && <p className="nand-contacts-muted">{ct('incoming')}</p>}
									{entry.relation.company.label && (
										<p>
											<RefLink view={view} source={entry.owner} target={entry.relation.company} />
										</p>
									)}
									{entry.relation.notes && (
										<p className="nand-contacts-prewrap">{entry.relation.notes}</p>
									)}
								</div>
								<div className="nand-contacts-row-actions">
									<Action
										icon="pencil"
										label={ct('edit')}
										action={() => view.edit(entry.owner, 'relation', entry.relation.id)}
										disabled={!!index.issues(entry.owner).length}
									/>
									<Action
										icon="trash-2"
										label={ct('delete')}
										action={() => view.deleteRow(entry.owner, 'relation', entry.relation.id)}
										disabled={!!index.issues(entry.owner).length}
									/>
								</div>
							</div>
						))}
					</Section>
				</>
			)}
			{record.kind === 'company' && (
				<>
					<Section title={ct('keyPeople')}>
						<People key={record.id} companyId={record.id} keyOnly view={view} records={keyPeople} />
					</Section>
					<Section title={ct('employees', { count: members.length })}>
						<People key={record.id} companyId={record.id} view={view} records={members} />
					</Section>
					<Section title={ct('pastPeople')}>
						<People
							key={record.id}
							companyId={record.id}
							view={view}
							status="past"
							records={index.members(record.id, 'past')}
						/>
					</Section>
				</>
			)}
			{(record.kind === 'person' ? (['traits', 'habits', 'notes'] as const) : (['notes'] as const)).map((key) => (
				<Section
					key={key}
					title={ct(key === 'notes' && record.kind === 'company' ? 'companyNotes' : key)}
					action={<Action icon="pencil" label={ct('edit')} action={() => edit(key)} disabled={blocked} />}
				>
					<Markdown view={view} text={record.prose[key]} path={record.path} />
				</Section>
			))}
		</article>
	);
}
export function ContactsSurface({ view }: { view: ContactsPanelHost }) {
	const controller = view.controller;
	if (!view.enabled || !controller) return <div className="nand-contacts-empty">{ct('disabled')}</div>;
	const { query, selectedPath } = view.state;
	const candidate = selectedPath ? controller.index.byPath.get(selectedPath) : undefined;
	const record =
		candidate && (!view.state.selectedId || candidate.id === view.state.selectedId) ? candidate : undefined;
	const records = selectedPath ? [] : controller.index.query(query);
	const pages = Math.max(1, Math.ceil(records.length / 60)),
		page = Math.min(view.state.page, pages - 1);
	const hasFilter = [query.current, query.past, query.regions, query.tags, query.relations].some(
		(values) => values.length,
	);
	return (
		<div className="nand-contacts-surface">
			<header className="nand-contacts-header">
				{selectedPath ? (
					<Action icon="arrow-left" label={ct('back')} action={() => view.back()} />
				) : (
					<div className="nand-contacts-tabs" role="group" aria-label={ct('title')}>
						{(['person', 'company'] as const).map((kind) => (
							<button
								key={kind}
								aria-pressed={query.kind === kind}
								className={query.kind === kind ? 'mod-cta' : ''}
								onClick={() => view.changeKind(kind)}
							>
								{ct(kind)}
							</button>
						))}
					</div>
				)}
				{!selectedPath && (
					<input
						type="search"
						aria-label={ct('search')}
						placeholder={ct('search')}
						value={query.search}
						onInput={(event) => view.search(event.currentTarget.value)}
					/>
				)}
				<div className="nand-contacts-header-actions">
					{!selectedPath && (
						<>
							<Action icon="list-filter" label={ct('filter')} action={() => view.filters()} />
							<Action
								icon="arrow-down-wide-narrow"
								label={ct(query.sort === 'name' ? 'byName' : 'byModified')}
								action={() => view.sort()}
							/>
							<Action icon="plus" label={ct('add')} action={() => view.add(query.kind)} />
						</>
					)}
					{record && (
						<>
							<Action
								icon="pencil"
								label={ct('edit')}
								action={() => view.edit(record, 'basic')}
								disabled={!!controller.index.issues(record).length}
							/>
							<Action icon="more-horizontal" label={ct('more')} action={() => view.more(record)} />
						</>
					)}
				</div>
			</header>
			{controller.error && (
				<div role="alert" className="nand-contacts-error">
					{ct(controller.error)} <button onClick={() => void controller.reload()}>{ct('retry')}</button>
				</div>
			)}
			{controller.loading && (
				<p role="status" className="nand-contacts-muted">
					{ct('loading')}
				</p>
			)}
			{selectedPath ? (
				record ? (
					<Detail view={view} record={record} />
				) : (
					!controller.loading && <p>{ct('missing')}</p>
				)
			) : (
				<>
					{hasFilter && (
						<button className="nand-contacts-clear" onClick={() => view.clearFilters()}>
							{ct('clear')}
						</button>
					)}
					<div className={`nand-contacts-grid nand-contacts-columns-${view.columns}`}>
						{records.slice(page * 60, page * 60 + 60).map((r) => (
							<button className="nand-contacts-card" key={r.path} onClick={() => view.select(r.path)}>
								<span className="nand-contacts-card-title">
									<span className="nand-contacts-monogram">{[...r.fields.name][0] || '?'}</span>
									<strong>{r.fields.name}</strong>
								</span>
								{r.kind === 'person' ? (
									<>
										<span>
											{r.employments
												.filter((job) => job.status === 'current')
												.map((job) =>
													[
														controller.index.resolve(job.company, r)?.fields.name ??
															job.company.label,
														job.title,
													]
														.filter(Boolean)
														.join(' · '),
												)
												.join(' / ') || ct('noDetails')}
										</span>
										<span className="nand-contacts-muted">
											{r.fields.mobiles[0] || r.fields.phones[0] || '—'}
										</span>
									</>
								) : (
									<span>
										{ct('employees', { count: controller.index.members(r.id, 'current').length })}
									</span>
								)}
								<span className="nand-contacts-muted">{r.fields.region || '—'}</span>
								<span>
									{r.fields.tags.slice(0, 4).map((tag) => (
										<span key={tag} className="nand-contacts-tag">
											{tag}
										</span>
									))}
								</span>
								{!!controller.index.issues(r).length && (
									<span className="nand-contacts-error">{ct('problem')}</span>
								)}
							</button>
						))}
					</div>
					{!records.length && !controller.loading && (
						<div className="nand-contacts-empty">
							<p>{ct(query.search || hasFilter ? 'noResults' : 'empty')}</p>
							<button className="mod-cta" onClick={() => view.add(query.kind)}>
								{ct('add')}
							</button>
						</div>
					)}
					{records.length > 60 && (
						<footer className="nand-contacts-pagination">
							<button disabled={page === 0} onClick={() => view.page(page - 1)}>
								{ct('previous')}
							</button>
							<span aria-live="polite">
								{ct('page', { page: page + 1, total: pages, count: records.length })}
							</span>
							<button disabled={page + 1 >= pages} onClick={() => view.page(page + 1)}>
								{ct('next')}
							</button>
						</footer>
					)}
				</>
			)}
		</div>
	);
}
