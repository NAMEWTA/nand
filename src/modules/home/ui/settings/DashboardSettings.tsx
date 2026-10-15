import { ReadingServiceSettings, MediaServiceSettings } from './ServiceSettings';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { observeBoardAction } from '../board/actions';
// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/settings.ts
import { lazy, Suspense, useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/components/tabs';
import { Input } from '../../../../ui/components/input';
import { SettingsSection } from '../../../../ui/components/nand/SettingsSection';
import { SettingsRow } from '../../../../ui/components/nand/SettingsRow';
import { SettingsSwitchRow } from '../../../../ui/components/nand/SettingsSwitchRow';
import { Button } from '../../../../ui/components/button';
import { useT } from '../../../../ui/react/hooks';
import type { HomeHost } from '../../services/home-host';
import { dashboardSettingsStore } from '../../services/settings-store';
import { WIDGETS } from '../widgets/WidgetDeck';
import { Choice, IconButton } from '../board/controls';
import { DraftList } from '../quickbar/DraftList';
import { GeneralExtras, WidgetExtras } from './ExtraSettings';
import { AppearanceStudio } from '../appearance/AppearanceStudio';
import { DashboardAppearanceProvider } from '../theme/ThemeBridge';
import { customThemeSettingsSlice } from '../../core/board/custom-theme';
import type { AnniversaryConfig } from '../../core/board/types';
const AnniversaryEditor = lazy(() =>
	import('../widgets/AnniversaryEditor').then((m) => ({ default: m.AnniversaryEditor })),
);
export function DashboardSettings({ host }: { host: HomeHost }) {
	const [store] = useState(() => dashboardSettingsStore(host)),
		[studio, setStudio] = useState(false),
		[newWorkspace, setNewWorkspace] = useState<string | null>(null),
		[removeWorkspace, setRemoveWorkspace] = useState<string | null>(null),
		[removeAnniversary, setRemoveAnniversary] = useState<AnniversaryConfig | null>(null),
		[anniversary, setAnniversary] = useState<AnniversaryConfig | null>(null);
	useEffect(() => store.connect(), [store]);
	const settings = useStore(store.state, (s) => s.settings),
		t = useT();
	return (
		<DashboardAppearanceProvider host={host} settings={settings}>
			<Tabs defaultValue="general">
				<TabsList>
					{['general', 'widgets', 'about'].map((value) => (
						<TabsTrigger key={value} value={value}>
							{t(`home.dashboard.tab.${value}`)}
						</TabsTrigger>
					))}
				</TabsList>
				<TabsContent value="general" className="space-y-8">
					<SettingsSection title={t('home.dashboard.tab.general')}>
						<SettingsRow
							label={t('home.dashboard.theme')}
							control={
								<Choice
									value={
										settings.activeCustomThemeId
											? `custom:${settings.activeCustomThemeId}`
											: settings.stylePreset
									}
									label={t('home.dashboard.theme')}
									onChange={(value) => {
										void store.update((s) => {
											const theme = s.customThemes.find(
												(theme) => `custom:${theme.id}` === value,
											);
											if (theme) Object.assign(s, customThemeSettingsSlice(theme));
											else {
												s.stylePreset = value;
												s.customColors = {};
												delete s.activeCustomThemeId;
											}
										});
									}}
									options={[
										'earth',
										'nordic',
										'aurora',
										'blossom',
										'aqua',
										'island',
										'tundra',
										'matcha',
										'mono',
										'neon',
										'volt',
										'magma',
										'onyx',
									]
										.map((value) => ({ value, label: t(`home.dashboard.theme.${value}`) }))
										.concat(
											settings.customThemes.map((theme) => ({
												value: `custom:${theme.id}`,
												label: `${t('home.p1.myThemes')} · ${theme.name}`,
											})),
										)}
								/>
							}
						/>
						<Button variant="outline" onClick={() => setStudio(true)}>
							{t('themeStudio.modalTitle')}
						</Button>
						<SettingsSwitchRow
							label={t('home.dashboard.themeFont')}
							checked={settings.useThemeFont}
							onChange={() => {
								void store.update((s) => {
									s.useThemeFont = !s.useThemeFont;
								});
							}}
						/>
						<SettingsRow
							label={t('home.dashboard.layout')}
							control={
								<Choice
									label={t('home.dashboard.layout')}
									value={settings.layoutMode ?? 'side'}
									onChange={(value) => {
										void store.update((s) => {
											s.layoutMode = value as 'side' | 'stacked' | 'immersive';
										});
										void host
											.activeDashboard()
											?.sync.setBoardLayout(value as 'side' | 'stacked' | 'immersive');
									}}
									options={['side', 'stacked', 'immersive'].map((value) => ({
										value,
										label: t(
											value === 'side'
												? 'renderer.layoutSide'
												: value === 'immersive'
													? 'renderer.layoutImmersive'
													: 'renderer.layoutStacked',
										),
									}))}
								/>
							}
						/>
					</SettingsSection>
					<SettingsSection title={t('workbench.boards')}>
						<DraftList
							items={settings.workspaces.files.map((file) => ({ id: file }))}
							onChange={(_items, from, to) => {
								void host.reorderWorkspaces(from, to);
							}}
						>
							{({ id: file }, index) => (
								<div key={file} className="flex flex-wrap items-center gap-2">
									<Input
										className="w-36"
										aria-label={t('home.dashboard.name')}
										defaultValue={settings.workspaces.names[index]}
										onBlur={(e) => {
											void host.renameWorkspace(file, e.target.value);
										}}
									/>
									<Input
										className="min-w-40 flex-1"
										aria-label={t('home.dashboard.path')}
										defaultValue={file}
										onKeyDown={(event) => {
											if (event.key === 'Enter') event.currentTarget.blur();
										}}
										onBlur={(e) => {
											if (e.target.value !== file)
												void host.retargetWorkspace(file, e.target.value);
										}}
									/>
									<IconButton
										label={t('common.delete')}
										disabled={settings.workspaces.files.length === 1}
										onClick={() => {
											setRemoveWorkspace(file);
										}}
									>
										<Trash2 />
									</IconButton>
								</div>
							)}
						</DraftList>
						<Button
							variant="outline"
							onClick={() =>
								setNewWorkspace(t('workspace.defaultName', { n: settings.workspaces.files.length + 1 }))
							}
						>
							{t('workspace.add')}
						</Button>
					</SettingsSection>
					<SettingsSection title={t('home.dashboard.paths')}>
						{(['memoSavePath', 'memoTemplatePath', 'taskArchivePath', 'libraryNewNotePath'] as const).map(
							(key) => (
								<SettingsRow
									key={key}
									label={t(`home.dashboard.${key}`)}
									control={
										<Input
											defaultValue={settings[key]}
											onBlur={(e) => {
												const value = e.target.value;
												void store.update((s) => {
													s[key] = value;
												});
											}}
										/>
									}
								/>
							),
						)}
						<SettingsSwitchRow
							label={t('home.dashboard.directOpen')}
							checked={settings.disableNotePopover}
							onChange={() => {
								void store.update((s) => {
									s.disableNotePopover = !s.disableNotePopover;
								});
							}}
						/>
					</SettingsSection>
					<ReadingServiceSettings settings={settings} update={store.update} />
					<GeneralExtras host={host} settings={settings} update={store.update} />
				</TabsContent>
				<TabsContent value="widgets">
					<SettingsSection title={t('home.dashboard.tab.widgets')}>
						<SettingsSwitchRow
							label={t('quickNote.title')}
							checked={settings.quickNotesEnabled}
							onChange={() => {
								void store.update((s) => {
									s.quickNotesEnabled = !s.quickNotesEnabled;
								});
							}}
						/>
						{Object.entries(WIDGETS).map(([id, widget]) => (
							<SettingsSwitchRow
								key={id}
								label={t(`home.dashboard.widget.${id}`)}
								checked={!!settings[widget.enabled]}
								onChange={() => {
									void store.update((s) => {
										Object.assign(s, { [widget.enabled]: !s[widget.enabled] });
									});
								}}
							/>
						))}
						<SettingsSwitchRow
							label={t('settings.readingSound')}
							checked={settings.readingSoundEnabled}
							onChange={() => {
								void store.update((s) => {
									s.readingSoundEnabled = !s.readingSoundEnabled;
								});
							}}
						/>
						<SettingsRow
							label={t('home.dashboard.widget.reading')}
							control={
								<Choice
									label={t('home.dashboard.heightRatio')}
									value={settings.readingHeightRatio}
									options={['full', 'twoThirds', 'half', 'third'].map((value) => ({
										value,
										label: t(`home.dashboard.ratio.${value}`),
									}))}
									onChange={(value) => {
										void store.update((s) => {
											s.readingHeightRatio = value as typeof s.readingHeightRatio;
										});
									}}
								/>
							}
						/>
						{settings.anniversaryEnabled && (
							<>
								{settings.anniversaries.map((config) => (
									<SettingsRow
										key={config.id}
										label={config.label || t('anniversary.unnamed')}
										control={
											<div className="flex gap-2">
												<Button variant="outline" onClick={() => setAnniversary({ ...config })}>
													{t('common.edit')}
												</Button>
												<Button variant="ghost" onClick={() => setRemoveAnniversary(config)}>
													{t('common.delete')}
												</Button>
											</div>
										}
									/>
								))}
								<Button
									variant="outline"
									onClick={() =>
										setAnniversary({
											id: crypto.randomUUID(),
											label: '',
											startDate: new Date().toLocaleDateString('sv-SE'),
											calendar: 'solar',
											precision: 'ymd',
											annualReminder: true,
										})
									}
								>
									{t('anniversary.add')}
								</Button>
							</>
						)}
						{anniversary && (
							<Suspense fallback={null}>
								<AnniversaryEditor
									initial={anniversary}
									onDelete={
										settings.anniversaries.some((c) => c.id === anniversary.id)
											? () => setRemoveAnniversary(anniversary)
											: undefined
									}
									onClose={() => setAnniversary(null)}
									onSave={(value) => {
										void store
											.update((s) => {
												const i = s.anniversaries.findIndex((c) => c.id === value.id);
												if (i < 0) s.anniversaries.push(value);
												else s.anniversaries[i] = value;
											})
											.then(() => setAnniversary(null));
									}}
								/>
							</Suspense>
						)}
						<SettingsRow
							label={t('settings.expenseCurrency')}
							control={
								<Input
									value={settings.expenseCurrency}
									onChange={(e) => {
										const value = e.target.value;
										void store.update((s) => {
											s.expenseCurrency = value;
										});
									}}
								/>
							}
						/>
						<SettingsRow
							label={t('home.dashboard.heightRatio')}
							control={
								<Choice
									label={t('home.dashboard.heightRatio')}
									value={settings.habitHeightRatio}
									onChange={(value) => {
										void store.update((s) => {
											s.habitHeightRatio = value as typeof s.habitHeightRatio;
										});
									}}
									options={['full', 'twoThirds', 'half', 'third'].map((value) => ({
										value,
										label: t(`home.dashboard.ratio.${value}`),
									}))}
								/>
							}
						/>
						<SettingsRow
							label={t('home.dashboard.recentCount')}
							control={
								<Input
									type="number"
									min={0}
									max={50}
									value={settings.recentDocCount}
									onChange={(e) => {
										const count = +e.target.value;
										void store.update((s) => {
											s.recentDocCount = Math.max(0, Math.min(50, count));
										});
									}}
								/>
							}
						/>
					</SettingsSection>
					<MediaServiceSettings app={host.app} settings={settings} update={store.update} />
					<WidgetExtras host={host} settings={settings} update={store.update} />
				</TabsContent>
				<TabsContent value="about">
					<SettingsSection title="NAND">
						<p className="text-sm">{t('home.dashboard.credit')}</p>
						<p>{t('home.p1.version', { version: host.manifest.version })}</p>
						<Button variant="link" asChild>
							<a href="https://github.com/PandoraReads/apex-dashboard">
								PandoraReads/apex-dashboard · ac4d2c7 · MIT
							</a>
						</Button>
					</SettingsSection>
				</TabsContent>
			</Tabs>
			{removeAnniversary && (
				<DashboardDialog title={t('common.delete')} onClose={() => setRemoveAnniversary(null)}>
					<p>{removeAnniversary.label}</p>
					<Button
						variant="destructive"
						onClick={() => {
							void observeBoardAction(
								store
									.update((s) => {
										s.anniversaries = s.anniversaries.filter((c) => c.id !== removeAnniversary.id);
									})
									.then(() => {
										setRemoveAnniversary(null);
										setAnniversary(null);
									}),
							);
						}}
					>
						{t('common.delete')}
					</Button>
				</DashboardDialog>
			)}
			{newWorkspace !== null && (
				<DashboardDialog
					title={t('workspace.newTitle')}
					onClose={() => setNewWorkspace(null)}
					onSave={() => {
						void observeBoardAction(
							host
								.createWorkspace(
									newWorkspace ||
										t('workspace.defaultName', { n: settings.workspaces.files.length + 1 }),
								)
								.then(() => setNewWorkspace(null)),
						);
					}}
				>
					<Input
						aria-label={t('home.dashboard.name')}
						value={newWorkspace}
						onChange={(event) => setNewWorkspace(event.target.value)}
					/>
				</DashboardDialog>
			)}
			{removeWorkspace && (
				<DashboardDialog title={t('workspace.removeTitle')} onClose={() => setRemoveWorkspace(null)}>
					<p>
						{t('workspace.removeConfirm', {
							name:
								settings.workspaces.names[settings.workspaces.files.indexOf(removeWorkspace)] ||
								removeWorkspace,
							file: `${removeWorkspace}.md`,
						})}
					</p>
					<Button
						variant="destructive"
						onClick={() => {
							void observeBoardAction(
								host.removeWorkspace(removeWorkspace).then(() => setRemoveWorkspace(null)),
							);
						}}
					>
						{t('common.delete')}
					</Button>
				</DashboardDialog>
			)}
			{studio && <AppearanceStudio host={host} onClose={() => setStudio(false)} />}
		</DashboardAppearanceProvider>
	);
}
