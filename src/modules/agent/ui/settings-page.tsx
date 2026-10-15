import type { SettingsPageHost } from '../../../app/contracts/module';
import { toast } from 'sonner';
const report = (error: unknown) => {
	toast.error(error instanceof Error ? error.message : String(error));
};
import type { SettingsHandle } from '../../../shared/settings/store';
import type { TerminalSettings as Settings } from '../core/terminal/settings';
import type { AgentController } from '../services/controller';
import { useT } from '../../../ui/react/hooks';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/components/tabs';
import { Input } from '../../../ui/components/input';
import { Textarea } from '../../../ui/components/textarea';
import { Button } from '../../../ui/components/button';
import { SettingsSection } from '../../../ui/components/nand/SettingsSection';
import { SettingsRow, SettingsSwitchRow } from '../../../ui/components/nand/SettingsFormControls';
import { AGENT_CATALOG } from '../core/launch/catalog';
import { AgentsSettings } from './settings/AgentsSettings';
import { TerminalSettings } from './settings/TerminalSettings';
import { AccountsSection } from './settings/AccountsSection';
import { QuickCommandsSection } from './settings/QuickCommandsSection';
import { useAgentSettings } from './settings/settings-context';
function PortableSettings({ handle, desktop }: { handle: SettingsHandle<Settings>; desktop: boolean }) {
	const t = useT(),
		settings = useAgentSettings(handle);
	return (
		<SettingsSection title={t('agent.skills.heading')}>
			{desktop ? (
				<label className="space-y-2 text-sm">
					{t('agent.skills.directories')}
					<Textarea
						defaultValue={settings.skillDirectories.join('\n')}
						onBlur={(e) => {
							void handle
								.update((d) => {
									d.skillDirectories = e.target.value
										.split('\n')
										.map((p) => p.trim())
										.filter(Boolean);
								})
								.catch(report);
						}}
					/>
				</label>
			) : (
				<p className="text-sm text-muted-foreground">{t('agent.skills.mobile')}</p>
			)}
			{AGENT_CATALOG.filter((a) => settings.knownSkills[a.id]?.length).map((a) => (
				<SettingsRow
					key={a.id}
					label={t('agent.skills.remembered', { name: a.title })}
					description={settings.knownSkills[a.id]?.join(', ')}
					control={
						<Button
							variant="ghost"
							onClick={() => {
								void handle
									.update((d) => {
										delete d.knownSkills[a.id];
									})
									.catch(report);
							}}
						>
							{t('agent.skills.clear')}
						</Button>
					}
				/>
			))}
		</SettingsSection>
	);
}
function UsageSettings({ controller }: { controller: AgentController }) {
	const t = useT(),
		settings = useAgentSettings(controller.settings);
	const save = (fn: Parameters<typeof controller.settings.update>[0]) => {
		void controller.settings.update(fn).catch((e) => controller.workspace.report(e));
	};
	return (
		<SettingsSection title={t('agent.usage')}>
			<SettingsRow
				label={t('agent.manage.refreshInterval')}
				control={
					<Input
						type="number"
						min={60}
						max={3600}
						step={60}
						value={settings.usageRefreshSec}
						onChange={(e) => {
							if (e.target.validity.valid)
								save((d) => {
									d.usageRefreshSec = Number(e.target.value);
								});
						}}
					/>
				}
			/>
			{AGENT_CATALOG.map((a) => (
				<SettingsSwitchRow
					key={a.id}
					label={t('agent.stats.enable', { name: a.title })}
					checked={settings.usageAnalytics[a.id]}
					onChange={() =>
						save((d) => {
							d.usageAnalytics[a.id] = !d.usageAnalytics[a.id];
						})
					}
				/>
			))}
		</SettingsSection>
	);
}
export function agentSettingsPage(
	getController: () => AgentController | undefined,
	portable?: SettingsHandle<Settings>,
	desktop = true,
) {
	return function AgentSettingsPage({ resourceId }: SettingsPageHost) {
		const t = useT(),
			controller = getController();
		if (!controller)
			return portable ? (
				<PortableSettings handle={portable} desktop={desktop} />
			) : (
				<p>{t('workbench.notReady')}</p>
			);
		return (
			<Tabs
				defaultValue={
					resourceId && ['agents', 'terminal', 'accounts', 'usage', 'quick', 'skills'].includes(resourceId)
						? resourceId
						: 'agents'
				}
				className="space-y-6"
			>
				<TabsList className="flex h-auto flex-wrap">
					{(['agents', 'terminal', 'accounts', 'usage', 'quick', 'skills'] as const).map((key) => (
						<TabsTrigger key={key} value={key}>
							{t(`agent.manage.tab.${key}`)}
						</TabsTrigger>
					))}
				</TabsList>
				<TabsContent value="agents">
					<AgentsSettings controller={controller} />
				</TabsContent>
				<TabsContent value="terminal">
					<TerminalSettings controller={controller} />
				</TabsContent>
				<TabsContent value="accounts">
					<AccountsSection controller={controller} />
				</TabsContent>
				<TabsContent value="usage">
					<UsageSettings controller={controller} />
				</TabsContent>
				<TabsContent value="quick">
					<QuickCommandsSection controller={controller} />
				</TabsContent>
				<TabsContent value="skills">
					<PortableSettings handle={controller.settings} desktop={desktop} />
				</TabsContent>
			</Tabs>
		);
	};
}
