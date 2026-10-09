English | [简体中文](0003-namespaced-settings-store.ZH.md)

# ADR-0003: Namespaced settings store

Status: accepted. Checked against the code on 2026-10-08.

## Problem

Settings belong to different owners and have different reach: language and module switches are shared by every device of a vault, while shell paths and the git location belong to one machine. A flat bag of fields cannot say who owns a value, cannot validate it per module and writes the whole file on every keystroke.

## Decision

- **Namespaces and schemas.** Settings are grouped in namespaces: `app`, `theme`, and one per module that has settings. Each namespace has a schema built with `defineSettings` and the field constructors `f.boolean`, `f.string`, `f.enum`, `f.number`, `f.list`, `f.object` and `f.custom`. Every field has a default, a normalizer that never throws, and a scope. Bound namespaces drop unknown keys when they normalize.
- **Two scopes, two files.** A `vault` field is shared by every device and is stored in `.nand/config/settings.json`. A `device` field belongs to this machine and is stored in `.nand/config/devices/<device-id>.json`. Both files have the shape `{ "version": 1, "namespaces": { "<name>": { ... } } }`. A file in any other shape is ignored and defaults apply. Namespaces that nothing has bound yet are written back unchanged.
- **Access.** A module binds its namespace with `context.settings.bind(name, schema)` and receives a handle: `get`, `update(recipe, { persist })`, `select`, `subscribe` and `touch`. `update` commits in memory and notifies subscribers synchronously. Persistence is debounced by 250 ms with a maximum wait of 1 s, or immediate on request. Pending writes are flushed before the store is disposed. The store reports `idle`, `saving` or `error`, and calls `onPersisted` listeners after each successful write.
- **The `app` namespace.** It holds the language, the intro flag, the workbench status mode and the `modules` switches, each switch defaulting to its manifest's `defaultEnabled`. It exists even when every module is off.
- **First run.** When neither file exists, defaults are seeded, and the language follows Obsidian's: Chinese when Obsidian is Chinese, English otherwise.
- **No other channel.** Modules add no flat plugin setting and never call `saveData`. Nothing is stored in the plugin folder.

## Consequences

A setting always has an owner, a default and a scope. Saving does not run on every keystroke, and a failed write is visible through the store status. The home module's board code mutates its namespace in place and persists it with `touch`; that use is confined to the module's own host (`services/home-host.ts`).

## Evidence

[Store](../../../../src/shared/settings/store.ts), [schema](../../../../src/shared/settings/schema.ts), [runtime](../../../../src/app/settings/runtime.ts), [app schema](../../../../src/app/settings/app-schema.ts). The store tests (`src/shared/settings/store.test.ts`) and the golden user-format tests.
