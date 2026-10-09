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
		introSeen: f.boolean({ default: false }),
		workbenchStatus: f.enum(['automatic', 'hidden'] as const, { default: 'automatic' }),
		modules: f.object(moduleFlags),
	});
}
export type AppSettings = ReturnType<ReturnType<typeof appSchema>['defaults']>;
