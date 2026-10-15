import { useCallback, useSyncExternalStore } from 'react';
import type { SettingsHandle } from '../../../../shared/settings/store';
import type { TerminalSettings } from '../../core/terminal/settings';
export function useAgentSettings(handle: SettingsHandle<TerminalSettings>) {
	return useSyncExternalStore(
		useCallback((listener) => handle.subscribe(listener), [handle]),
		() => handle.get(),
	);
}
