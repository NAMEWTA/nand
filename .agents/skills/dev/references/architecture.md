# Architecture

Read this before moving files, adding a product, adding a command, adding UI copy, naming a new file, or changing settings pages. Frozen strings live in the SKILL.md identity table. Import prohibitions live in SKILL rules 2 and 3.

Long-term rationale and domain language: [SpecDev documentation index](../../../../speculo/.speculo/specdev/.config/domain-layout.md). The rules below are editing constraints; dated results belong in SpecDev Evidence.

## Source layers

| Layer | Responsibility | May import |
|---|---|---|
| `plugin` | Obsidian entry, module activation, native registration, settings envelope, workflows | every layer |
| `view` | Preact panels, workbench composition, native leaf/modal/menu integration | view, platform, core, shared |
| `platform` | Obsidian/Vault IO, native patches, desktop filesystem, Rust transports | platform, core, shared |
| `core` | parsing, models, scheduling, state and pure domain rules | core, shared |
| `shared` | basic utilities, serialization ports, protocol DTOs and i18n | shared |

These rules cover type imports too. Never import a containing barrel from inside its own tree. `scripts/verify-architecture.mjs` checks directions, host dependencies in core/shared and runtime cycles after TypeScript erasure, including literal lazy imports and require calls. No compatibility aliases or old source-tree facades.

Use concrete kebab-case domain directories (`agent-launch`, `ai-vault`, `automations`, `contacts`, `pty`), PascalCase Preact component files and kebab-case logic files. Keep feature-specific visual components beside their panel. `view/primitives` is for domain-neutral UI. This adapts ORCA's domain/main and renderer/app-shell separation to one Obsidian plugin process; there is no Electron preload or IPC layer inside NAND.

## Composition and lifecycle

`Plugin`, `Component`, `ItemView`, `Modal`, commands, menus, settings and workspace registrations use native Obsidian APIs. Preact manages rendered business content, with `render(null, root)` on disposal. xterm, CodeMirror, Chart.js and MarkdownRenderer own their specialized content inside stable containers. Preact is not a lifecycle or plugin-management framework.

`plugin/modules` assembles domain integrations. `plugin/workflows/automation-host.ts` coordinates scheduler, delivery and source adapters; `agent-runtime.ts` coordinates agent runs. A module can stay active when all of its views are closed. Disabling a module or unloading the plugin releases its owned resources. `TerminalService` owns `PtySession` instances with a DOM-free `@xterm/headless` buffer. `TerminalRenderers` in view lazily creates browser xterm presentations; scheduled automation does not create one. The platform layer never imports a view. Native icon managers receive dialog actions through `IconicDialogs`.

`NandSettings` and plugin defaults live in `plugin/settings/model.ts`. Domain settings stay in core. `DashboardSettings` contains dashboard fields; it does not own language, module flags, contacts, editor or terminal configuration. Persistent identifiers and the actual data formats are independent of source file paths.

The registered view identifiers remain in SKILL.md. Inactive terminal leaves use the native placeholder. Editor extensions are registered once by `createEditorHost`; closing the panel unmounts UI only. Comment bodies stay in sidecars and never rewrite a note.

## Functional panels

`AutomationsPanel`, `ContactsSurface`, `CommentsPanel`, `InboxPanel`, `HabitPanel`, `CountdownPanel`, `AnniversaryPanel`, and terminal panels accept explicit state/actions or host contracts. They can be composed in code without constructing their own ItemView. `TerminalWorkbench` composes session/history/usage slots around a stable xterm container. Settings and native host chrome remain native.

Dashboard UI remains organized under `view/dashboard/<feature>`; parser/model/DQL logic lives in core, Vault persistence and data access in platform. Dashboard business panels have completed the Preact conversion; native layout scaffolding and configuration UI retain their host implementations. Do not disguise an imperative business renderer as a completed Preact component by mounting it inside a one-effect wrapper. New business rendering uses real components.

`DashboardRenderContext` belongs to a dashboard root. Detached sections/widgets explicitly retain that context. Charts, panel roots, album timers, drag sources and scanning signatures are per workbench. Dataview actions are per rendered section. Vault indexes and widget service registrations are keyed by App. Never restore a module-global "active" opener, hover parent or service. Timers retain their originating Window; moving a dashboard rebuilds its widgets and closing it unmounts panels before clearing native DOM.

