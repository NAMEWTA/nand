English | [简体中文](module-authoring.ZH.md)

# Writing a module

A module is a lazily loaded feature with its own lifetime. The contract is `src/app/contracts/module.ts`; `src/modules/notifications/` is the smallest complete example, `src/modules/comments/` shows editor integrations, `src/modules/sync/` a desktop-only module that is off by default, and `src/modules/home/` a large one.

## Files

| File | Holds | Loaded |
|---|---|---|
| `manifest.ts` | `ModuleManifest`: id, order, icon, title and description keys, platforms, `defaultEnabled`, activation, provided and contributed points, `load: () => import('./module')` | at startup (keep it data only) |
| `api.ts` | types other modules may use and `serviceKey()` / `contributionPoint()` constants | at startup (types and keys only) |
| `module.ts` | `export default function create<Name>Module(context): ModuleInstance` | when the module is enabled |
| `settings.ts` | the namespace schema (`defineSettings` or `domainSettings`) | at startup if `app` binds it, otherwise with the module |
| `i18n.ts` | `export const messages = { en: {…}, zh: {…} }` | with `module.ts` |
| `core/`, `platform/`, `services/`, `contrib/`, `ui/`, `styles/` | see the zone table in `architecture.md` | with the module or later |

Manifest fields worth knowing:

- `platforms`: `{ desktop, mobile }`. Set `mobile: false` for anything that needs Node or Electron. An unsupported module is `unsupported` and never loads.
- `defaultEnabled`: the initial value of the module switch in the `app` namespace. Use `false` for a module that starts processes or talks to a remote (sync).
- `activation`: `startup` (during plugin load; a failure only marks this module failed), `layout-ready` (after the workspace layout is ready) or `on-demand` (the first time a page, command or service needs it).

## Adding a module

1. Add the id to `ModuleId` and `MODULE_IDS` (`src/app/contracts/module.ts`). The module switch in the `app` namespace is generated from that list (`src/app/settings/app-schema.ts`).
2. Write `manifest.ts` and add it to `MANIFESTS` (`src/app/manifests.ts`). `order` decides enable order (reverse on disable).
3. Write `module.ts`. At the top, `registerMessages(messages)` (and any `shared/i18n/lazy/*` dictionary it reads). The factory may do cheap setup; IO and listeners go into `activate()`. Return:
   - `services` / `contributions` as `[key, value]` pairs (getters are fine when values exist only after `activate()`),
   - `pages`: `{ <page>: async () => (await import('./ui/<page>-page')).create…(…) }`,
   - `settingsPage`: `async () => (await import('./ui/settings-page')).…`,
   - `activate(signal)` and `dispose(reason)` (`'disabled' | 'unload'`).
4. Use the context instead of the plugin:
   - `context.settings.bind(name, schema)` for settings (`settings-and-i18n.md`),
   - `context.lifetime` (`registerEvent`, `registerDomEvent`, `register`) for anything that must end with the module,
   - `context.commands.add({ id, name, nameKey, … })` for palette commands,
   - `context.editor.addExtension(…)` / `addPostProcessor(…)` for editor features,
   - `context.services` (`peek`, `acquire`, `watch`) and `context.contributions` for other modules,
   - `context.shell.open(target)` to show a workbench page, `context.shell.refresh()` after state the rail or panel shows changes,
   - `context.env` (`desktop`, `mobile`, `phone`) for platform choices.
5. Add `i18n.ts` to `scripts/module-strings.ts` so tests and verify scripts see the strings.
6. Add the module's CSS under `styles/`, list each file in `src/styles.json`, then `node scripts/build-styles.mjs --write`. Scope selectors under the module's own class prefix (ui skill).
7. Add a budget for its activation closure under `moduleActivationBytes` in `scripts/bundle-budget.json`.

## A workbench page

1. Add the feature id to `WORKBENCH_FEATURES` and its owner to `FEATURE_MODULES` (`src/app/contracts/workbench.ts`), and its sections to `sections` in `src/shell/navigation-state.ts` if it has any.
2. Add a contribution in `src/app/workbench/compose-workbench.ts`: rail slot, navigation (label key, icon, child sections), `panel` (from a service the module provides, read with `peek`), `availability` (enabled, supported, ready), `stateKeys` (what the page may save in the leaf), and `create: modulePage('<module>', '<page>')`.
3. Implement the page loader in `ui/<page>-page.ts`. It returns a `PageCreate`: given the native surface context, target, saved state and an abort signal, it returns `{ surface, navigate, getTarget?, getState?, restore? }`. The surface is a `NativeSurface` subclass. Rendering rules are the ui skill.
4. If the panel or title reads module state, expose it through a service in `api.ts` (for example `HOME_WORKBENCH`, `AGENT_WORKBENCH`, `SYNC_WORKBENCH`) and have compose-workbench `watch` it so the shell refreshes when the service appears, changes or goes away.

## A settings page

`settingsPage` returns a renderer `(container, host) => void`; `host.refresh()` redraws, `host.keep(off)` keeps a subscription while the page is shown. To list it in workbench settings, add the product to `src/app/settings/nav.ts` (`SettingsProduct`, `ORDER`, `ModuleGates`, `PRODUCT_MODULES`) and its label and icon to `src/app/workbench/settings-categories.ts`. Use native `Setting` rows bound to the settings handle; the Obsidian settings tab only carries the entry rows (`src/app/settings/entry-tab.ts`).

## Talking to other modules

- Need something another module does: import its key from its `api.ts`; `peek` when the feature is optional and must not turn the other module on (status, panel data), `acquire` when the user asked for it (the lease's `revoked` signal tells you the owner stopped).
- Offer something: put the interface and key in your `api.ts`, return the value in `services`, and list the key in the manifest's `provides`.
- Let others plug in: declare a `contributionPoint` in your `api.ts`; contributors return `[point, value]` in `contributions` and list it under `contributes`. Collect with `context.contributions.collect(point)`.
- Never import another module's internals, and never reach the plugin instance.

## Lifetime checklist

- [ ] `dispose()` releases timers, listeners, processes, DOM outside the leaf and body classes; `dispose('unload')` does not prompt the user
- [ ] Commands and editor extensions go through `context.commands` / `context.editor`
- [ ] Turning the module off and on again in a running vault works (the probe and the module's tests cover it)
- [ ] Startup set unchanged (`pnpm run check:bundle`), architecture check clean
