// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/settings/BrowserPane.tsx, BrowserSearchEngineSetting.tsx, BrowserProfileRow.tsx, BrowserLinkRoutingSetting.tsx
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useStore } from 'zustand';
import { toast } from 'sonner';
import type { BrowserEngine } from '../../services/host';
import type { BrowserSettings as Settings } from '../../core/model';
import type { BrowserProfile } from '../../core/profiles';
import { validSearchTemplate, normalizeBrowserNavigationUrl } from '../../core/url';
import { useT } from '../../../../ui/react/hooks';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../../../ui/components/select';
import { SettingsSection } from '../../../../ui/components/nand/SettingsSection';
import { SettingsRow, SettingsSwitchRow } from '../../../../ui/components/nand/SettingsFormControls';
import { ConfirmDialog } from '../../../../ui/components/nand/ConfirmDialog';
import { CookieImport } from '../cookies/CookieImport';
import { NewProfileDialog } from '../NewProfileDialog';
export function browserSettingsPage(host: BrowserEngine) {
	return function Page() {
		return <BrowserSettings host={host} />;
	};
}
function ProfileRow({ host, profile }: { host: BrowserEngine; profile: BrowserProfile }) {
	const t = useT(),
		[name, setName] = useState(profile.label),
		[count, setCount] = useState<number>(),
		[editing, setEditing] = useState(false);
	const pages = host.affectedPages(profile.id);
	useEffect(() => {
		let live = true;
		void host
			.cookieCount(profile.id)
			.then((n) => {
				if (live) setCount(n);
			})
			.catch(() => undefined);
		return () => {
			live = false;
		};
	}, [host, profile]);
	const run = (promise: Promise<unknown>) => {
		void promise.catch((error) => toast.error(String(error)));
	};
	return (
		<div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background/30 p-3">
			<input
				type="radio"
				name="browser-default-profile"
				aria-label={`${t('browser.defaultProfile')}: ${profile.label || t('browser.profile.default')}`}
				checked={host.settings.get().defaultProfileId === profile.id}
				onChange={() =>
					run(
						host.settings.update((s) => {
							s.defaultProfileId = profile.id;
						}),
					)
				}
			/>
			<div className="min-w-0 flex-1">
				{editing ? (
					<div className="flex gap-2">
						<Input
							maxLength={40}
							value={name}
							aria-label={t('browser.profile.label')}
							onChange={(e) => setName(e.target.value)}
						/>
						<Button
							size="sm"
							onClick={() => {
								void host
									.renameProfile(profile.id, name)
									.then(() => setEditing(false))
									.catch((error) => toast.error(String(error)));
							}}
						>
							{t('browser.save')}
						</Button>
					</div>
				) : (
					<div className="text-sm font-medium">{profile.label || t('browser.profile.default')}</div>
				)}
				<p className="text-xs text-muted-foreground">
					{count === undefined ? t('browser.loading') : t('browser.cookie.count', { count })}
					{profile.importSource ? ` · ${profile.importSource}` : ''}
				</p>
			</div>
			<CookieImport host={host} profileId={profile.id} />
			<ConfirmDialog
				title={t('browser.cookie.clear')}
				description={profile.label || t('browser.profile.default')}
				destructive
				onConfirm={async () => {
					await host.clearCookies(profile.id);
					setCount(0);
				}}
			>
				<Button size="sm" variant="outline">
					{t('browser.cookie.clear')}
				</Button>
			</ConfirmDialog>
			{profile.id !== 'default' && (
				<>
					<Button variant="ghost" size="sm" onClick={() => setEditing(!editing)}>
						{t('browser.profile.rename')}
					</Button>
					<ConfirmDialog
						title={t('browser.profile.confirmDelete', { name: profile.label })}
						description={t('browser.profile.deleteText', { count: pages.length })}
						destructive
						onConfirm={() =>
							host.deleteProfile(
								profile.id,
								pages.map((p) => p.id),
							)
						}
					>
						<Button variant="ghost" size="sm">
							{t('browser.profile.delete')}
						</Button>
					</ConfirmDialog>
				</>
			)}
		</div>
	);
}
export function BrowserSettings({ host }: { host: BrowserEngine }) {
	const t = useT(),
		settings = useSyncExternalStore(
			(listener) => host.settings.subscribe(listener),
			() => host.settings.get(),
		),
		profiles = useStore(host.profiles);
	const [home, setHome] = useState(settings.homePage),
		[template, setTemplate] = useState(settings.customSearchTemplate),
		[adding, setAdding] = useState(false);
	const save = (change: (s: Settings) => void) => {
		void host.settings.update(change).catch((error) => toast.error(String(error)));
	};
	const select = (
		label: string,
		value: string,
		options: Array<[string, string]>,
		change: (value: string) => void,
	) => (
		<Select value={value} onValueChange={change}>
			<SelectTrigger className="h-7 w-44 text-xs" aria-label={label}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{options.map(([value, label]) => (
					<SelectItem key={value} value={value}>
						{label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
	return (
		<div className="space-y-6">
			<SettingsSection title={t('browser.settings')}>
				<SettingsRow
					label={t('browser.homePage')}
					control={
						<div className="flex gap-2">
							<Input
								value={home}
								aria-label={t('browser.homePage')}
								className="h-7 w-56 text-xs"
								onChange={(e) => setHome(e.target.value)}
								aria-invalid={!!home && normalizeBrowserNavigationUrl(home) === null}
							/>
							<Button
								size="sm"
								disabled={!!home && normalizeBrowserNavigationUrl(home) === null}
								onClick={() =>
									save((s) => {
										s.homePage = home;
									})
								}
							>
								{t('browser.save')}
							</Button>
						</div>
					}
				/>
				<SettingsRow
					label={t('browser.searchEngine')}
					description={t('browser.searchHint')}
					control={select(
						t('browser.searchEngine'),
						settings.searchEngine,
						[
							['google', 'Google'],
							['bing', 'Bing'],
							['baidu', '百度'],
							['duckduckgo', 'DuckDuckGo'],
							['custom', t('browser.custom')],
						],
						(v) =>
							save((s) => {
								s.searchEngine = v as Settings['searchEngine'];
							}),
					)}
				/>
				{settings.searchEngine === 'custom' && (
					<SettingsRow
						label={t('browser.customSearch')}
						description={!validSearchTemplate(template) ? t('browser.browser_invalid_search') : undefined}
						control={
							<div className="flex gap-2">
								<Input
									value={template}
									aria-label={t('browser.customSearch')}
									aria-invalid={!validSearchTemplate(template)}
									className="h-7 w-64 text-xs"
									onChange={(e) => setTemplate(e.target.value)}
								/>
								<Button
									size="sm"
									disabled={!validSearchTemplate(template)}
									onClick={() =>
										save((s) => {
											s.customSearchTemplate = template;
										})
									}
								>
									{t('browser.save')}
								</Button>
							</div>
						}
					/>
				)}
				<SettingsRow
					label={t('browser.defaultZoom')}
					control={select(
						t('browser.defaultZoom'),
						String(settings.defaultZoom),
						[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3].map((z) => [String(z), `${z * 100}%`]),
						(v) =>
							save((s) => {
								s.defaultZoom = Number(v);
							}),
					)}
				/>
				<SettingsRow
					label={t('browser.defaultProfile')}
					control={select(
						t('browser.defaultProfile'),
						settings.defaultProfileId,
						profiles.profiles.map((p) => [p.id, p.label || t('browser.profile.default')]),
						(v) =>
							save((s) => {
								s.defaultProfileId = v;
							}),
					)}
				/>
				<SettingsRow
					label={t('browser.identity')}
					description={t('browser.identity.restart')}
					control={select(
						t('browser.identity'),
						settings.identity,
						[
							['cleaned', t('browser.identity.cleaned')],
							['native', t('browser.identity.native')],
						],
						(v) =>
							save((s) => {
								s.identity = v === 'native' ? 'native' : 'cleaned';
							}),
					)}
				/>
				<SettingsRow
					label={t('browser.link.target')}
					control={select(
						t('browser.link.target'),
						settings.linkTarget,
						[
							['nand', t('browser.link.nand')],
							['system', t('browser.external')],
						],
						(v) =>
							save((s) => {
								s.linkTarget = v === 'system' ? 'system' : 'nand';
							}),
					)}
				/>
				{(['reverseLinkModifier', 'terminalLinkMenu', 'interceptNoteLinks'] as const).map((key, i) => (
					<SettingsSwitchRow
						key={key}
						label={t(['browser.link.reverse', 'browser.link.menu', 'browser.link.notes'][i]!)}
						checked={settings[key]}
						onChange={() =>
							save((s) => {
								s[key] = !s[key];
							})
						}
					/>
				))}
			</SettingsSection>
			<SettingsSection title={t('browser.profiles')} description={t('browser.profile.description')}>
				<Button size="sm" onClick={() => setAdding(true)}>
					{t('browser.profile.add')}
				</Button>
				{profiles.profiles.map((profile) => (
					<ProfileRow key={profile.id} host={host} profile={profile} />
				))}
			</SettingsSection>
			<SettingsSection title={t('browser.permissions')}>
				{Object.entries(host.historyStore.permissions)
					.filter(([, allowed]) => allowed)
					.map(([key]) => {
						const [profileId, origin, permission] = key.split('|');
						return (
							<SettingsRow
								key={key}
								label={`${origin} · ${profiles.profiles.find((p) => p.id === profileId)?.label || t('browser.profile.default')}`}
								description={t(`browser.permission.${permission}`)}
								control={
									<Button
										size="sm"
										variant="outline"
										onClick={() => {
											void host
												.grant(profileId!, origin!, permission!, false)
												.catch((error) => toast.error(String(error)));
										}}
									>
										{t('browser.site.deny')}
									</Button>
								}
							/>
						);
					})}
			</SettingsSection>
			<SettingsRow
				label={t('browser.history.clear')}
				control={
					<Button variant="outline" size="sm" onClick={() => host.historyStore.clearHistory()}>
						{t('browser.clear')}
					</Button>
				}
			/>
			<NewProfileDialog host={host} open={adding} onOpenChange={setAdding} />
		</div>
	);
}