Contacts, habit and expense application services live in core and accept file/storage ports. Native adapters own Component lifecycle, Vault operations, unsaved-editor checks and focus events. Keep atomic process/write semantics and serialized entity saves.

Workspace normalization lives in `core/workspace/workspace-registry.ts`; dashboard Markdown IO belongs in `platform/obsidian/dashboard`. The sync placeholder is `core/sync`.

## Commands

| Kind | Home |
|---|---|
| Ids another product must spell | `NAND_COMMANDS` in `src/shared/commands.ts`. Today: `open-dashboard`, `open-editor-view`, `add-comment-to-selection` |
| Shell commands | `src/plugin/commands.ts`. Commands already passed to `addCommand` inside `main.ts` stay there |
| Editor commands | The owning domain under `src/view/editor` |
| Terminal commands | Inside `src/plugin/modules/terminal` |
| Icon commands | `src/plugin/modules/icons/commands.ts`; preserve upstream local IDs under the NAND prefix |

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

There is no left-hand page list. `visibleProducts` in `nav.ts` is the top row and wraps when space is limited. `coffee` is the about screen; the page id stays `coffee`. How a row is rendered in both the declarative list and the fallback is `references/obsidian-api.md`. Editor highlight and popover toggles call `editorHost.notifySettingsChanged()`. Comments is the only available editor domain; writing stats and focus have no UI or settings entry until implemented. Stored placeholder selections normalize to comments.

## i18n

SKILL rule 8 is where strings live. To add a key:

1. Extend the module under `src/shared/i18n/` that already owns that feature. The object is `{ en: {...}, zh: {...} }`. `section-37.ts`, `section-38.ts`, `section-41.ts`, and `section-42.ts` in that directory are legacy buckets: add a key there only when the surrounding keys already live in that file.
2. If the module is new, import it in `src/shared/i18n/runtime.ts` and pass both `.en` and `.zh` to `mergeDicts`.
3. Terminal UI calls `t` from `src/shared/i18n/terminal-accessor.ts` with the key minus the prefix in SKILL rule 8. The wrapper adds the prefix. Do not store a string table in that wrapper.

`setLanguage` follows `settings.language` and emits `onLanguageChanged` only on a change. Views and composers dispose their subscriptions on unmount. Do not read Obsidian's locale. English casing is the UI text rule in `references/obsidian-api.md`.

## Names

Directories and logic files use kebab-case. Preact component files use PascalCase (`CommentsPanel.tsx`). A class is PascalCase. A module-level constant that other files import as a view type or command list is `SCREAMING_SNAKE`. Functions and locals are camelCase.

| Kind | Shape | Leave alone |
|---|---|---|
| Domain slice | kebab-case under its owning layer | Keep functional ownership visible |
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
| Icons and rules | `<configDir>/plugins/<manifest.id>/iconic.json` and `.backup1` through `.backupN` | Upstream schema; owned by `src/platform/obsidian/icons/persistence/store.ts`. Only `modules.iconic` belongs in shell settings |
| Comment threads | vault `.nand/editor/comments/` | `references/editor-comments.md` |
| Weread progress | `.obsidian/plugins/<manifest.id>/weread-progress.json` | `manifestId()` reads `plugins.nand.manifest.id` and otherwise uses the plugin id |
| Habits, expense, pomodoro, reading | `habits.json`, `expense.json`, `pomodoro.json`, `reading.json` under `plugins/<manifest.id>/` | Resolve the plugin directory using `manifest.id` |
| CSS classes | `nand-dashboard-*`, `nand-editor-*`, `terminal-*` | Keep current theme hooks stable |
| Vault-local UI state | `nand.dashboard.*` via `App.loadLocalStorage` / `App.saveLocalStorage` | Includes mini-panel positions; never use global storage for new positions |
| Electron sessions | `persist:nand-dashboard-web`, `persist:nand-dashboard-music-*` | New sessions require signing in again; do not delete previous partition directories |
| Terminal context | `NAND_CONTEXT_PATH`, `.agents/skills/nand-obsidian-context/` | Native absolute paths; only overwrite plugin-managed skill files |
| Dashboard markdown | the user's dashboard note | Written only by `platform/obsidian/dashboard` |
| Archive markdown | visible vault folder selected by `settings.contacts.rootFolder` | One note per person/company; stable `nand-id`, `nand-type`, named body regions and link identities. Written only by the archive controller |
| Workspace paths | settings, via `workspace-registry` | No leading `/`, no `.md` suffix |

