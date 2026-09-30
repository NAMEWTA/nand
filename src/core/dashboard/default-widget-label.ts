import { t, tFor } from '../../shared/i18n';

type ExampleKind = 'countdown' | 'anniversary';
interface WidgetLabel {
	id: string;
	label: string;
	/** True follows the language; false records an explicitly edited name. */
	defaultLabel?: boolean;
}

/** Recognize only the original shipped examples, never other user entries. */
export function usesDefaultWidgetLabel(config: WidgetLabel, kind: ExampleKind): boolean {
	if (config.defaultLabel !== undefined) return config.defaultLabel;
	const exampleId = kind === 'countdown' ? 'cd-default' : 'av-default';
	const key = `defaults.${kind}Label`;
	const defaults = [tFor('en', key), tFor('zh', key), ...(kind === 'countdown' ? ['New Year Countdown'] : [])];
	return config.id === exampleId && defaults.includes(config.label);
}

export function resolveWidgetLabel(config: WidgetLabel, kind: ExampleKind): string {
	return usesDefaultWidgetLabel(config, kind) ? t(`defaults.${kind}Label`) : config.label;
}
