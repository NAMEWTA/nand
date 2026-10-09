English | [简体中文](domain-layout.ZH.md)

# NAND development documentation

This is the entry point for contributors and coding agents. English is the default and canonical text. Every document here has a Simplified Chinese counterpart next to it, with `.ZH` before the extension.

## Where to read

| You want to know | Open |
|---|---|
| How to change code: modules, lazy loading, settings, strings, tests, build, licensing | [Development rules](../../../../.agents/skills/dev/SKILL.md) |
| How to render inside the workbench: shell, design system, theme, motion, accessibility | [Interface rules](../../../../.agents/skills/ui/SKILL.md) |
| What the code is now: modules, data locations, budgets, gates | [Current baseline](../context/current-baseline.md) |
| What has been verified and what has not | [Validation](../context/validation.md) |
| Which module owns which data and how modules cooperate | [Domain map](../context/context-map.md) |
| Why the architecture is the way it is | the ADR index below |
| What users see: settings, data, privacy, each page | [User guides](../../../../docs/README.md) |

## Domain terms

These terms are used the same way in code, documents and the interface. Terms that belong to one module are in the [domain map](../context/context-map.md).

| Term | Meaning |
|---|---|
| Workbench | The one product view, `nand-workbench-view`: a rail, a side panel and a page area. The comments side panel, `nand-comments-view`, is the only other registered view type. |
| Rail, side panel, page | The three columns of the workbench: module icons, the selected module's navigation, and the content. |
| Module | A feature with a manifest, a lazy entry and its own lifecycle. The ids are `home`, `agent`, `browser`, `archives`, `automations`, `notifications`, `icons`, `comments` and `sync`. |
| Feature | A workbench destination owned by a module: `dashboard` (home), `terminal` (agent), `browser`, `contacts` (archives), `automations`, `notifications`, `icons`, `comments`, `records` (home), `sync`, and `settings` (the app). |
| Manifest | The data-only description of a module, read at startup. Module code is reached only through its `load()`. |
| Service, contribution point | The only way modules cooperate. A service is a typed interface one module provides; a contribution point collects values from several modules. Both are declared in the owner's `api.ts`. |
| Lease | The result of acquiring a service. Its `revoked` signal aborts when the providing module stops. |
| Settings namespace | One schema-backed group of settings, such as `app`, `theme` or a module id. |
| Vault scope, device scope | Where a setting is stored: shared by every device of the vault, or only on this machine. |
| Device id | A stable id of this machine, used to keep per-device state apart inside a synced vault. |
| `.nand/` | The vault folder for NAND configuration and runtime JSON, organized by domain and device. |
| Terminal helper | The native `nand-pty` program that owns pseudo-terminals and talks to the plugin over standard input and output. |
| Board | A Markdown note rendered by the home module as sections and widgets. |
| Archive | A person or company entry stored as a folder with a Markdown record in the archives module. |

## Where things live

| Path | Content |
|---|---|
| `src/app/` | Plugin entry, module registry and contracts, settings runtime, commands, workbench composition |
| `src/shell/`, `src/ui/`, `src/theme/` | Workbench UI, design system, global theme |
| `src/host/`, `src/shared/` | Obsidian and desktop adapters; pure utilities, settings store, storage helpers, i18n runtime |
| `src/modules/<id>/` | One folder per module: `manifest.ts`, `api.ts`, `module.ts`, `settings.ts`, `i18n.ts`, `core`, `platform`, `services`, `contrib`, `ui`, `styles` |
| `native/pty-server/` | The Rust terminal helper |
| `scripts/` | Build, budget, architecture, i18n, docs, notice and acceptance scripts |
| `test/` | Shared fixtures, including the user-format golden samples |
| `docs/` | User guides and third-party attribution notes |
| `.agents/skills/` | The development and interface rules |
| `speculo/` | The SpecDev tooling (commands, skills, workflows, `config.json`) |
| `speculo/.speculo/` | SpecDev runtime state; `README.md` there describes its contract |
| `speculo/.speculo/specdev/` | This project's knowledge: `adr/`, `context/`, `.config/`, `status.json`, and the empty `changes/`, `archive/` and `research/` folders |

## Architecture decisions

| ADR | Decision |
|---|---|
| [0001](../adr/0001-module-contract.md) | Zones, module contract, registry, services and contribution points |
| [0002](../adr/0002-lazy-loading-and-budgets.md) | One bundle, lazy module code, startup and size budgets |
| [0003](../adr/0003-namespaced-settings-store.md) | Namespaced settings with vault and device scopes |
| [0004](../adr/0004-data-placement.md) | Markdown for user content, `.nand/` for configuration and runtime state, safe document writes |
| [0005](../adr/0005-three-column-workbench.md) | The three-column workbench and its two view types |
| [0006](../adr/0006-global-theme.md) | The global theme |
| [0007](../adr/0007-interface-language.md) | Interface language and dictionaries |
| [0008](../adr/0008-terminal-helper.md) | The terminal helper and its stdio frame protocol |
| [0009](../adr/0009-agent-sessions-and-history.md) | Agent sessions and vault-scoped native history |
| [0010](../adr/0010-browser-sessions.md) | Browser partitions, permissions and page lifetime |
| [0011](../adr/0011-automation-and-notifications.md) | Device-owned automation runs and independent notification receipts |
| [0012](../adr/0012-git-sync.md) | Git sync with the system git |
| [0013](../adr/0013-license-and-attribution.md) | MIT license and third-party attribution |

## Documentation rules

- The source and reproducible checks outrank prose. When they disagree, fix the document.
- Documents describe what is true now, in the present tense. A claim about a platform, version or account is written as verified only when [validation](../context/validation.md) says so.
- Each document has one owner: user guides describe operation and data; the domain map defines terms and ownership; ADRs explain decisions; the baseline and validation documents state facts and measured results. They do not copy each other.
- Every document is bilingual: the English file is canonical, the Chinese file mirrors it, and each starts with a language switch line.
- `changes/` holds only work in progress and `status.json` lists exactly those directories. `pnpm test:docs` checks links, anchors, the status index and the required documents.
- Third-party licenses and source attributions are kept with the code that uses them (`NOTICE`, `THIRD-PARTY-NOTICES.md`).