## TypeScript

`strictNullChecks`, `noUncheckedIndexedAccess`, `noImplicitReturns`, `useUnknownInCatchVariables`. Index access can be `undefined`. `no-floating-promises` and `no-unnecessary-type-assertion` are errors; prefix a deliberate fire-and-forget with `void`. Product views use explicit host/action interfaces; importing the plugin class, including with `import type`, is forbidden. `@codemirror/state`, `@codemirror/view`, and `@codemirror/language` are direct dependencies; bundling them is covered in `references/build-and-release.md`.

## What not to do

- Do not merge products back into one `src/<domain>` tree.
- Do not register a view under a new type to "version" it.
- Do not start the terminal, or import `electron`, on the phone path.
- Do not put product domain logic in `src/plugin` beyond shell, commands, and settings composition.

No namespace migration package or version marker is required. Do not add runtime aliases. Dashboard persistence receives `DashboardSettingsAccess` from the owning view; terminal views receive their controller directly, without plugin-registry lookups.

## Archives

`core/contacts` owns people, companies, employment and direct relationships; `platform/obsidian/contacts` owns Vault IO. `view/contacts` mounts Preact into each leaf's `contentEl`; forms use native Obsidian modals and `Setting`. The source of truth is the configured visible vault folder (default `档案`), with one Markdown note per person/company. Identity is `nand-id`, kind is `nand-type`; employment/relationship tables and prose use named HTML comment boundaries. `persist/markdown.ts` performs three-way field/section updates and retains unrelated text. Never reuse the dashboard persistence engine or put archive entities in `shared`.

`ContactsSettings` is a settings-only DTO in `shared/contacts-settings.ts`. `settings.contacts` stores the root folder and maximum card columns; `modules.contacts` defaults on. Setting a new folder switches the data source without moving/deleting files. Indexes are memory-only and rebuildable. Controller updates and deletions are queued by identity; creates share a separate queue key. Updates use `Vault.process`, creates use `Vault.create`, and deletion uses `FileManager.trashFile`. Module disable drains pending writes and unloads the controller, preserving Markdown files. The shell registers `open-contacts` in `plugin/commands.ts`. Strings live in `shared/i18n/contacts.ts`.

Employment and direct relationships are stored only on people; company membership and inverse relationships are derived. Concurrent edits merge by basic field or whole body region, never by table row. Keep `persist/format-guide.md` consistent with the parser; it is bundled and created in the user's directory only when absent. User operations live in `docs/contacts.md`. The durable decision is [contacts Markdown ownership](../../../../speculo/.speculo/specdev/adr/0005-contacts-markdown-source.md); dated maintenance and acceptance evidence is indexed in [the source map](../../../../speculo/.speculo/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/source-map.md).

## Icons domain

`core/icons`, `platform/obsidian/icons` and `view/icons` contain the Iconic 1.1.10 port. Native managers receive dialog actions from `plugin/modules/icons`. Other domains do not import it; the shell owns `iconicHost`. The host keeps command/editor registrations once per plugin lifetime and creates an activation `Component` for events, observers, timers, dialogs, ribbon and prototype patches. Disable flushes the store, restores patches and UI; re-enable reuses the controller. No new leaf type is registered.

`modules.iconic` defaults to true and is the only icon-domain value in NAND `data.json`. Domain settings, icons, rules and dialog state retain the upstream schema in `<configDir>/plugins/<manifest.id>/iconic.json`, with `.backup1` through `.backupN` siblings. `persistence/store.ts` owns adapter writes, corruption recovery and raw/focus reload. Do not use plugin `saveData` for this store. No automatic import from a separate Iconic installation.

The single NAND settings tab adds 图标 / Icons with the six stacked sections listed in the Settings table. Both fallback and API 1.13 definitions expose 22 preferences, rulebook and usage checker. Commands remain in `src/plugin/modules/icons/commands.ts`; use the upstream ids except the normalized `toggle-minimal-folder-icons` under the NAND plugin prefix. English/Chinese strings live in `shared/i18n/iconic.ts`; the domain accessor resolves the current NAND language and preserves upstream `{#}` placeholders.

