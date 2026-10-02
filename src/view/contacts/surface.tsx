import { useEffect, useRef, useState, type ReactNode } from 'preact/compat';
import type { ArchiveRecord, EntityRef } from '../../core/contacts/model';
import { ct, relationDescription } from './labels';
import type { ContactsPanelHost } from './panel-contract';
import { Icon, Pager } from './ContactsPrimitives';
import { ResourceList } from './ResourceList';

/**
 * Round initial avatar. Grid cards keep the initial as a text node (as they
 * always have); elsewhere `decorative` draws it from a data attribute so the
 * surrounding button's text content stays unchanged.
 */
function Monogram({ name, size, decorative = false }: { name: string; size?: 'sm' | 'lg'; decorative?: boolean }) {
	const initial = [...name][0] || '?';
	const className = `nand-contacts-monogram${size ? ` nand-contacts-monogram--${size}` : ''}`;
	return decorative ? (
		<span className={className} data-initial={initial} aria-hidden="true" />
	) : (
		<span className={className} aria-hidden="true">
			{initial}
		</span>
	);
}
function Action({
	icon,
	label,
	action,
	disabled = false,
	primary = false,
}: {
	icon: string;
	label: string;
	action: () => void;
	disabled?: boolean;
	primary?: boolean;
}) {
	return (
		<button
			type="button"
			className={`clickable-icon nand-contacts-action nand-ui-icon-btn${primary ? ' mod-cta nand-contacts-action--primary' : ''}`}
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
	useEffect(() => {
		const host = ref.current;
		if (!host || !text.trim()) return;
		return view.mountMarkdown(host, text, path);
	}, [view, text, path]);
	return text.trim() ? (
		<div className="nand-contacts-markdown markdown-rendered" ref={ref} />
	) : (
		<p className="nand-contacts-muted nand-contacts-placeholder">{ct('noDetails')}</p>
	);
}
function Section({
	title,
	action,
	children,
	expanded = false,
	summary,
}: {
	title: string;
	action?: ReactNode;
	children: ReactNode;
	expanded?: boolean;
	summary?: string;
}) {
	const [open, setOpen] = useState(expanded);
	return (
		<section className="nand-contacts-section nand-ui-card">
			<div className="nand-contacts-section-title">
				<h3>
					{expanded ? (
						title
					) : (
						<button
							className="nand-contacts-section-toggle"
							aria-expanded={open}
							onClick={() => setOpen(!open)}
						>
							<Icon name={open ? 'chevron-down' : 'chevron-right'} />
							{title}
							{summary && <span className="nand-contacts-section-summary">{summary}</span>}
						</button>
					)}
				</h3>
				{action}
			</div>
			{open && children}
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
					<button className="nand-contacts-person" key={r.path} onClick={() => view.select(r.path)}>
						<Monogram name={r.fields.name} size="sm" decorative />
						<span className="nand-contacts-person-text">
							<span className="nand-contacts-person-name">{r.fields.name}</span>
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
						</span>
					</button>
				))}
			</div>
			{pages > 1 && <Pager page={page} pages={pages} count={records.length} go={setPage} />}
		</>
	) : (
		<p className="nand-contacts-muted nand-contacts-placeholder">{ct('noDetails')}</p>
	);
}
function Detail({ view, record }: { view: ContactsPanelHost; record: ArchiveRecord }) {
	const controller = view.controller!;
	const index = controller.index;
	const issues = index.issues(record),
		blocked = issues.length > 0;
	const edit = (scope: Parameters<ContactsPanelHost['edit']>[1], id?: string) => view.edit(record, scope, id);
	const rows = (
		[
			'mobiles',
			'phones',
			'emails',
			'wechat',
			'region',
			'website',
			'aliases',
			'birthday',
			'birthplace',
			'tags',
		] as const
	)
		.map((key) => [key, record.fields[key]] as const)
		.filter(([, value]) => (Array.isArray(value) ? value.length : value));
	const members = record.kind === 'company' ? index.members(record.id, 'current') : [];
	const keyPeople = members.filter((person) =>
		person.employments.some((j) => j.company.id === record.id && j.status === 'current' && !!j.keyRole),
	);
	return (
		<article className="nand-contacts-detail">
			<header className="nand-contacts-detail-heading nand-contacts-profile nand-ui-card">
				<Monogram name={record.fields.name} size="lg" decorative />
				<div className="nand-contacts-profile-text">
					<h2>{record.fields.name}</h2>
					<span className="nand-contacts-muted nand-ui-badge nand-ui-badge--accent">{ct(record.kind)}</span>
				</div>
				{/* Same actions and conditions the header toolbar used to show for an open record;
				    the header-actions class keeps them on the pane menu on phones. */}
				<div className="nand-contacts-header-actions nand-contacts-profile-actions">
					<Action
						icon="pencil"
						label={ct('edit')}
						action={() => view.edit(record, 'basic')}
						disabled={!!index.issues(record).length}
					/>
					<Action icon="more-horizontal" label={ct('more')} action={() => view.more(record)} />
				</div>
			</header>
			{blocked && (
				<div role="alert" className="nand-contacts-error nand-contacts-banner">
					<Icon name="alert-triangle" className="nand-contacts-banner-icon" />
					<span>
						{ct('problem')}
						{issues.map((key) => ct(key)).join(' ')}
					</span>
				</div>
			)}
			<Section title={ct('basic')} expanded>
				{!rows.length && <p className="nand-contacts-muted nand-contacts-placeholder">{ct('noDetails')}</p>}
				<dl className="nand-contacts-fields">
					{rows.map(([key, value]) => (
						<div key={key}>
							<dt>{ct(key === 'region' && record.kind === 'company' ? 'companyRegion' : key)}</dt>
							<dd>{Array.isArray(value) ? value.join(' · ') : value}</dd>
						</div>
					))}
				</dl>
			</Section>
			{!blocked && <ResourceList key={record.id} view={view} record={record} />}
			{record.kind === 'person' && (
				<>
					<Section
						title={`${ct('employments')} (${record.employments.length})`}
						action={
							<Action
								icon="plus"
								label={ct('add')}
								action={() => edit('employment')}
								disabled={blocked}
							/>
						}
					>
						{!record.employments.length && (
							<p className="nand-contacts-muted nand-contacts-placeholder">{ct('noDetails')}</p>
						)}
						{[...record.employments]
							.sort((a, b) => b.start.localeCompare(a.start))
							.map((job) => (
								<div className="nand-contacts-entry" key={job.id}>
									<div>
										<div className="nand-contacts-entry-head">
											<RefLink view={view} source={record} target={job.company} />
											<span
												className={`nand-contacts-tag nand-ui-badge${job.status === 'current' ? ' nand-ui-badge--accent' : ''}`}
											>
												{ct(job.status)}
											</span>
											{job.keyRole && (
												<span className="nand-contacts-tag nand-ui-badge nand-ui-badge--info">
													{ct(job.keyRole)}
												</span>
											)}
										</div>
										<p>{[job.department, job.title].filter(Boolean).join(' · ')}</p>
										<p className="nand-contacts-muted nand-contacts-dates">
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
						title={`${ct('relations')} (${index.relationsFor(record.id).length})`}
						action={
							<Action icon="plus" label={ct('add')} action={() => edit('relation')} disabled={blocked} />
						}
					>
						{!index.relationsFor(record.id).length && (
							<p className="nand-contacts-muted nand-contacts-placeholder">{ct('noDetails')}</p>
						)}
						{index.relationsFor(record.id).map((entry) => (
							<div
								className="nand-contacts-entry"
								key={entry.owner.path + entry.relation.id + String(entry.inverse)}
							>
								<div>
									<div className="nand-contacts-entry-head">
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
										<span className="nand-contacts-tag nand-ui-badge nand-ui-badge--accent">
											{relationDescription(entry.relation, entry.inverse, entry.owner)}
										</span>
									</div>
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
					<Section title={`${ct('keyPeople')} (${keyPeople.length})`}>
						<People key={record.id} companyId={record.id} keyOnly view={view} records={keyPeople} />
					</Section>
					<Section title={ct('employees', { count: members.length })}>
						<People key={record.id} companyId={record.id} view={view} records={members} />
					</Section>
					<Section title={`${ct('pastPeople')} (${index.members(record.id, 'past').length})`}>
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
					summary={record.prose[key].replace(/\s+/g, ' ').trim().slice(0, 40)}
					action={
						<Action
							icon={record.prose[key].trim() ? 'pencil' : 'plus'}
							label={ct(record.prose[key].trim() ? 'edit' : 'add')}
							action={() => edit(key)}
							disabled={blocked}
						/>
					}
				>
					<Markdown view={view} text={record.prose[key]} path={record.path} />
				</Section>
			))}
		</article>
	);
}
export function ContactsSurface({ view }: { view: ContactsPanelHost }) {
	const controller = view.controller;
	if (!view.enabled || !controller)
		return (
			<div className="nand-contacts-empty">
				<Icon name="contact-round" className="nand-contacts-empty-icon" />
				{ct('disabled')}
			</div>
		);
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
			<header className={`nand-contacts-header nand-ui-toolbar${selectedPath ? ' is-detail' : ''}`}>
				{selectedPath ? (
					<Action icon="arrow-left" label={ct('back')} action={() => view.back()} />
				) : (
					<div className="nand-contacts-tabs nand-ui-segmented" role="group" aria-label={ct('title')}>
						{(['person', 'company'] as const).map((kind) => (
							<button
								key={kind}
								aria-pressed={query.kind === kind}
								className={query.kind === kind ? 'is-active' : ''}
								onClick={() => view.changeKind(kind)}
							>
								{ct(kind)}
							</button>
						))}
					</div>
				)}
				{!selectedPath && (
					<div className="nand-contacts-search">
						<Icon name="search" className="nand-contacts-search-icon" />
						<input
							type="search"
							aria-label={ct(query.kind === 'person' ? 'searchPeople' : 'searchCompanies')}
							placeholder={ct(query.kind === 'person' ? 'searchPeople' : 'searchCompanies')}
							value={query.search}
							onInput={(event) => view.search(event.currentTarget.value)}
						/>
					</div>
				)}
				{!selectedPath && (
					<div className="nand-contacts-header-actions">
						<Action icon="list-filter" label={ct('filter')} action={() => view.filters()} />
						<Action
							icon="arrow-down-wide-narrow"
							label={ct(query.sort === 'name' ? 'byName' : 'byModified')}
							action={() => view.sort()}
						/>
						<Action icon="plus" label={ct('add')} action={() => view.add(query.kind)} primary />
					</div>
				)}
			</header>
			{controller.error && (
				<div role="alert" className="nand-contacts-error nand-contacts-banner">
					<Icon name="alert-triangle" className="nand-contacts-banner-icon" />
					<span>{ct(controller.error)} </span>
					<button className="nand-ui-btn" onClick={() => void controller.reload()}>
						{ct('retry')}
					</button>
				</div>
			)}
			{controller.loading && (
				<p role="status" className="nand-contacts-muted nand-contacts-status">
					{ct('loading')}
				</p>
			)}
			{selectedPath ? (
				record ? (
					<Detail key={record.id} view={view} record={record} />
				) : (
					!controller.loading && <p className="nand-contacts-status">{ct('missing')}</p>
				)
			) : (
				<>
					{hasFilter && (
						<button
							className="nand-contacts-clear nand-ui-btn nand-ui-btn-ghost"
							onClick={() => view.clearFilters()}
						>
							<Icon name="x" />
							{ct('clear')}
						</button>
					)}
					<div className={`nand-contacts-grid nand-contacts-columns-${view.columns}`}>
						{records.slice(page * 60, page * 60 + 60).map((r) => (
							<button
								className="nand-contacts-card nand-ui-card"
								key={r.path}
								onClick={() => view.select(r.path)}
							>
								<span className="nand-contacts-card-title">
									<Monogram name={r.fields.name} />
									<span className="nand-contacts-card-heading">
										<strong>{r.fields.name}</strong>
										{r.kind === 'person' ? (
											<span className="nand-contacts-card-subtitle">
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
										) : (
											<span className="nand-contacts-card-subtitle">
												{ct('employees', {
													count: controller.index.members(r.id, 'current').length,
												})}
											</span>
										)}
									</span>
								</span>
								<span className="nand-contacts-card-meta">
									{r.kind === 'person' && (
										<span className="nand-contacts-muted nand-contacts-meta-row">
											<Icon name="phone" />
											<span>{r.fields.mobiles[0] || r.fields.phones[0] || '—'}</span>
										</span>
									)}
									<span className="nand-contacts-muted nand-contacts-meta-row">
										<Icon name="map-pin" />
										<span>{r.fields.region || '—'}</span>
									</span>
								</span>
								<span className="nand-contacts-card-tags">
									{r.fields.tags.slice(0, 4).map((tag) => (
										<span key={tag} className="nand-contacts-tag">
											{tag}
										</span>
									))}
								</span>
								{!!controller.index.issues(r).length && (
									<span className="nand-contacts-error nand-ui-badge nand-ui-badge--error">
										<Icon name="alert-triangle" />
										{ct('problem')}
									</span>
								)}
							</button>
						))}
					</div>
					{!records.length && !controller.loading && (
						<div className="nand-contacts-empty">
							<Icon
								name={
									query.search || hasFilter
										? 'search-x'
										: query.kind === 'company'
											? 'building-2'
											: 'contact-round'
								}
								className="nand-contacts-empty-icon"
							/>
							<p>{ct(query.search || hasFilter ? 'noResults' : 'empty')}</p>
							<button className="mod-cta nand-ui-btn" onClick={() => view.add(query.kind)}>
								{ct('add')}
							</button>
						</div>
					)}
					{records.length > 60 && (
						<Pager
							page={page}
							pages={pages}
							count={records.length}
							go={(value) => view.page(value)}
							live
							footer
						/>
					)}
				</>
			)}
		</div>
	);
}
