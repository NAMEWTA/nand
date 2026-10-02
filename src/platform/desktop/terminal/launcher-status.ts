import type { AiLauncherCatalogEntry } from '../../../core/pty/ai-launcher-catalog';
import { buildAiLauncherStatusSnapshot } from '../../../core/pty/ai-launcher-status';
import { detectCommandAvailability, type CommandAvailability } from './command-availability';
import { probeCommandVersion } from './command-version-probe';
import { fetchLatestVersion } from './latest-version-registry';

/** One probe pipeline for menus and settings; callers decide when network checks are enabled. */
export async function probeLauncher(entry: AiLauncherCatalogEntry, checkUpdates: boolean) {
	if (!entry.detectCommand) return null;
	const [pathAvailable, local] = await Promise.all([
		detectCommandAvailability(entry.detectCommand).catch((): CommandAvailability => 'unknown'),
		probeCommandVersion(entry.detectCommand).catch(() => ({ version: null, resolvedFrom: null })),
	]);
	const latest =
		checkUpdates && entry.versionRegistry
			? await fetchLatestVersion(entry.versionRegistry).catch((error: unknown) => ({
					version: null,
					error: error instanceof Error ? error.message : String(error),
				}))
			: null;
	return buildAiLauncherStatusSnapshot({ pathAvailable, local, latest });
}
