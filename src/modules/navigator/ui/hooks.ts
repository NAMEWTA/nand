// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { useStore } from 'zustand';
import type { NavigatorSettings } from '../settings';
import type { NavigatorService, NavigatorState } from '../services/navigator';
import type { NavigatorEnv } from './env';

export const NavigatorContext = createContext<NavigatorEnv | null>(null);

export function useEnv(): NavigatorEnv {
	const env = useContext(NavigatorContext);
	if (!env) throw new Error('NavigatorContext is missing');
	return env;
}

export function useNav<T>(service: NavigatorService, selector: (state: NavigatorState) => T): T {
	return useStore(service.state, selector);
}

export function useNavigatorSettings(service: NavigatorService): NavigatorSettings {
	return useSyncExternalStore((listener) => service.settings.subscribe(listener), () => service.settings.get(), () => service.settings.get());
}

/** Re-render when the vault index changes. */
export function useIndexVersion(service: NavigatorService): number {
	return useSyncExternalStore((listener) => service.index.subscribe(listener), () => service.index.version, () => service.index.version);
}

/** Re-render when previews load; rows read `previews.get` afterwards. */
export function usePreviewVersion(env: NavigatorEnv): number {
	return useSyncExternalStore((listener) => env.previews.subscribe(listener), () => env.previews.version, () => env.previews.version);
}

export function useIconsVersion(env: NavigatorEnv): number {
	const [version, setVersion] = useState(0);
	useEffect(() => env.subscribeIcons(() => setVersion((value) => value + 1)), [env]);
	return version;
}
