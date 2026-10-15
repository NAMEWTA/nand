import { createStore } from 'zustand/vanilla';
import type { AutomationsApi } from '../core/api';

/** Stable immutable UI snapshots; the durable scheduler remains the owner of definitions and runs. */
export function createAutomationViewStore(service: AutomationsApi) {
	const snapshot = () => ({
		definitions: structuredClone(service.definitions),
		runs: structuredClone(service.state.runs),
		loadError: service.loadError,
		executionEnabled: service.executionEnabled,
	});
	const store = createStore(snapshot);
	const dispose = service.subscribe(() => store.setState(snapshot(), true));
	return { store, dispose };
}
export type AutomationViewStore = ReturnType<typeof createAutomationViewStore>['store'];
