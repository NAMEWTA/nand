import { defineSettings, f } from '../../shared/settings/schema';
import { MODULE_IDS, type ModuleId } from '../contracts/module';
import { MANIFESTS } from '../manifests';

/** Each module switch starts from its manifest's `defaultEnabled` (on unless a module says otherwise). */
const moduleFlags = Object.fromEntries(
	MODULE_IDS.map((id) => [id, f.boolean({ default: MANIFESTS.find((manifest) => manifest.id === id)?.defaultEnabled ?? true })]),
) as Record<ModuleId, ReturnType<typeof f.boolean>>;

/** Settings namespace `app`: plugin-wide preferences that exist even when every module is off. */
export function appSchema(defaultLanguage: 'en' | 'zh') {
	return defineSettings({
		language: f.enum(['en', 'zh'] as const, { default: defaultLanguage }),
		devGallery: f.boolean({ default: false, scope: 'device' }),
		introSeen: f.boolean({ default: false }),
		font: f.enum(['geist', 'host'] as const, { default: 'geist' }),
		palette: f.enum(['host', 'orca'] as const, { default: 'host' }),
		statusBar: f.object({
			visible: f.boolean({ default: true }),
			segments: f.custom<Record<string, boolean>>({ default: {}, normalize: (raw) =>
				raw && typeof raw === 'object' && !Array.isArray(raw)
					? Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean')) : {} }),
			usageMode: f.enum(['verbose', 'compact'] as const, { default: 'verbose' }),
			usageDisplay: f.enum(['used', 'remaining'] as const, { default: 'used' }),
			mirrorToObsidian: f.boolean({ default: false }),
		}),
		modules: f.object(moduleFlags),
	});
}
export type AppSettings = ReturnType<ReturnType<typeof appSchema>['defaults']>;
