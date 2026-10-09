English | [简体中文](architecture.ZH.md)

# Architecture

Read this before moving files, importing across zones, adding a command, or renaming anything persisted. The reasons behind these rules are the architecture decisions indexed in the [development documentation](../../../../speculo/.speculo/specdev/.config/domain-layout.md).

## Zones

```
src/app/            plugin entry (main.ts), module registry, settings runtime, commands, ribbon,
                    workbench leaf and composition (app/workbench), contracts (app/contracts)
src/shell/          workbench UI: rail, side panel, page header, page manager (loaded with import())
src/ui/             design system: tokens, primitives, native Modal/Menu wrappers
src/theme/          theme presets, Markdown styles, runtime that applies them to every window
src/host/           Obsidian and desktop adapters used by several modules
src/shared/         utilities, settings DSL and store, storage helpers, i18n runtime and startup dictionaries
src/types/          ambient declarations
src/modules/<id>/   home | agent | browser | archives | automations | notifications | icons | comments | sync
  manifest.ts       data-only description, loaded at startup
  api.ts            types and serviceKey()/contributionPoint() constants other modules may import
  module.ts         the lazy entry: creates the ModuleInstance
  settings.ts       the module's settings schema
  i18n.ts           the module's strings
  core/             models, parsing, scheduling, pure rules (no host packages)
  platform/         Obsidian and vault IO; platform/desktop/ for Node and Electron
  services/         wiring inside the module
  contrib/          contributions to other modules' contribution points
  ui/               pages, panels, settings pages, dialogs
  styles/           the module's CSS (listed in src/styles.json)
native/pty-server/  the Rust terminal helper (stdio frames)
test/               shared fixtures and cross-module tests (user-format golden samples)
```

## Import matrix

Checked by `scripts/verify-architecture.mjs` (`pnpm test:architecture`) for value and type imports, after TypeScript erasure, including literal `import()` and runtime cycles. There is no baseline: any violation fails.

`src/app/contracts/` may be imported from every zone except `shared` and `host`; the rows below leave it out.

| From | May import |
|---|---|
| `shared` | `shared` |
| `host` | `shared`, `host` |
| `theme` | `shared`, `theme` |
| `ui` | `shared`, `theme`, `ui` |
| `shell` | `shared`, `theme`, `ui`, `shell`, `host` |
| `app` | `shared`, `host`, `theme`, `ui`, `app`; module `manifest.ts`, `api.ts`, `settings.ts`; `shell` and module `module.ts` only through `import()` |
| module `core` | own `core` and `api.ts`, `shared`, other modules' `api.ts` |
| module `platform` | own `core`, `platform`, `api.ts`; `shared`, `host`; other `api.ts` |
| module `services` | own `core`, `platform`, `services`, `contrib`, `api.ts`, `settings.ts`, `i18n.ts`; `shared`, `host`, `theme`; other `api.ts` |
| module `contrib` | own `core`, `platform`, `contrib`, `api.ts`; `shared`, `host`; other `api.ts` |
| module `ui` | the whole module (except `module.ts` and `manifest.ts`); `shared`, `host`, `theme`, `ui`, `shell`; other `api.ts` |
| `module.ts` | own `core`, `platform`, `services`, `contrib`, `api.ts`, `settings.ts`, `i18n.ts`, `manifest.ts`; `shared`, `host`, `theme`; other `api.ts`; own `ui` only through `import()` |
| `manifest.ts` | own `api.ts`, other `api.ts`; own `module.ts` only through `import()` in `load()` |
| `api.ts` | own `core` (types), other `api.ts`; it exports only types and key constants |
| `settings.ts` | own `core`, own `api.ts`; `shared`, `host`, `theme`; other `api.ts` |
| `i18n.ts` | no module code |

Other rules the checker enforces:

- `electron`, Node built-ins and `window.require(...)` appear only under a `desktop/` folder. Core and shared code use no host package (`obsidian`, `electron`, `preact`, `react`, `@codemirror/*`, `@xterm/*`) and no host globals such as `window`, `document`, `navigator`, `process` or `HTMLElement`.
- Never import a containing barrel (`index.ts`) from inside its own tree.
- Runtime import cycles, including cycles through lazy imports, fail.

ESLint adds: no `process`, `Buffer`, `__dirname`, `__filename` or `global` outside `desktop/` folders.

## Startup and lazy loading

esbuild builds one CommonJS `main.js` without code splitting. A file reachable only through `import()` is wrapped in a lazy initializer and runs on first import; one static edge from startup code pulls its whole closure into the startup set. So:

- Startup code is `src/app/main.ts` and what it imports statically: the registry, settings runtime, manifests, `api.ts` files, settings schemas, the workbench leaf (`app/workbench/workbench-leaf.ts`), the comments leaf, theme runtime and startup dictionaries.
- The shell loads when a workbench leaf opens (`import('../../shell/host/workbench-surface')`).
- Module code loads through `manifest.load()`; pages and settings pages load on first use from `pages` / `settingsPage` loaders; heavy libraries (chart.js, lunar, xterm, icon data) load behind a second `import()` inside the module.
- Specifiers are literals. Do not rely on import side effects to register anything.
- `pnpm run check:bundle` reports the startup set and each module's activation closure and fails over budget (`scripts/bundle-budget.json`). `--files` lists every startup input by size.

## Module system

