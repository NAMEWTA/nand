// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/rss-config-modal.ts
import { useRef, useState } from 'react';
import { X, Folder } from 'lucide-react';
import { toast } from 'sonner';
import type { RssConfig, RssFeedSource } from '../../core/board/types';
import type { BoardStore } from '../../services/board-store';
import type { RssStore } from '../../platform/rss/rss-store';
import { exportRssOpml } from '../../platform/rss/rss-note';
import { normalizeWebUrl, isValidWebUrl } from '../../core/rss/url';
import { buildOpml, parseOpml } from '../../core/rss/rss-opml';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import { useT } from '../../../../ui/react/hooks';
import { IconButton, Choice } from '../board/controls';
import { P2Dialog } from '../dialogs/P2Dialog';
import { DashboardFolderPicker } from '../dialogs/DashboardFolderPicker';
import { p2Classes as c } from '../theme/p2-classes';
export function RssConfigDialog({
	store,
	config,
	rss,
	onClose,
	onSave,
}: {
	store: BoardStore;
	config: RssConfig;
	rss: RssStore;
	onClose: () => void;
	onSave: (value: RssConfig) => Promise<void>;
}) {
	const t = useT(),
		[draft, setDraft] = useState(() => structuredClone(config)),
		[newGroup, setNewGroup] = useState(''),
		[error, setError] = useState(''),
		[picking, setPicking] = useState(false),
		[feedGroup, setFeedGroup] = useState<number | null>(null),
		[groupDraft, setGroupDraft] = useState(''),
		file = useRef<HTMLInputElement>(null);
	const groups = [...new Set([...(draft.groups ?? []), ...draft.feeds.map((f) => f.group ?? '')].filter(Boolean))];
	const urls = draft.feeds.map((f) => normalizeWebUrl(f.url)),
		invalid = urls.some((u) => !isValidWebUrl(u)),
		duplicate = new Set(urls).size !== urls.length;
	const update = (index: number, patch: Partial<RssFeedSource>) =>
		setDraft({ ...draft, feeds: draft.feeds.map((f, i) => (i === index ? { ...f, ...patch } : f)) });
	const addGroup = () => {
		const name = newGroup.trim();
		if (name && !groups.includes(name)) {
			setDraft({ ...draft, groups: [...groups, name] });
			setNewGroup('');
		}
	};
	return (
		<P2Dialog
			title={t('rss.configTitle')}
			onClose={onClose}
			disabled={invalid || duplicate}
			onSave={() => onSave({ ...draft, feeds: draft.feeds.map((f) => ({ ...f, url: normalizeWebUrl(f.url) })) })}
		>
			<div className={c('dashboard-library-config-section')}>
				<div className={c('dashboard-library-config-section-title')}>{t('rss.configFeeds')}</div>
				<div className={c('dashboard-rss-cfg-list')}>
					{draft.feeds.map((feed, i) => (
						<div key={i} className={c('dashboard-rss-cfg-row')}>
							<Input
								className={c('dashboard-task-input dashboard-rss-cfg-name')}
								aria-label={t('rss.configFeedName')}
								placeholder={t('rss.configFeedName')}
								value={feed.name ?? ''}
								onChange={(e) => update(i, { name: e.target.value })}
							/>
							<Choice
								compact
								className={c(
									'dashboard-library-filter-property dashboard-rss-cfg-group-select w-[84px]',
								)}
								label={t('rss.configGroups')}
								value={feed.group || '_none'}
								options={[
									{ value: '_none', label: t('rss.groupByNone') },
									...groups.map((g) => ({ value: g, label: g })),
									{ value: '_add', label: t('rss.configNewGroup') },
								]}
								onChange={(group) => {
									if (group === '_add') {
										setGroupDraft('');
										setFeedGroup(i);
									} else update(i, { group: group === '_none' ? undefined : group });
								}}
							/>
							<Input
								className={c('dashboard-task-input dashboard-rss-cfg-url')}
								aria-label={t('rss.configFeedUrl')}
								placeholder={t('rss.configFeedUrl')}
								value={feed.url}
								onChange={(e) => update(i, { url: e.target.value })}
							/>
							{rss.feedEntry(normalizeWebUrl(feed.url))?.error && (
								<span role="status" className={c('dashboard-rss-cfg-status is-error')}>
									{rss.feedEntry(normalizeWebUrl(feed.url))?.error}
								</span>
							)}
							<IconButton
								label={t('common.delete')}
								className={c('dashboard-rss-cfg-remove')}
								onClick={() => setDraft({ ...draft, feeds: draft.feeds.filter((_, n) => n !== i) })}
							>
								<X />
							</IconButton>
						</div>
					))}
				</div>
				<div className={c('dashboard-rss-cfg-opml-row')}>
					<Button
						size="xs"
						className={c('dashboard-modal-btn dashboard-modal-btn--confirm dashboard-rss-cfg-add')}
						onClick={() => setDraft({ ...draft, feeds: [...draft.feeds, { url: '' }] })}
					>
						{t('rss.configAddFeed')}
					</Button>
					<Button
						size="xs"
						variant="outline"
						className={c('dashboard-modal-btn dashboard-rss-cfg-opml-btn')}
						onClick={() => file.current?.click()}
					>
						{t('rss.configImportOpml')}
					</Button>
					<input
						hidden
						ref={file}
						type="file"
						accept=".opml,.xml"
						onChange={(e) => {
							const f = e.target.files?.[0];
							if (f)
								void f
									.text()
									.then((text) => {
										const imported = parseOpml(text);
										setDraft((current) => {
											const seen = new Set(current.feeds.map((f) => normalizeWebUrl(f.url)));
											return {
												...current,
												feeds: [
													...current.feeds,
													...imported.feeds.filter((f) => {
														const key = normalizeWebUrl(f.url);
														if (seen.has(key)) return false;
														seen.add(key);
														return true;
													}),
												],
												groups: [...new Set([...(current.groups ?? []), ...imported.groups])],
											};
										});
									})
									.catch((e) => setError(String(e)));
							e.currentTarget.value = '';
						}}
					/>
					<Button
						size="xs"
						variant="outline"
						className={c('dashboard-modal-btn dashboard-rss-cfg-opml-btn')}
						disabled={invalid || duplicate}
						onClick={() => {
							void exportRssOpml(store.host.app, buildOpml(draft))
								.then((path) => toast(path))
								.catch((e) => setError(String(e)));
						}}
					>
						{t('rss.configExportOpml')}
					</Button>
				</div>
				<div
					className={c(`dashboard-dataview-validation${invalid || duplicate ? ' is-error' : ''}`)}
					role={invalid || duplicate ? 'alert' : undefined}
				>
					{(invalid || duplicate) && t(invalid ? 'rss.configInvalidUrl' : 'rss.configDuplicateUrl')}
				</div>
			</div>
			<div className={c('dashboard-library-config-section')}>
				<div className={c('dashboard-library-config-section-title')}>{t('rss.configGroups')}</div>
				<div className={c('dashboard-rss-cfg-groupby-row')}>
					<span className={c('dashboard-rss-cfg-groupby-label')}>{t('rss.configGroupBy')}</span>
					<Choice
						compact
						className={c('dashboard-library-filter-property dashboard-rss-cfg-groupby-select w-[135px]')}
						label={t('rss.configGroupBy')}
						value={draft.groupBy ?? 'group'}
						options={(['group', 'feed', 'none'] as const).map((value) => ({
							value,
							label: t(
								value === 'group'
									? 'rss.groupByGroup'
									: value === 'feed'
										? 'rss.groupByFeed'
										: 'rss.groupByNone',
							),
						}))}
						onChange={(value) => setDraft({ ...draft, groupBy: value as RssConfig['groupBy'] })}
					/>
				</div>
				<div className={c('dashboard-rss-cfg-groups')}>
					{groups.map((group) => (
						<div key={group} className={c('dashboard-rss-cfg-group-row')}>
							<span className={c('dashboard-rss-cfg-group-name')}>{group}</span>
							<IconButton
								label={t('rss.configRemoveGroup')}
								className={c('dashboard-rss-cfg-remove dashboard-rss-cfg-group-remove')}
								onClick={() =>
									setDraft({
										...draft,
										groups: groups.filter((g) => g !== group),
										feeds: draft.feeds.map((f) =>
											f.group === group ? { ...f, group: undefined } : f,
										),
									})
								}
							>
								<X />
							</IconButton>
						</div>
					))}
				</div>
				<div className={c('dashboard-rss-cfg-group-add-row')}>
					<Input
						className={c('dashboard-task-input dashboard-rss-cfg-group-add-input')}
						aria-label={t('rss.configNewGroupPh')}
						placeholder={t('rss.configNewGroupPh')}
						value={newGroup}
						onChange={(e) => setNewGroup(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
								e.preventDefault();
								addGroup();
							}
						}}
					/>
					<Button className={c('dashboard-modal-btn dashboard-modal-btn--confirm')} onClick={addGroup}>
						{t('rss.configAddGroup')}
					</Button>
				</div>
				<div className={c('dashboard-library-config-hint')}>{t('rss.configGroupsHint')}</div>
			</div>
			<div className={c('dashboard-library-config-section')}>
				<div className={c('dashboard-library-config-section-title')}>{t('rss.configFolder')}</div>
				<div className={c('dashboard-rss-cfg-folder-row')}>
					<Input
						className={c('dashboard-task-input dashboard-rss-cfg-folder')}
						aria-label={t('rss.configFolder')}
						placeholder={t('rss.configFolderPlaceholder')}
						value={draft.downloadFolder}
						onChange={(e) => setDraft({ ...draft, downloadFolder: e.target.value })}
					/>
					<IconButton label={t('rss.configFolder')} onClick={() => setPicking(true)}>
						<Folder />
					</IconButton>
				</div>
				<div className={c('dashboard-library-config-hint')}>{t('rss.configFolderHint')}</div>
			</div>
			{error && <p role="alert">{error}</p>}
			{feedGroup !== null && (
				<P2Dialog
					title={t('rss.configNewGroupTitle')}
					onClose={() => setFeedGroup(null)}
					disabled={!groupDraft.trim()}
					onSave={async () => {
						const group = groupDraft.trim();
						setDraft((current) => ({
							...current,
							groups: [...new Set([...(current.groups ?? []), group])],
							feeds: current.feeds.map((feed, i) => (i === feedGroup ? { ...feed, group } : feed)),
						}));
					}}
				>
					<Input
						autoFocus
						aria-label={t('rss.configNewGroupPh')}
						placeholder={t('rss.configNewGroupPh')}
						value={groupDraft}
						onChange={(e) => setGroupDraft(e.target.value)}
					/>
				</P2Dialog>
			)}
			{picking && (
				<DashboardFolderPicker
					app={store.host.app}
					onClose={() => setPicking(false)}
					initial={[draft.downloadFolder]}
					single
					onSave={(paths) => {
						setDraft({ ...draft, downloadFolder: paths[0] ?? '' });
						setPicking(false);
					}}
				/>
			)}
		</P2Dialog>
	);
}
