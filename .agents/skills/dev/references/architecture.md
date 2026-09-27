# Architecture

Read this before moving files, adding a product, adding a command, adding UI copy, naming a new file, or changing settings pages. Frozen strings live in the SKILL.md identity table. Import prohibitions live in SKILL rules 2 and 3.

## Products

One plugin process, several products. The shell at the entry in the SKILL identity table registers views and long-lived services. It does not own domain logic.

| Product | Root | What the shell imports |
|---|---|---|
| Dashboard | `src/dashboard-view` | Barrel exports `DashboardView`, `DASHBOARD_VIEW_TYPE`, `showModuleDisabled`. The shell also deep-imports services, the workspace registry, and settings modals |
| Editor | `src/editor-view` | Barrel exports `EditorView`, `EDITOR_VIEW_TYPE`, `createEditorHost`, `EditorHost`, `collectReferences` |
| Terminal | `src/terminal-agent` | Barrel exports `TerminalAgentController`, `TerminalView`, `TERMINAL_VIEW_TYPE`, `renderStackedTerminalAgentSettings`, `renderTerminalAgentSettings`, `readLegacyTerminalSettings`. Settings deep-imports `renderStackedTerminalAgentSettings` from `settings/sections` |
| Icons | `src/iconic` | `IconicController`; settings compose `IconicSettingsSections` |
| Archives | `src/contacts` | `ContactsController`, `ContactsView`, `CONTACTS_VIEW_TYPE`. Settings compose the archive settings rows |
| Automations | `src/automation` | `AutomationService`, editor and `AutomationView`, composed by `plugin/automation-host.ts` |
| Notifications | `src/notifications` | `NotificationService` and native inbox; scheduler receives a delivery callback |
| Sync | `src/sync` | `export {}` plus `README.md`. No view type yet |

`src/dashboard-view/persist` writes the dashboard markdown. Leave the directory name `sync` free.

## Who may import whom

```
plugin shell and plugin/settings ──▶ product barrel or a deep path
product ──import type──▶ plugin/main.ts
product ──▶ shared
shared  ──▶ neither product nor plugin
product ──✕──▶ other product, including that product's barrel
```

The one existing break in the shared row is the file named in SKILL rule 2. Do not add a second one, and do not "fix" it by letting `editor-view` import `dashboard-view`.

`shared` may contain DTOs that more than one side must serialize (`EditorWorkbenchSettings`, `NAND_EVENTS`, `NAND_COMMANDS`). It must not contain comment threads, dashboard cards, or terminal implementations. `shared/automation` contains only serialized automation/session-reference DTOs and source/runtime ports; `shared/json-store.ts` provides atomic adapter snapshots.

The plugin shell may pass a narrow callback into a product. The terminal host receives `readAbsoluteReference: () => collectReferences(app, 'absolute')` from `main.ts`. That callback is the boundary.

## Lifecycle on the plugin

The shell owns these services and activates them according to module flags. Tear down active services in plugin `onunload`; do not hang them off `ItemView`.

| Object | When it exists |
|---|---|
| `iconicHost` | Created on first enable and retained for the plugin lifetime. Managers and activation scope exist only while enabled; commands and editor bridges register once |
| `contactsHost` | While the archives module is on; starts its file index after layout readiness when a view or the automation source adapter requests it. Closing a leaf only removes its subscription |
| `editorHost` | While the editor module is on. Highlights and the reading post-processor survive closing the side panel |
| `musicService` | While the dashboard module is on, and never when `Platform.isPhone` |
| `habitService`, `expenseService`, `mediaTagService` | While the dashboard module is on. Loaded once for that stretch |
| `automationHost` | Plugin lifetime, independent of leaves. Source adapters respect module gates; terminal actions require an active desktop terminal host |
| `terminalHost` | While the terminal module is on and `Platform.isDesktopApp` |

`onunload` disposes archive surfaces and their controller, stops the module transition queue, then calls `iconicHost.onunload()`, `terminalHost.onunload()`, `editorHost.onunload()` (comment flush, then dispose), and `teardownBasenameIndex`. If dashboard services were started, it then flushes and destroys media tags and destroys habit, expense, and music. Leaf teardown follows `references/obsidian-api.md`.

The four existing product view types are registered on every platform; the automation view follows successful store loading. The terminal factory uses `terminalHost.createLeafView` when that host is active, and `InactiveTerminalView` otherwise. `applyModuleFlags` runs after registration. A missing `settings.modules` key stays on.