`src/app/manifests.ts` lists the manifests; `ModuleRegistry` (`src/app/modules/registry.ts`) creates a module when its switch in the `app` namespace is on and the platform is supported, enables in manifest `order`, disables in reverse, and isolates failures (a module whose load, `activate` or `dispose` throws is `failed`, shown on its rail icon and in settings; the others continue). A switch starts from the manifest's `defaultEnabled`. States: `off`, `unsupported`, `idle`, `loading`, `active`, `disposing`, `failed`. Re-enabling creates a new instance.

Modules talk through:

- **Services** (`ServiceKey<T>` in the owner's `api.ts`): `peek` returns the value only if the owner is active and never activates it; `acquire` activates the owner and returns a lease whose `revoked` signal aborts when the owner stops; `watch` follows availability.
- **Contribution points** (`ContributionPoint<T>`): for example automation sources contributed by home and archives, and notification openers contributed by automations.

The contract is `src/app/contracts/module.ts`; how to write a module is `module-authoring.md`.

## Workbench

One workbench view (`WORKBENCH_VIEW_TYPE` in `app/workbench/workbench-leaf.ts`). The leaf keeps its state and loads the shell surface on open. `app/workbench/compose-workbench.ts` declares the rail entries (features, icons, panels, availability) and maps each feature to a module page through `plugin.activateModule(id)` and `ModuleInstance.pages`. Features and their owning modules are `WORKBENCH_FEATURES` / `FEATURE_MODULES` in `app/contracts/workbench.ts`. Shell behavior and page contracts are the ui skill.

The comments side panel (`app/workbench/comments-leaf.ts`) is the only other view; it shows the comments module's panel service or an "enable the module" state.

## Commands

| Kind | Home |
|---|---|
| Shell commands (open workbench, open a module's page, cycle theme preset, copy references) | `src/app/commands.ts`, `src/app/copy-commands.ts`; a module's command uses `checkCallback` on `plugin.moduleState(id) === 'active'` |
| Module commands | `context.commands.add(...)` inside the module (removed on dispose); pass `nameKey` so the name follows the language |
| Ids another module must spell | `NAND_COMMANDS` in `src/shared/commands.ts` |

Ids omit the plugin id; names omit the word "command"; there are no default hotkeys.

## Persisted names

Do not rename these without a recorded decision; they are user data or user configuration.

| Data | Location | Owner |
|---|---|---|
| Settings (vault) | `.nand/config/settings.json` (`{ version: 1, namespaces: { app, theme, home, … } }`) | `app/settings/runtime.ts` |
| Settings (device) | `.nand/config/devices/<device-id>.json` | same; device-scoped fields (agent shells and paths, music volume, panel sizes) |
| Device id | Obsidian local storage key `nand.device-id`, never in the vault | `host/obsidian/storage/device-id.ts` |
| Comment threads | `.nand/editor/comments/` | comments (`editor-comments.md`) |
| Icons and rules | `.nand/icons/iconic.json` + `.backupN` (upstream Iconic schema) | icons |
| Automation runtime | `.nand/automation/<device-id>/runtime.json`; definitions in `NAND/自动化/<name>-<id>/操作.md` | automations |
| Notifications | `.nand/notifications/<device-id>/inbox.json` | notifications |
| Git sync device state | `<git dir>/nand-sync.json` (automatic-sync clock and pause; inside `.git`, never committed) | sync |
| Agent history labels, automation sessions and cache | `.nand/terminal-agent/<device-id>/` (`history.json`, `automation-sessions.json`; `index.sqlite` is a rebuildable cache) | agent |
| Agent lifecycle hook script | `~/.nand/hooks/nand-automation-hook.cjs`, registered in each CLI's own settings with a `.nand-backup` copy | agent |
| Terminal helper binary | `<plugin folder>/binaries/nand-pty-<platform>-<arch>[.exe]` and `nand-pty.json` (version and digest) | agent |
| Browser history and site permissions | `.nand/browser/<device-id>/state.json` | browser |
| Recovery drafts and board conflicts | `.nand/recovery/drafts/`, `.nand/recovery/dashboard/conflicts/` | shared storage, home |
| Caches | `.nand/cache/` (WeRead progress) | home |
| Records | `NAND/习惯/`, `NAND/记账/`, `NAND/番茄钟/`, `NAND/阅读/` Markdown | home |
| Archives | the configured visible folder (default `档案`), `个人档案/<name>/基本信息.md`, `企业档案/<name>/基本信息.md` | archives |
| Boards | the user's board notes | home (`platform/board/`) |
| Electron partitions | `persist:nand-browser-<vault-local-id>`, `persist:nand-dashboard-music-<vault name>`, `persist:nand-dashboard-web` | browser, home |
| Vault-local UI state | `App.saveLocalStorage` keys `nand.*` | owning module |
| Ribbon ids | `ribbon-<id>` from `src/app/ribbon.ts` (ids are stable; labels are translated) | app |

Obsidian Sync does not sync dot-folders, so `.nand/` needs Git, iCloud, Syncthing or similar; the user guides say so.

## TypeScript

`strict`, `noUncheckedIndexedAccess`, `noImplicitReturns`, `useUnknownInCatchVariables`, target ES2021. Floating promises are errors (`void` a deliberate fire-and-forget). Never return an Obsidian chainable control from a Promise callback (`nand/no-obsidian-thenable`). Files and folders use kebab-case; Preact component files PascalCase; constants other files import (view types, keys) `SCREAMING_SNAKE`. Relative imports only.
