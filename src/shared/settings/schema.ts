/** Where a setting is stored: the vault configuration (shared by every device) or this device's file. */
export type SettingsScope = 'vault' | 'device';

export interface Field<T> {
	readonly scope: SettingsScope;
	default(): T;
	/** Coerce a stored or edited value into a valid one; never throws. */
	normalize(value: unknown): T;
}

type Options<T> = { default: T; scope?: SettingsScope };
const scopeOf = (options: { scope?: SettingsScope }): SettingsScope => options.scope ?? 'vault';
const clone = <T>(value: T): T => (value === null || typeof value !== 'object' ? value : structuredClone(value));
const isRecord = (value: unknown): value is Record<string, unknown> =>
	!!value && typeof value === 'object' && !Array.isArray(value);

/** Field constructors. Every field has a default, a normalizer and a storage scope. */
export const f = {
	boolean(options: Options<boolean>): Field<boolean> {
		return { scope: scopeOf(options), default: () => options.default, normalize: (value) => (typeof value === 'boolean' ? value : options.default) };
	},
	string(options: Options<string> & { max?: number }): Field<string> {
		return {
			scope: scopeOf(options),
			default: () => options.default,
			normalize: (value) => (typeof value === 'string' ? (options.max ? value.slice(0, options.max) : value) : options.default),
		};
	},
	enum<const V extends string>(values: readonly V[], options: Options<V>): Field<V> {
		return {
			scope: scopeOf(options),
			default: () => options.default,
			normalize: (value) => (values.includes(value as V) ? (value as V) : options.default),
		};
	},
	number(options: Options<number> & { min?: number; max?: number; integer?: boolean }): Field<number> {
		return {
			scope: scopeOf(options),
			default: () => options.default,
			normalize: (value) => {
				if (typeof value !== 'number' || !Number.isFinite(value)) return options.default;
				let next = options.integer ? Math.round(value) : value;
				if (options.min !== undefined) next = Math.max(options.min, next);
				if (options.max !== undefined) next = Math.min(options.max, next);
				return next;
			},
		};
	},
	list<T>(item: Field<T>, options: Options<T[]> & { max?: number }): Field<T[]> {
		return {
			scope: scopeOf(options),
			default: () => clone(options.default),
			normalize: (value) => {
				if (!Array.isArray(value)) return clone(options.default);
				const items = value.map((entry) => item.normalize(entry));
				return options.max ? items.slice(0, options.max) : items;
			},
		};
	},
	object<S extends Record<string, Field<unknown>>>(fields: S, options: { scope?: SettingsScope } = {}): Field<SchemaValue<S>> {
		const schema = defineSettings(fields);
		return { scope: scopeOf(options), default: () => schema.defaults(), normalize: (value) => schema.normalize(value) };
	},
	/** Escape hatch for an existing domain normalizer (the value is owned by that domain's model). */
	custom<T>(options: Options<T> & { normalize: (value: unknown) => T }): Field<T> {
		return { scope: scopeOf(options), default: () => clone(options.default), normalize: (value) => (value === undefined ? clone(options.default) : options.normalize(value)) };
	},
};

export type FieldValue<F> = F extends Field<infer T> ? T : never;
export type SchemaValue<S extends Record<string, Field<unknown>>> = { [K in keyof S]: FieldValue<S[K]> };

export interface Schema<T extends object> {
	defaults(): T;
	/** Unknown keys are dropped; missing or invalid values fall back to their defaults. */
	normalize(raw: unknown): T;
	/** The part of a value stored in one scope. */
	pick(value: T, scope: SettingsScope): Partial<T>;
}

export function defineSettings<S extends Record<string, Field<unknown>>>(fields: S): Schema<SchemaValue<S>> {
	const keys = Object.keys(fields) as Array<keyof S & string>;
	return {
		defaults: () => Object.fromEntries(keys.map((key) => [key, fields[key]!.default()])) as SchemaValue<S>,
		normalize: (raw) => {
			const source = isRecord(raw) ? raw : {};
			return Object.fromEntries(keys.map((key) => [key, fields[key]!.normalize(source[key])])) as SchemaValue<S>;
		},
		pick: (value, scope) =>
			Object.fromEntries(keys.filter((key) => fields[key]!.scope === scope).map((key) => [key, value[key]])) as Partial<SchemaValue<S>>,
	};
}

/** A whole-namespace schema around an existing domain model (`normalize` owns validation). */
export function domainSettings<T extends object>(options: { defaults: () => T; normalize: (raw: unknown) => T; scope?: SettingsScope }): Schema<T> {
	const scope = options.scope ?? 'vault';
	return {
		defaults: options.defaults,
		normalize: (raw) => (raw === undefined ? options.defaults() : options.normalize(raw)),
		pick: (value, wanted) => (wanted === scope ? value : {}),
	};
}