`EditorView.onClose` only runs `detachPanel`. `createEditorHost` registers extensions on the first `onload` (`booted`). A later module restart calls `onload` again on the same host and does not register them a second time.

## Dashboard folders

Add a feature to the folder that already owns that widget. `dataview/` renders query results for the in-repo language in `dql/`. Do not add the Dataview community plugin. Workspace paths are normalized by `src/dashboard-view/workspace/workspace-registry.ts`: no leading slash, no `.md` suffix.

| Folder | Owns |
|---|---|
| `appearance` | Theme studio and modal theme |
| `assets` | Bundled images and the gallery placeholder |
| `banner` | Banner and banner stats |
| `calendar` | Calendar widget, grid, daily notes, holidays |
| `data` | Fortune copy tables |
| `dataview` | Query result UI (tables, heatmaps) |
| `dql` | The in-repo query language |
| `expense` | Expense ledger |
| `habit` | Habit check-in |
| `library` | Library cards, folder config, new notes |
| `media` | Gallery, tags, lightbox |
| `music` | NetEase player |
| `notes` | Memos, quick notes, quick actions |
| `parser` | Board markdown parse and the default document |
| `persist` | Markdown write-back |
| `pomodoro` | Pomodoro timer |
| `reading` | Reading timer and books |
| `renderer` | Dashboard DOM render and refresh |
| `types` | `DashboardSettings` and the board model |
| `ui` | Shared modals, drag-and-drop, dialogs |
| `view` | The `DashboardView` leaf |
| `web` | Web section |
| `weread` | WeRead shelf |
| `widgets` | Album, anniversary, countdown, fortune, lunar, tracker, weather, year progress |
| `workspace` | Multi-file dashboard registry |

Editor folders: `comments`, `copy`, `host`, `view`. `writing-stats` and `focus` are the placeholders named in SKILL rule 12. A new domain implements `EditorDomain` from `src/editor-view/host/registry.ts`, adds an i18n title, and is placed in the `domains` array inside `createEditorHost`. Add a settings option only when the task asks for a user-facing toggle.

## Commands

| Kind | Home |
|---|---|
| Ids another product must spell | `NAND_COMMANDS` in `src/shared/commands.ts`. Today: `open-dashboard`, `open-editor-view`, `add-comment-to-selection` |
| Shell commands | `src/plugin/commands.ts`. Commands already passed to `addCommand` inside `main.ts` stay there |
| Editor commands | The owning domain under `src/editor-view` |
| Terminal commands | Inside `src/terminal-agent` |
| Icon commands | `src/iconic/commands.ts`; preserve upstream local IDs under the NAND prefix |

Registration details that apply to every command are SKILL rule 9.

## Settings

`DashboardSettingTab` is the only settings tab. Page ids come from `src/plugin/settings/nav.ts`:

| Product | Sections stacked on that tab | Default |
|---|---|---|
| `home` | none. Toggles dashboard, editor, terminal, iconic, and contacts. Sync is a label here, not a toggle. Home is always a top tab | `home` |
| `dashboard` | `general`, `widgets`, `coffee`. The top tab is hidden while the module is off | `general` |
| `editor` | `comments`, `copy`. The top tab is hidden while the module is off | `comments` |
| `terminal` | `shell`, `instance`, `workflows`, `appearance`, `behavior`, `connection`, `visibility`, `agents`. The top tab is hidden while the module is off | `shell` |
| `iconic` | `iconic-general`, `iconic-sidebars`, `iconic-editor`, `iconic-menus`, `iconic-picker`, `iconic-advanced`. Visible while the icons module is on | `iconic-general` |
| `contacts` | `contacts-storage`. Visible while the archives module is on | `contacts-storage` |
| `automation` | none. Links to the automation center and notification inbox, with delivery and execution capabilities; always a top tab | `automation` |
| `sync` | none. One placeholder row from `renderSyncSettings`. Sync is always a top tab and is not a home toggle | `sync` |

There is no left-hand page list. `visibleProducts` in `nav.ts` is the top row. `coffee` is the about screen; the page id stays `coffee`. How a row is rendered in both the declarative list and the fallback is `references/obsidian-api.md`. Editor highlight and popover toggles call `editorHost.notifySettingsChanged()`. The default domain dropdown calls `notifyLayoutChanged()`.

## i18n

SKILL rule 8 is where strings live. To add a key:

