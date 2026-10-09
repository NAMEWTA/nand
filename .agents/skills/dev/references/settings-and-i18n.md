English | [简体中文](settings-and-i18n.ZH.md)

# Settings and strings

## The settings store

`SettingsStore` (`src/shared/settings/store.ts`) holds named namespaces, each with a schema. `src/app/settings/runtime.ts` creates it over two files:

| Scope | File | For |
|---|---|---|
| `vault` | `.nand/config/settings.json` | preferences shared by every device |
| `device` | `.nand/config/devices/<device-id>.json` | per-machine values: agent shells and paths, music volume, panel sizes |

Both files are `{ version: 1, namespaces: { <name>: {…} } }`. A file in any other shape is ignored and the defaults apply. A namespace no code has bound yet keeps its stored value and is written back unchanged. The `app` namespace (`src/app/settings/app-schema.ts`: language, intro, status bar, module switches), `theme` and the namespaces the app needs at startup (`home`, `archives`, `browser`, `comments`) are bound in `runtime.ts`; other modules bind their own. Unknown keys are dropped by normalization. The first load in a vault seeds the defaults (`firstRun`).

Each module switch in `app.modules` starts from the module's manifest `defaultEnabled`.

## Defining a schema

```ts
import { defineSettings, f } from '../../shared/settings/schema';

export const fooSettings = defineSettings({
	enabled: f.boolean({ default: true }),
	limit: f.number({ default: 20, min: 1, max: 500, integer: true }),
	mode: f.enum(['list', 'card'] as const, { default: 'list' }),
	shell: f.string({ default: '', scope: 'device' }),
	tags: f.list(f.string({ default: '' }), { default: [], max: 50 }),
	window: f.object({ width: f.number({ default: 320, min: 200 }) }),
});
```

Every field has a default, a normalizer that never throws, and a scope (`vault` unless stated). A domain that already owns a model and normalizer uses `domainSettings({ defaults, normalize, scope })` (see `src/modules/browser/settings.ts`, `src/modules/agent/settings.ts`) or `f.custom` for one field.

## Using a handle

```ts
const settings = context.settings.bind('foo', fooSettings);
settings.get().limit;                                   // read (treat as read-only)
await settings.update((draft) => { draft.limit = 50; }); // change; subscribers run synchronously
settings.select((value) => value.mode, (next) => redraw(next));
context.lifetime.register(settings.subscribe(refresh));
```

- `update` commits in memory, notifies, then writes debounced (250 ms, at most 1 s after the first pending change) or with `{ persist: 'immediate' }`; the promise settles when that write finishes. Report a rejected write; do not show success first.
- Text inputs: update on change, not on every keystroke that would trigger heavy work; the store coalesces writes, but redraws are yours.
- `touch()` persists an in-place mutation and exists for the home module's board code; new code uses `update`.
- Secrets (API keys, tokens) do not belong in vault settings; keep them in device scope or out of the vault entirely, and say so in the UI.

## Strings

`t(key, params?)` (`src/shared/i18n`) looks the key up in the current language, then English, then returns the key. Parameters replace `{name}`.

| Dictionary | Holds | Registered |
|---|---|---|
| `src/shared/i18n/*.ts` (startup) | keys startup code reads: app, workbench chrome, settings entry tab, rail labels, commands registered at startup, module titles | merged in `src/shared/i18n/runtime.ts` |
| `src/shared/i18n/lazy/*.ts` | keys several modules read but startup code does not | by each module that uses them, in `module.ts` |
| `src/modules/<id>/i18n.ts` | keys only that module reads | by its `module.ts` |

To add a string:

1. Put the key in the dictionary of the code that reads it; `en` and `zh` together. Keys are dotted and namespaced by area (`agent.`, `browser.`, `workbench.`…).
2. If startup code reads a key that lives in a module dictionary, move it to a startup dictionary (or the startup code shows the key until the module loads).
3. Run `pnpm test:i18n`: it checks that every dictionary has both languages, matching `{placeholders}`, and that every literal `t('…')` key exists somewhere.
4. Tests and verify scripts register module and lazy dictionaries through `scripts/module-strings.ts`; add new dictionaries there.

## Language

The language preference is `app.language` (`zh` or `en`). A new vault follows Obsidian's language (Chinese → `zh`, otherwise `en`). Changing it saves first, then calls `setLanguage`; a failed save keeps the old language. Components that show strings subscribe with `onLanguageChanged` and redraw without losing drafts; native labels created once use the bindings in `src/ui/primitives/localized-dom.ts` and `localized-form.ts`. User content, paths, identifiers, prompts and CLI output are never translated.

English UI text is sentence case. Command names come from `nameKey` so they follow the language.
