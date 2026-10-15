import type { HomeHost } from '../services/home-host';
import { DashboardSettings } from './settings/DashboardSettings';
export const homeSettingsPage = (host: HomeHost) =>
	function HomeSettingsPage() {
		return <DashboardSettings host={host} />;
	};
