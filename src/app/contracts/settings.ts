import type { SettingsHandle } from '../../shared/settings/store';

/**
 * Declarative settings pages. The same spec renders in Obsidian's settings tab and in the workbench
 * settings page, so a field is defined once with its labels, control and binding.
 */
export interface SettingsPageSpec {
	readonly id: string;
	readonly titleKey: string;
	readonly descriptionKey?: string;
	readonly sections: readonly SettingsSectionSpec[];
}

export interface SettingsSectionSpec {
	readonly titleKey?: string;
	readonly descriptionKey?: string;
	readonly fields: readonly FieldSpec[];
}

interface FieldBase {
	readonly nameKey: string;
	readonly descriptionKey?: string;
	/** Hidden when this returns false (evaluated on every render). */
	readonly visible?: () => boolean;
}

/** A field bound to one key of a settings namespace. */
export type BoundField<T extends object> =
	| (FieldBase & { readonly kind: 'toggle'; readonly key: keyof T })
	| (FieldBase & { readonly kind: 'select'; readonly key: keyof T; readonly options: ReadonlyArray<{ value: string; labelKey: string }> })
	| (FieldBase & { readonly kind: 'text'; readonly key: keyof T; readonly placeholderKey?: string })
	| (FieldBase & { readonly kind: 'slider'; readonly key: keyof T; readonly min: number; readonly max: number; readonly step: number; readonly zeroLabelKey?: string })
	| (FieldBase & { readonly kind: 'color'; readonly key: keyof T; /** Empty value means "use the default". */ readonly resetLabelKey: string });

export type FieldSpec =
	| ({ readonly handle: SettingsHandle<object> } & BoundField<object>)
	| (FieldBase & { readonly kind: 'button'; readonly labelKey: string; readonly cta?: boolean; run(): void | Promise<void> });

/** Bind a list of fields to one settings handle. */
export function bindFields<T extends object>(handle: SettingsHandle<T>, fields: ReadonlyArray<BoundField<T>>): FieldSpec[] {
	return fields.map((field) => ({ ...(field as BoundField<object>), handle: handle as unknown as SettingsHandle<object> }));
}
