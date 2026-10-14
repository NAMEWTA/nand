import { SettingsSection } from '../../../ui/components/nand/SettingsSection';
import { SettingsRow } from '../../../ui/components/nand/SettingsRow';
import { Button } from '../../../ui/components/button';
import { useT } from '../../../ui/react/hooks';
export const automationsSettingsPage = (props: { tasks: () => void; inbox: () => void }) =>
	function SettingsPage() {
		return <AutomationsSettingsPage {...props} />;
	};
export function AutomationsSettingsPage({ tasks, inbox }: { tasks: () => void; inbox: () => void }) {
	const t = useT();
	return (
		<>
			<SettingsSection title={t('automation.title')}>
				<SettingsRow
					label={t('automation.title')}
					description={t('automation.localOnly')}
					control={
						<Button variant="outline" size="sm" onClick={tasks}>
							{t('automation.open')}
						</Button>
					}
				/>
				<SettingsRow
					label={t('automation.inbox')}
					control={
						<Button variant="outline" size="sm" onClick={inbox}>
							{t('automation.open')}
						</Button>
					}
				/>
			</SettingsSection>
			<SettingsSection title={t('automation.help')}>
				<p className="text-sm text-muted-foreground">{t('automation.configureHelp')}</p>
				<p className="text-sm text-muted-foreground">{t('automation.channelHelp')}</p>
				<p className="text-sm text-muted-foreground">{t('automation.sessionHelp')}</p>
				<p className="text-sm text-muted-foreground">{t('automation.hookHelp')}</p>
			</SettingsSection>
		</>
	);
}