For a future upstream update, compare the pinned source and the port's documented adaptations before editing. Keep the committed upstream oracle independent of migrated code, verify both settings renderers write to the domain store, and retain resource license notices in the bundle. User instructions and test evidence live in [the icon guide](../../../../docs/icons.md) and [the historical port record](../../../../speculo/.speculo/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/iconic-port.md).

## Automation ownership

`plugin/workflows/automation-host.ts` injects dashboard, contacts, terminal and notification ports; products never import each other. Dashboard task metadata is Markdown-owned, archive reminders occupy a bounded Markdown region, and widget metadata remains with widget settings. Standalone definitions, cursors and run snapshots live in `.nand/automation/<device-id>.json`; notification deliveries and native session references use sibling device-specific directories. Device identity uses Obsidian local storage. The automation view is registered even if loading fails; writes and scheduling remain gated until retry succeeds. Source scanning and the first scheduler tick wait for `workspace.onLayoutReady`; plugin `onload` must not await the contacts index because that index itself waits for layout readiness.


`modules.automation` defaults to true when absent. Home saves the flag before applying `ModuleLifecycle`; a failed save restores the displayed flag without stopping execution. Disabling closes service admission immediately, awaits in-flight launches, stops only automation-owned agent terminals through their original runtime, and awaits durable cancellation. Failed shutdown remains gated and retryable. Re-enable waits for unfinished shutdown before allowing execution; existing cursors, grace and device rules still apply. Keep one automation host, scheduler interval and focus subscription per plugin lifetime. Disabling does not dispose the history view, notification service or their subscriptions, and never destroys independent manual terminals. Definition/run mutations are gated at the service boundary; history, source navigation and notification read actions remain available. Turning off the terminal module still destroys all terminal processes.

### Agent workbench and native history

`src/view/terminal/TerminalWorkbench.tsx` renders a 272px session navigation rail (resizable from 240 to 360px), with a drawer below 800px leaf width, a compact header and the main terminal/history preview. `TerminalView` owns the persistent xterm island, acquires/releases its renderer explicitly and retains workbench state across window migration. Closing a leaf releases the renderer and preserves the TerminalService process; the explicit End session action destroys that process. Terminal module disable or plugin unload destroys all terminal processes. Leaf restore never resubmits a prompt. Deferred leaves must finish `loadIfDeferred` before testing `instanceof TerminalView`.

Hidden presentations unsubscribe from browser output; PTY/headless state remains authoritative. Reveal replays a complete snapshot before consuming live writes. Resize work follows the actual Window, coalesces stable cell dimensions and avoids redundant PTY resize. Keep at most two hidden WebGL contexts and 1,000 navigation markers/command records. Use only public xterm interfaces. MRU selection uses the native suggestion modal and reuses existing leaves without assigning a global shortcut.

The public catalog contains Claude Code, Codex, Gemini, OpenCode, Pi and Grok. `automation-catalog.ts` retains the pinned upstream transport reference; it is not the exposed capability list. `platform/obsidian/ai-vault/service.ts` uses `platform/terminal-server/agent-data-client.ts` and Rust `agent_data.rs` for cancellable background parsing. Only canonical cwd paths inside the current vault are indexed. OpenCode SQLite is opened read-only. Native transcripts are never renamed or rewritten. `.nand/terminal-agent/<device>/index.sqlite` is a disposable cache; `history.json` stores NAND titles, tags, favorite and archive state. Exported Markdown is created through the Vault API in the visible `NAND Exports/` folder and opened as a note.

History summaries and full transcripts are separate internal interfaces and SQLite tables. Filtering, count, aggregate usage and pagination execute in SQL; preview/export alone load full text. Index migration is transactional, scanning writes in short batches, and reads use separate WAL connections. `NativeHistory` shares scans/queries, publishes index/metadata revisions and preserves explicit refresh semantics regardless of search/page. A successful empty scan is initialized even when its index revision is zero. Metadata becomes visible only after durable save. Cancelling the last consumer cancels the shared request; cancelled operations do not enter native execution after waiting for the client. Provider usage is cached per account and hidden leaves do not create polling work.

Notification receipts remain separate from visible inbox rows so clearing read notifications cannot replay delivery. Stable ribbon ids come from `plugin/ribbon.ts`; localized titles and command names update without changing ids. Never return an Obsidian control (a chainable thenable) from a Promise callback; use a block callback returning void.
