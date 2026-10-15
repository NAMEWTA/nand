import { createStore } from 'zustand/vanilla';
import type { HomeHost } from './home-host';
export function dashboardSettingsStore(host: HomeHost) {
	const state = createStore(() => ({ settings: { ...host.settings } }));
	return {
		state,
		connect: () => host.subscribeSettings(() => state.setState({ settings: { ...host.settings } })),
		update: (update: Parameters<HomeHost['updateSettings']>[0]) => host.updateSettings(update),
	};
}