1. Extend the module under `src/shared/i18n/` that already owns that feature. The object is `{ en: {...}, zh: {...} }`. `section-37.ts`, `section-38.ts`, `section-41.ts`, and `section-42.ts` in that directory are legacy buckets: add a key there only when the surrounding keys already live in that file.
2. If the module is new, import it in `src/shared/i18n/runtime.ts` and pass both `.en` and `.zh` to `mergeDicts`.
3. Terminal UI calls `t` from `src/terminal-agent/i18n.ts` with the key minus the prefix in SKILL rule 8. The wrapper adds the prefix. Do not store a string table in that wrapper.

`setLanguage` follows `settings.language` and emits `onLanguageChanged` only on a change. Views and composers dispose their subscriptions on unmount. Do not read Obsidian's locale. English casing is the UI text rule in `references/obsidian-api.md`.

## Names

New directories and source files use kebab-case (`library-new-note.ts`, `terminal-agent/`). A class is PascalCase. A module-level constant that other files import as a view type or command list is `SCREAMING_SNAKE`. Functions and locals are camelCase.

| Kind | Shape | Leave alone |
|---|---|---|
| Product root | `dashboard-view`, `editor-view`, `terminal-agent`, `iconic`, `contacts`, `plugin`, `shared`, `sync` | Do not fold these into one tree |
| New dashboard CSS | `dashboard-…` | Current theme roots use `nand-dashboard-*` |
| Editor CSS | `nand-editor-…` | The frozen view type string |
| New terminal CSS | `terminal-…` | Existing `terminal-…` classes |
| Archives CSS | `nand-contacts-*` | Keep archive styles scoped to the product surface |
| Ported icon CSS | `.iconic-*` within `body.nand-iconic-enabled` | Keep body-state selectors matching the body itself; see the scoped-port exception in `references/obsidian-api.md` |
| i18n file | kebab-case, one feature per module under `src/shared/i18n/` | Legacy `section-NN.ts` buckets |
| i18n key | dotted, both languages in that module | A key another product already stores |
| Command id | SKILL rule 9 | Ids already registered |

The project is in pre-release development. Keep the current product namespaces consistent; do not add historical-name migration tools or startup gates.

## Data that must not be casually renamed

| Data | Location | Rule |
|---|---|---|
| Plugin settings | `data.json` via `loadData` / `saveData` | Includes `editorWorkbench`. Load settings without requiring a namespace version marker. Normalization order is SKILL rule 10. Never store comment text or the icon-domain payload here |
| Icons and rules | `<configDir>/plugins/<manifest.id>/iconic.json` and `.backup1` through `.backupN` | Upstream schema; owned by `src/iconic/persistence/store.ts`. Only `modules.iconic` belongs in shell settings |
| Comment threads | vault `.nand/editor/comments/` | `references/editor-comments.md` |
| Weread progress | `.obsidian/plugins/<manifest.id>/weread-progress.json` | `manifestId()` reads `plugins.nand.manifest.id` and otherwise uses the plugin id |
| Habits, expense, pomodoro, reading | `habits.json`, `expense.json`, `pomodoro.json`, `reading.json` under `plugins/<manifest.id>/` | Resolve the plugin directory using `manifest.id` |
| CSS classes | `nand-dashboard-*`, `nand-editor-*`, `terminal-*` | Keep current theme hooks stable |
| Vault-local UI state | `nand.dashboard.*` via `App.loadLocalStorage` / `App.saveLocalStorage` | Includes mini-panel positions; never use global storage for new positions |
| Electron sessions | `persist:nand-dashboard-web`, `persist:nand-dashboard-music-*` | New sessions require signing in again; do not delete previous partition directories |
| Terminal context | `NAND_CONTEXT_PATH`, `.agents/skills/nand-obsidian-context/` | Native absolute paths; only overwrite plugin-managed skill files |
| Dashboard markdown | the user's dashboard note | Written only by `dashboard-view/persist` |
| Archive markdown | visible vault folder selected by `settings.contacts.rootFolder` | One note per person/company; stable `nand-id`, `nand-type`, named body regions and link identities. Written only by the archive controller |
| Workspace paths | settings, via `workspace-registry` | No leading `/`, no `.md` suffix |

## TypeScript

`strictNullChecks`, `noUncheckedIndexedAccess`, `noImplicitReturns`, `useUnknownInCatchVariables`. Index access can be `undefined`. `no-floating-promises` and `no-unnecessary-type-assertion` are errors; prefix a deliberate fire-and-forget with `void`. Prefer `import type` for the plugin class from a product. `@codemirror/state`, `@codemirror/view`, and `@codemirror/language` are direct dependencies; bundling them is covered in `references/build-and-release.md`.

