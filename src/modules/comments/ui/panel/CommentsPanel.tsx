// Adapted from jonaas-dev/obsidian-margin-comments f727e38 (MIT), Copyright (c) 2026 jonaas-dev: src/ui/comment-panel.ts, src/ui/vault-sections.ts
import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { MessageSquareText, MoreHorizontal, RefreshCw } from 'lucide-react';
import { Button } from '../../../../ui/components/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator } from '../../../../ui/components/dropdown-menu';
import { ToggleGroup, ToggleGroupItem } from '../../../../ui/components/toggle-group';
import { SegmentedControl } from '../../../../ui/components/nand/SegmentedControl';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../../../ui/components/collapsible';
import { useT } from '../../../../ui/react/hooks';
import type { CommentsEnv } from '../env';
import { Action, ThreadCard } from '../thread/ThreadCard';
import { countThreads, filterThreads, type ThreadFilter } from './filter';
import { sortThreads, type SortOrder } from './sort';

function NoteThreads({ env, path, filter, sort }: { env: CommentsEnv; path: string; filter: ThreadFilter; sort: SortOrder }) {
	useStore(env.service.state, state => state.revision);
	const [error, setError] = useState(false);
	const t = useT();
	const load = () => { void env.service.load(path).then(() => setError(false), () => setError(true)); };
	useEffect(() => { let alive = true; void env.service.load(path).catch(() => { if (alive) setError(true); }); return () => { alive = false; }; }, [env, path]);
	const threads = sortThreads(filterThreads(env.service.store.threadsFor(path), filter), sort);
	const resolved = filter === 'all' ? threads.filter(thread => thread.status === 'resolved') : [];
	return <div className="space-y-2">{error && <div role="alert" className="text-xs text-destructive">{t('editor.comments.storageFailed')}<Button size="xs" variant="outline" onClick={load}>{t('editor.comments.retry')}</Button></div>}{threads.filter(thread => filter !== 'all' || thread.status !== 'resolved').map(thread => <ThreadCard key={thread.id} env={env} path={path} thread={thread} />)}{resolved.length > 0 && <Collapsible><CollapsibleTrigger asChild><Button size="sm" variant="ghost">{t('editor.comments.resolved')} ({resolved.length})</Button></CollapsibleTrigger><CollapsibleContent className="space-y-2">{resolved.map(thread => <ThreadCard key={thread.id} env={env} path={path} thread={thread} />)}</CollapsibleContent></Collapsible>}{!threads.length && !error && <div className="space-y-2 py-6 text-center text-xs text-muted-foreground"><MessageSquareText className="mx-auto size-6" /><p>{t('editor.comments.empty')}</p><p>{t('editor.comments.emptyHint')}</p></div>}</div>;
}
function VaultSection({ env, path, open, total, filter, sort }: { env: CommentsEnv; path: string; open: number; total: number; filter: ThreadFilter; sort: SortOrder }) {
	const [expanded, setExpanded] = useState(false);
	return <Collapsible open={expanded} onOpenChange={setExpanded}><CollapsibleTrigger asChild><Button variant="ghost" className="h-auto w-full justify-between whitespace-normal text-left text-xs"><span>{path}</span><span className="ml-2 text-muted-foreground">{open}/{total}</span></Button></CollapsibleTrigger><CollapsibleContent>{expanded && <NoteThreads env={env} path={path} filter={filter} sort={sort} />}</CollapsibleContent></Collapsible>;
}
export function CommentsPanel({ env }: { env: CommentsEnv }) {
	const state = useStore(env.service.state);
	const [scope, setScope] = useState('current');
	const [filter, setFilter] = useState<ThreadFilter>('all');
	const [sort, setSort] = useState<SortOrder>(env.service.settings().sort);
	const t = useT();
	const store = env.service.store;
	const counts = scope === 'current' ? countThreads(state.path ? store.threadsFor(state.path) : []) : state.notes.reduce((total, note) => ({ all: total.all + note.total, open: total.open + note.open, resolved: total.resolved + note.total - note.open }), { all: 0, open: 0, resolved: 0 });
	const notes = state.notes.filter(note => filter === 'all' || (filter === 'open' ? note.open > 0 : note.total > note.open)).sort((a, b) => a.path.localeCompare(b.path));
	const existing = notes.filter(note => env.app.vault.getFileByPath(note.path));
	const missing = notes.filter(note => !env.app.vault.getFileByPath(note.path));
	return <div className="nand-comments-panel flex h-full min-h-0 flex-col bg-background text-foreground">
		<div className="space-y-2 border-b border-border p-3"><div className="flex h-9 items-center justify-between"><h2 className="text-sm font-medium">{t('editor.comments.title')}</h2><div className="flex gap-2"><Action label={t('editor.comments.refresh')} onClick={() => { void env.service.refresh(); }}><RefreshCw /></Action><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon-xs" variant="ghost" aria-label={t('editor.comments.more')}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>{t('editor.comments.sort')}</DropdownMenuLabel><DropdownMenuRadioGroup value={sort} onValueChange={value => setSort(value as SortOrder)}>{(['position', 'created', 'activity'] as const).map(value => <DropdownMenuRadioItem key={value} value={value}>{t(`editor.comments.${value}`)}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup><DropdownMenuSeparator />{scope === 'current' && state.path && <DropdownMenuItem onSelect={event => { const target = event.currentTarget as HTMLElement; env.open({ path: state.path!, mode: 'resolve-all', pinned: true, ownerDocument: target.ownerDocument, rect: () => target.getBoundingClientRect() }); }}>{t('editor.comments.resolveAll')}</DropdownMenuItem>}<DropdownMenuItem onSelect={() => env.openSettings()}>{t('workbench.settings')}</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></div>
		<SegmentedControl value={scope} onChange={setScope} size="sm" options={[{ value: 'current', label: t('editor.comments.current') }, { value: 'vault', label: t('editor.comments.vault') }]} />
		<ToggleGroup type="single" value={filter} onValueChange={value => { if (value) setFilter(value as ThreadFilter); }} className="w-full">{(['all', 'open', 'resolved'] as const).map(value => <ToggleGroupItem key={value} value={value} className="flex-1 text-xs">{t(`editor.comments.${value}`)} {counts[value]}</ToggleGroupItem>)}</ToggleGroup>
		</div>
		<div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
		{store.legacyData && <p role="status" className="text-xs text-status-warning">{t('editor.comments.legacy')}</p>}
		{store.damagedFiles.length > 0 && <p role="alert" className="text-xs text-destructive">{t('editor.comments.damaged')}</p>}
		{state.error && <p role="alert" className="text-xs text-destructive">{t('editor.comments.storageFailed')}</p>}
		{scope === 'current' ? state.path ? <NoteThreads key={state.path} env={env} path={state.path} filter={filter} sort={sort} /> : <p className="py-8 text-center text-xs text-muted-foreground">{t('editor.comments.noFile')}</p> : <>{existing.map(note => <VaultSection key={note.path} env={env} {...note} filter={filter} sort={sort} />)}{missing.length > 0 && <h3 className="text-xs text-status-warning">{t('editor.comments.missingNotes')}</h3>}{missing.map(note => <VaultSection key={note.path} env={env} {...note} filter={filter} sort={sort} />)}{!notes.length && <p className="py-8 text-center text-xs text-muted-foreground">{t('editor.comments.emptyHint')}</p>}</>}
		</div>
	</div>;
}
