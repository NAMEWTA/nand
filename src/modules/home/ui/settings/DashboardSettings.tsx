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
import type { AnniversaryConfig } from '../../core/board/types';
const AnniversaryEditor = lazy(() =>
	import('../widgets/AnniversaryEditor').then((m) => ({ default: m.AnniversaryEditor })),
);
export function DashboardSettings({ host }: { host: HomeHost }) {
	const [store] = useState(() => dashboardSettingsStore(host)),
		[anniversary, setAnniversary] = useState<AnniversaryConfig | null>(null);
	useEffect(() => store.connect(), [store]);
	const settings = useStore(store.state, (s) => s.settings),
		t = useT();
	return (
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
								value={settings.stylePreset}
								label={t('home.dashboard.theme')}
								onChange={(value) => {
									void store.update((s) => {
										s.stylePreset = value;
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
								].map((value) => ({ value, label: t(`home.dashboard.theme.${value}`) }))}
							/>
						}
					/>
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
										s.layoutMode = value as 'side' | 'stacked';
									});
									void host.activeDashboard()?.sync.setBoardLayout(value as 'side' | 'stacked');
								}}
								options={['side', 'stacked'].map((value) => ({
									value,
									label: t(value === 'side' ? 'renderer.layoutSide' : 'renderer.layoutStacked'),
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
									onBlur={(e) => {
										if (e.target.value !== file) void host.retargetWorkspace(file, e.target.value);
									}}
								/>
								<IconButton
									label={t('common.delete')}
									disabled={settings.workspaces.files.length === 1}
									onClick={() => {
										void host.removeWorkspace(file);
									}}
								>
									<Trash2 />
								</IconButton>
							</div>
						)}
					</DraftList>
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
										<Button variant="outline" onClick={() => setAnniversary({ ...config })}>
											{t('common.edit')}
										</Button>
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
								{t('anniversary.addTitle')}
							</Button>
						</>
					)}
					{anniversary && (
						<Suspense fallback={null}>
							<AnniversaryEditor
								initial={anniversary}
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
			</TabsContent>
			<TabsContent value="about">
				<SettingsSection title="NAND">
					<p className="text-sm">{t('home.dashboard.credit')}</p>
					<Button variant="link" asChild>
						<a href="https://github.com/PandoraReads/apex-dashboard">
							PandoraReads/apex-dashboard · ac4d2c7 · MIT
						</a>
					</Button>
				</SettingsSection>
			</TabsContent>
		</Tabs>
	);
}