## What not to do

- Do not merge products back into one `src/<domain>` tree.
- Do not register a view under a new type to "version" it.
- Do not start the terminal, or import `electron`, on the phone path.
- Do not put product domain logic in `src/plugin` beyond shell, commands, and settings composition.

No namespace migration package or version marker is required. Do not add runtime aliases. Dashboard persistence receives `DashboardSettingsAccess` from the owning view; terminal views receive their controller directly, without plugin-registry lookups.

## Archives

`src/contacts` owns people, companies, employment and direct relationships. `view/` mounts Preact into each leaf's `contentEl`; forms use native Obsidian modals and `Setting`. The source of truth is the configured visible vault folder (default `档案`), with one Markdown note per person/company. Identity is `nand-id`, kind is `nand-type`; employment/relationship tables and prose use named HTML comment boundaries. `persist/markdown.ts` performs three-way field/section updates and retains unrelated text. Never reuse the dashboard persistence engine or put archive entities in `shared`.

`ContactsSettings` is a settings-only DTO in `shared/contacts-settings.ts`. `settings.contacts` stores the root folder and maximum card columns; `modules.contacts` defaults on. Setting a new folder switches the data source without moving/deleting files. Indexes are memory-only and rebuildable. Controller updates and deletions are queued by identity; creates share a separate queue key. Updates use `Vault.process`, creates use `Vault.create`, and deletion uses `FileManager.trashFile`. Module disable drains pending writes and unloads the controller, preserving Markdown files. The shell registers `open-contacts` in `plugin/commands.ts`. Strings live in `shared/i18n/contacts.ts`.

Employment and direct relationships are stored only on people; company membership and inverse relationships are derived. Concurrent edits merge by basic field or whole body region, never by table row. Keep `persist/format-guide.md` consistent with the parser; it is bundled and created in the user's directory only when absent. Usage and maintenance walkthroughs live in `docs/contacts.md` and `docs/contacts-development.md`.

## Icons domain

`src/iconic` is the isolated Iconic 1.1.10 port. It imports only its own modules, `shared/i18n`, and Obsidian/CodeMirror. Other domains do not import it; the shell owns `iconicHost`. The host keeps command/editor registrations once per plugin lifetime and creates an activation `Component` for events, observers, timers, dialogs, ribbon and prototype patches. Disable flushes the store, restores patches and UI; re-enable reuses the controller. No new leaf type is registered.

`modules.iconic` defaults to true and is the only icon-domain value in NAND `data.json`. Domain settings, icons, rules and dialog state retain the upstream schema in `<configDir>/plugins/<manifest.id>/iconic.json`, with `.backup1` through `.backupN` siblings. `persistence/store.ts` owns adapter writes, corruption recovery and raw/focus reload. Do not use plugin `saveData` for this store. No automatic import from a separate Iconic installation.

The single NAND settings tab adds 图标 / Icons with the six stacked sections listed in the Settings table. Both fallback and API 1.13 definitions expose 22 preferences, rulebook and usage checker. Commands remain in `src/iconic/commands.ts`; retain upstream ids (including `toggle-minimal.folder-icons`) under the NAND plugin prefix. English/Chinese strings live in `shared/i18n/iconic.ts`; the domain accessor resolves the current NAND language and preserves upstream `{#}` placeholders.

For a future upstream update, compare the pinned source and the port's documented adaptations before editing. Keep the committed upstream oracle independent of migrated code, verify both settings renderers write to the domain store, and retain resource license notices in the bundle. User instructions and test evidence live in [the icon guide](../../../../docs/icons.md) and [the port record](../../../../docs/iconic-port.md).

## Automation ownership

`plugin/automation-host.ts` injects dashboard, contacts, terminal and notification ports; products never import each other. Dashboard task metadata is Markdown-owned, archive reminders occupy a bounded Markdown region, and widget metadata remains with widget settings. Standalone definitions, cursors and run snapshots live in `.nand/automation/<device-id>.json`; notification deliveries and native session references use sibling device-specific directories. Device identity uses Obsidian local storage. The automation view is registered after persistent stores have loaded successfully. Source scanning and the first scheduler tick wait for `workspace.onLayoutReady`; plugin `onload` must not await the contacts index because that index itself waits for layout readiness.
