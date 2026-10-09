import type { ModuleManifest } from './contracts/module';
import { agentManifest } from '../modules/agent/manifest';
import { archivesManifest } from '../modules/archives/manifest';
import { automationsManifest } from '../modules/automations/manifest';
import { browserManifest } from '../modules/browser/manifest';
import { commentsManifest } from '../modules/comments/manifest';
import { homeManifest } from '../modules/home/manifest';
import { iconsManifest } from '../modules/icons/manifest';
import { notificationsManifest } from '../modules/notifications/manifest';
import { syncManifest } from '../modules/sync/manifest';

/** Every module NAND ships. Manifests are data only; module code loads through `manifest.load()`. */
export const MANIFESTS: readonly ModuleManifest[] = [
	browserManifest,
	homeManifest,
	commentsManifest,
	archivesManifest,
	agentManifest,
	iconsManifest,
	notificationsManifest,
	automationsManifest,
	syncManifest,
];
