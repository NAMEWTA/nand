// Layout adapted from stablyai/orca 464bd5a54b3364021c5cc0319859616e5ec41bbf (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/settings/SettingsFormControls.tsx
import { Button } from '../../../ui/components/button';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '../../../ui/components/dropdown-menu';
import { ActionButton } from '../../../ui/components/nand/ActionButton';
import { useT } from '../../../ui/react/hooks';
import { Input } from '../../../ui/components/input';
import type { ArchiveRecord, EntityRef } from '../core/model';
import { ct, relationDescription } from './labels';
import type { ContactsPanelHost } from './panel-contract';
import { Icon, Pager } from './ContactsPrimitives';
import { ResourceList } from './ResourceList';
import { ArchiveCardGrid } from './ArchiveCardGrid';

/**
 * Round initial avatar. Grid cards keep the initial as a text node (as they
 * always have); elsewhere `decorative` draws it from a data attribute so the
 * surrounding button's text content stays unchanged.
 */
function Monogram({ name, size, decorative = false }: { name: string; size?: 'sm' | 'lg'; decorative?: boolean }) {
	const initial = [...name][0] || '?';
	const className = `inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold before:content-[attr(data-initial)] ${size === 'lg' ? 'size-14 text-xl' : size === 'sm' ? 'size-8 text-sm' : 'size-10 text-base'}`;
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
		<ActionButton label={label} variant={primary ? 'default' : 'ghost'} disabled={disabled} onClick={action}>
			<Icon name={icon} />
		</ActionButton>
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
		<div className="nand-native markdown-rendered" ref={ref} />
	) : (
		<p className="text-xs text-muted-foreground py-2">{ct('noDetails')}</p>
	);
}
function Section({
	title,
	action,
	children,
	expanded = false,
	initialOpen = false,
	summary,
}: {
	title: string;
	action?: ReactNode;
	children: ReactNode;
	expanded?: boolean;
	initialOpen?: boolean;
	summary?: string;
}) {
	const [open, setOpen] = useState(expanded || initialOpen);
	return (
		<section className="space-y-3 rounded-lg border border-border bg-card p-4">
			<div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
				<h3>
					{expanded ? (
						title
					) : (
						<Button
							variant="ghost"
							className="h-auto justify-start whitespace-normal p-0"
							aria-expanded={open}
							onClick={() => setOpen(!open)}
						>
							<Icon name={open ? 'chevron-down' : 'chevron-right'} />
							{title}
							{summary && <span className="text-xs font-normal text-muted-foreground">{summary}</span>}
						</Button>
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
		<Button
			variant="ghost"
			className="h-auto whitespace-normal p-0 text-primary underline-offset-4 hover:underline"
			onClick={() => view.select(record.path)}
		>
			{record.fields.name}
		</Button>
	) : (
		<span className="text-xs text-muted-foreground" title={ct('missing')}>
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
			<div className="grid gap-2 sm:grid-cols-2">
				{records.slice(page * 60, page * 60 + 60).map((r) => (
					<Button
						variant="ghost"
						className="h-auto justify-start gap-3 whitespace-normal p-3 text-left"
						key={r.path}
						onClick={() => view.select(r.path)}
					>
						<Monogram name={r.fields.name} size="sm" decorative />
						<span className="flex min-w-0 flex-col items-start gap-1">
							<span className="text-sm font-medium">{r.fields.name}</span>
							<span className="text-xs text-muted-foreground">
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
					</Button>
				))}
			</div>
			{pages > 1 && <Pager page={page} pages={pages} count={records.length} go={setPage} />}
		</>
	) : (
		<p className="text-xs text-muted-foreground py-2">{ct('noDetails')}</p>
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
	const bodyLine = index.hit(record, view.state.query.search, view.state.query.scope)?.line;
	const members = record.kind === 'company' ? index.members(record.id, 'current') : [];
	const keyPeople = members.filter((person) =>
		person.employments.some((j) => j.company.id === record.id && j.status === 'current' && !!j.keyRole),
	);
	return (
		<article className="mx-auto max-w-4xl space-y-4">
			<header className="flex items-center gap-3  rounded-lg border border-border bg-card p-4">
				<Monogram name={record.fields.name} size="lg" decorative />
				<div className="min-w-0 flex-1 space-y-1 text-lg font-semibold">
					<h2>{record.fields.name}</h2>
					<span className="text-xs text-muted-foreground inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-primary">
						{ct(record.kind)}
					</span>
				</div>
				{/* Same actions and conditions the header toolbar used to show for an open record;
				    the header-actions class keeps them on the pane menu on phones. */}
				<div className="flex items-center gap-1 ml-auto">
					<Action
						icon="pencil"
						label={ct('edit')}
						action={() => view.edit(record, 'basic')}
						disabled={!!index.issues(record).length}
					/>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" aria-label={ct('more')}>
								<Icon name="more-horizontal" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							{view.recordActions(record).map((action) => (
								<DropdownMenuItem key={action.title} disabled={action.disabled} onSelect={action.run}>
									<Icon name={action.icon} />
									{action.title}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</header>
			{view.state.focus === 'body' && (
				<p className="h-auto whitespace-normal text-left text-xs text-muted-foreground">
					{bodyLine ? ct('bodyHint', { line: bodyLine }) : ct('bodyHintUnmapped')}{' '}
					<Button
						variant="ghost"
						type="button"
						className=""
						onClick={() => view.openResource(record.path, bodyLine)}
					>
						{ct('source')}
					</Button>
				</p>
			)}
			{blocked && (
				<div
					role="alert"
					className="text-destructive flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
				>
					<Icon name="alert-triangle" className="size-4 shrink-0" />
					<span>
						{ct('problem')}
						{issues.map((key) => ct(key)).join(' ')}
					</span>
				</div>
			)}
			<Section title={ct('basic')} expanded>
				{!rows.length && <p className="text-xs text-muted-foreground py-2">{ct('noDetails')}</p>}
				<dl className="grid gap-3 text-sm sm:grid-cols-2 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:break-words">
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
						initialOpen={view.state.focus === 'employment'}
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
							<p className="text-xs text-muted-foreground py-2">{ct('noDetails')}</p>
						)}
						{[...record.employments]
							.sort((a, b) => b.start.localeCompare(a.start))
							.map((job) => (
								<div
									className="flex items-start justify-between gap-3 border-t border-border py-3"
									key={job.id}
								>
									<div>
										<div className="flex flex-wrap items-center gap-2">
											<RefLink view={view} source={record} target={job.company} />
											<span
												className={`rounded-full bg-secondary px-2 py-0.5 text-xs ${job.status === 'current' ? 'text-primary' : 'text-muted-foreground'}`}
											>
												{ct(job.status)}
											</span>
											{job.keyRole && (
												<span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-xs inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-status-info">
													{ct(job.keyRole)}
												</span>
											)}
										</div>
										<p>{[job.department, job.title].filter(Boolean).join(' · ')}</p>
										<p className="text-xs text-muted-foreground mt-1">
											{job.start || '—'} →{' '}
											{job.end || (job.status === 'current' ? ct('current') : '—')}
										</p>
										{job.notes && <p className="whitespace-pre-wrap text-sm">{job.notes}</p>}
									</div>
									<div className="flex items-center gap-1">
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
						initialOpen={view.state.focus === 'relation'}
						title={`${ct('relations')} (${index.relationsFor(record.id).length})`}
						action={
							<Action icon="plus" label={ct('add')} action={() => edit('relation')} disabled={blocked} />
						}
					>
						{!index.relationsFor(record.id).length && (
							<p className="text-xs text-muted-foreground py-2">{ct('noDetails')}</p>
						)}
						{index.relationsFor(record.id).map((entry) => (
							<div
								className="flex items-start justify-between gap-3 border-t border-border py-3"
								key={entry.owner.path + entry.relation.id + String(entry.inverse)}
							>
								<div>
									<div className="flex flex-wrap items-center gap-2">
										{entry.other ? (
											<Button
												variant="ghost"
												className="h-auto whitespace-normal p-0 text-primary underline-offset-4 hover:underline"
												onClick={() => view.select(entry.other!.path)}
											>
												{entry.other.fields.name}
											</Button>
										) : (
											<span>
												{entry.relation.person.label} · {ct('missing')}
											</span>
										)}
										<span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-xs inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-primary">
											{relationDescription(entry.relation, entry.inverse, entry.owner)}
										</span>
									</div>
									{entry.inverse && <p className="text-xs text-muted-foreground">{ct('incoming')}</p>}
									{entry.relation.company.label && (
										<p>
											<RefLink view={view} source={entry.owner} target={entry.relation.company} />
										</p>
									)}
									{entry.relation.notes && (
										<p className="whitespace-pre-wrap text-sm">{entry.relation.notes}</p>
									)}
								</div>
								<div className="flex items-center gap-1">
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
					initialOpen={view.state.focus === key}
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
function currentJobs(view: ContactsPanelHost, record: ArchiveRecord): string {
	return record.employments
		.filter((job) => job.status === 'current')
		.map((job) =>
			[view.controller?.index.resolve(job.company, record)?.fields.name ?? job.company.label, job.title]
				.filter(Boolean)
				.join(' · '),
		)
		.filter(Boolean)
		.join(' / ');
}
function SearchField({ label, value, onSearch }: { label: string; value: string; onSearch: (value: string) => void }) {
	const composing = useRef(false);
	const [draft, setDraft] = useState(value),
		[previous, setPrevious] = useState(value);
	if (value !== previous) {
		setPrevious(value);
		setDraft(value);
	}
	return (
		<div className="relative min-w-40 flex-1">
			<Icon name="search" className="pointer-events-none absolute left-2 top-2.5 size-4 text-muted-foreground" />
			<Input
				className="pl-8"
				type="search"
				aria-label={label}
				placeholder={label}
				value={draft}
				onCompositionStart={() => {
					composing.current = true;
				}}
				onCompositionEnd={(event) => {
					composing.current = false;
					setDraft(event.currentTarget.value);
					onSearch(event.currentTarget.value);
				}}
				onChange={(event) => {
					setDraft(event.currentTarget.value);
					if (composing.current) return;
					onSearch(event.currentTarget.value);
				}}
			/>
		</div>
	);
}
function copyText(value: string, owner: Window): void {
	const clipboard = owner.navigator.clipboard;
	if (clipboard) void clipboard.writeText(value);
}
/** A company's notes section is titled "special notes"; the hit label says the same. */
function hitSource(record: ArchiveRecord, source: string): string {
	return record.kind === 'company' && source === 'notes' ? ct('companyNotes') : ct(`hit.${source}`);
}
function HitLine({ view, record, plain = false }: { view: ContactsPanelHost; record: ArchiveRecord; plain?: boolean }) {
	const { search, scope } = view.state.query;
	const hit = search.trim() ? view.controller?.index.hit(record, search, scope) : undefined;
	if (!hit) return null;
	const label = `${ct('hit', { source: hitSource(record, hit.source) })} ${hit.snippet}`;
	return plain ? (
		<span className="h-auto whitespace-normal text-left text-xs text-muted-foreground">{label}</span>
	) : (
		<Button
			variant="ghost"
			type="button"
			className="h-auto whitespace-normal text-left text-xs text-muted-foreground"
			onClick={() => view.select(record.path, hit.source)}
		>
			{label}
		</Button>
	);
}
function RecordRow({ view, record }: { view: ContactsPanelHost; record: ArchiveRecord }) {
	const email = record.kind === 'person' ? record.fields.emails[0] : '';
	const extra = record.kind === 'person' ? Math.max(0, record.fields.emails.length - 1) : 0;
	const jobs = record.kind === 'person' ? currentJobs(view, record) : '';
	const indexed =
		record.kind === 'company'
			? ct('indexed', { count: view.controller?.index.members(record.id, 'current').length ?? 0 })
			: '';
	const secondary =
		record.kind === 'person' ? [jobs, record.fields.region] : [record.fields.region, record.fields.website];
	const emailText = email ? (extra > 0 ? `${email} +${extra}` : email) : '';
	return (
		<div
			className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4"
			role="listitem"
			data-path={record.path}
		>
			<Button
				variant="ghost"
				type="button"
				className="justify-start text-left font-medium"
				onClick={() => view.select(record.path)}
			>
				{record.fields.name}
			</Button>
			<div className="hidden min-w-0 flex-1 grid-cols-4 items-center gap-3 lg:grid">
				<span className="text-xs text-muted-foreground">
					{record.kind === 'person' ? jobs || ct('noDetails') : record.fields.region || '—'}
				</span>
				<span className="text-xs text-muted-foreground">
					{record.kind === 'person' ? record.fields.region || '—' : record.fields.website || '—'}
				</span>
				<span>
					{record.kind === 'person' ? (
						emailText ? (
							<>
								<span>{email}</span>
								{extra > 0 && <span className="text-xs text-muted-foreground"> +{extra}</span>}
							</>
						) : (
							<span className="text-xs text-muted-foreground">—</span>
						)
					) : (
						<span className="text-xs text-muted-foreground">{indexed}</span>
					)}
				</span>
				<span className="flex flex-wrap gap-1">
					{record.fields.tags.map((tag) => (
						<span key={tag} className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-xs">
							{tag}
						</span>
					))}
				</span>
			</div>
			<span className="flex min-w-0 flex-1 flex-col gap-1 lg:hidden text-xs text-muted-foreground">
				<span>{secondary[0] || ct('noDetails')}</span>
				<span>
					{record.kind === 'person'
						? [record.fields.region, emailText].filter(Boolean).join(' · ') || '—'
						: [record.fields.website, indexed].filter(Boolean).join(' · ')}
				</span>
			</span>
			{email && (
				<Button
					variant="ghost"
					type="button"
					className=""
					aria-label={ct('copyEmail')}
					onClick={(e) => copyText(email, e.currentTarget.ownerDocument.defaultView!)}
				>
					{ct('copyEmail')}
				</Button>
			)}
			<HitLine view={view} record={record} />
			{!!view.controller?.index.issues(record).length && (
				<span className="text-destructive inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-destructive">
					{ct('problem')}
				</span>
			)}
		</div>
	);
}
export function ContactsSurface({ view }: { view: ContactsPanelHost }) {
	useT();
	const controller = view.controller;
	if (!view.enabled || !controller)
		return (
			<div className="flex min-h-40 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
				<Icon name="contact-round" className="size-8" />
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
		<div className="space-y-4 p-4">
			<header className="flex flex-wrap items-center gap-2">
				{selectedPath ? (
					<Action icon="arrow-left" label={ct('back')} action={() => view.back()} />
				) : (
					<div
						className="flex items-center gap-1 rounded-md border border-border p-0.5"
						role="group"
						aria-label={ct('title')}
					>
						{(['person', 'company'] as const).map((kind) => (
							<Button
								variant="ghost"
								key={kind}
								aria-pressed={query.kind === kind}
								className={query.kind === kind ? 'bg-accent' : ''}
								onClick={() => view.changeKind(kind)}
							>
								{ct(kind)}
							</Button>
						))}
					</div>
				)}
				{!selectedPath && (
					<div
						className="flex items-center gap-1 rounded-md border border-border p-0.5"
						role="group"
						aria-label={ct('layout')}
					>
						{(['list', 'card'] as const).map((mode) => (
							<Button
								variant="ghost"
								key={mode}
								type="button"
								aria-pressed={view.state.layout[query.kind] === mode}
								className={view.state.layout[query.kind] === mode ? 'bg-accent' : ''}
								onClick={() => view.layout(mode)}
							>
								{ct(mode)}
							</Button>
						))}
					</div>
				)}
				{!selectedPath && (
					<SearchField
						label={ct(query.kind === 'person' ? 'searchPeople' : 'searchCompanies')}
						value={query.search}
						onSearch={(value) => view.search(value)}
					/>
				)}
				{!selectedPath && (
					<Button
						variant="ghost"
						type="button"
						className="text-xs"
						aria-pressed={query.scope === 'fields'}
						onClick={() => view.setScope(query.scope === 'fields' ? 'record' : 'fields')}
					>
						{ct(query.scope === 'fields' ? 'scopeFields' : 'scopeRecord')}
					</Button>
				)}
				{!selectedPath && (
					<div className="flex items-center gap-1">
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
				<div
					role="alert"
					className="text-destructive flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
				>
					<Icon name="alert-triangle" className="size-4 shrink-0" />
					<span>{ct(controller.error)} </span>
					<Button variant="ghost" className="" onClick={() => void controller.reload()}>
						{ct('retry')}
					</Button>
				</div>
			)}
			{controller.loading && (
				<p role="status" className="text-xs text-muted-foreground py-4 text-sm">
					{ct('loading')}
				</p>
			)}
			{selectedPath ? (
				record ? (
					<Detail key={record.id} view={view} record={record} />
				) : (
					!controller.loading && <p className="py-4 text-sm">{ct('missing')}</p>
				)
			) : (
				<>
					{hasFilter && (
						<Button variant="ghost" className="" onClick={() => view.clearFilters()}>
							<Icon name="x" />
							{ct('clear')}
						</Button>
					)}
					{view.state.layout[query.kind] === 'list' ? (
						<div className="space-y-2" role="list">
							{records.slice(page * 60, page * 60 + 60).map((r) => (
								<RecordRow key={r.path} view={view} record={r} />
							))}
						</div>
					) : (
						<ArchiveCardGrid columns={view.columns}>
							{records.slice(page * 60, page * 60 + 60).map((r) => (
								<Button
									variant="ghost"
									className="h-auto min-w-0 flex-col items-stretch justify-start gap-3 whitespace-normal [overflow-wrap:anywhere] text-left rounded-lg border border-border bg-card p-4"
									key={r.path}
									data-path={r.path}
									onClick={() =>
										view.select(
											r.path,
											view.controller?.index.hit(r, query.search, query.scope)?.source,
										)
									}
								>
									<span className="flex items-center gap-3">
										<Monogram name={r.fields.name} />
										<span className="flex min-w-0 flex-col gap-1">
											<strong>{r.fields.name}</strong>
											{r.kind === 'person' ? (
												<span className="text-xs font-normal text-muted-foreground">
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
												<span className="text-xs font-normal text-muted-foreground">
													{ct('employees', {
														count: controller.index.members(r.id, 'current').length,
													})}
												</span>
											)}
										</span>
									</span>
									<span className="space-y-1">
										{r.kind === 'person' && (
											<span className="text-xs text-muted-foreground flex items-center gap-2">
												<Icon name="phone" />
												<span>{r.fields.mobiles[0] || r.fields.phones[0] || '—'}</span>
											</span>
										)}
										<span className="text-xs text-muted-foreground flex items-center gap-2">
											<Icon name="map-pin" />
											<span>{r.fields.region || '—'}</span>
										</span>
									</span>
									<span className="flex flex-wrap gap-1">
										{r.fields.tags.slice(0, 4).map((tag) => (
											<span
												key={tag}
												className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-xs"
											>
												{tag}
											</span>
										))}
									</span>
									{!!controller.index.issues(r).length && (
										<span className="text-destructive inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-destructive">
											<Icon name="alert-triangle" />
											{ct('problem')}
										</span>
									)}
									<HitLine view={view} record={r} plain />
								</Button>
							))}
						</ArchiveCardGrid>
					)}
					{!records.length && !controller.loading && (
						<div className="flex min-h-40 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
							<Icon
								name={
									query.search || hasFilter
										? 'search-x'
										: query.kind === 'company'
											? 'building-2'
											: 'contact-round'
								}
								className="size-8"
							/>
							<p>{ct(query.search || hasFilter ? 'noResults' : 'empty')}</p>
							<Button variant="ghost" className="" onClick={() => view.add(query.kind)}>
								{ct('add')}
							</Button>
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
