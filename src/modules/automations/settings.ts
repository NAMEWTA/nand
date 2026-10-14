import { defineSettings, f } from '../../shared/settings/schema';

/** A device-local UI preference; definitions and run history keep their existing repositories. */
export const automationSettings = defineSettings({
	skipDeleteConfirmation: f.boolean({ default: false, scope: 'device' }),
});
