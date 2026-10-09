English | [简体中文](README.ZH.md)

# NAND

A personal workbench for Obsidian: dashboards, comments, coding agents, a built-in browser, contact archives, icons, automations, notifications and Git sync. Everything opens from one three-column workbench, and a global appearance covers the Obsidian interface and Markdown.

NAND is at version 0.0.1-alpha.1, the first public pre-release.

The interface is available in English and Simplified Chinese. A new vault follows Obsidian's interface language; change it later in the workbench under **Settings → General → Language**.

## Install

1. Download `main.js`, `manifest.json` and `styles.css` from the [GitHub release](https://github.com/NAMEWTA/nand/releases).
2. Put them in `.obsidian/plugins/nand/` inside your vault and enable NAND under **Settings → Community plugins**.

NAND needs Obsidian 1.13.0 or later. The terminal, coding agents, the built-in browser and Git sync need the desktop app.

The terminal uses a small native helper, `nand-pty`. It is not part of the three plugin files: NAND downloads the helper for your platform from the release of the same version the first time you open a terminal, checks its SHA-256 digest, and keeps it in the plugin folder.

The ribbon has a single "Open workbench" icon. The rail on the left switches modules, the second column lists the current module's items, and the third column is the page. Settings are behind the gear at the bottom of the rail. See [Workbench](docs/workbench.md).

## Features

The [user guide](docs/README.md) covers every feature, including settings, appearance, recovery and privacy.

| Feature | Guide |
|---|---|
| Workbench | [Three-column layout, pages, focus mode and terminal sessions](docs/workbench.md) |
| Settings and appearance | [Language and module switches](docs/settings.md); [styles, Markdown headings and accent colors](docs/appearance.md) |
| Dashboard and records | [Sections, cards, widgets and quick actions](docs/dashboard.md); [habits, expenses, reading and pomodoro](docs/records.md) |
| Automations | [Manual and scheduled actions, device ownership and notifications](docs/automation.md) |
| Coding agents | [Terminal sessions, native history, usage and context](docs/agent-workbench.md) |
| Browser | [Web pages, site permissions, CLI and material capture](docs/browser.md) |
| Archives | [People, companies, positions, relationships and related material](docs/contacts.md) |
| Comments | [Comments that never rewrite the note](docs/comments.md) |
| Icons | [File and interface icons, colors and rules](docs/icons.md) |
| Git sync | [Commit, pull and push the vault with the system git; resolve conflicts (desktop, off by default)](docs/sync.md) |
| Data and privacy | [Locations, backup and recovery](docs/data.md); [logs, network use and material handed to agents](docs/privacy.md) |

Each module has its own switch in the settings. A module that is off is not loaded at startup. Git sync is off by default.

## Data and sync

Your content is Markdown in visible folders. NAND's configuration and runtime data live in the `.nand/` folder of the vault. `.nand/` starts with a dot, and Obsidian Sync does not sync dot folders. To use several devices, sync the whole vault with Git (for example with the Git sync module), iCloud, Syncthing or similar. [Data and recovery](docs/data.md) lists the folders, sync, backup and restore steps.

## Development

Coding agents and contributors start at [CLAUDE.md](CLAUDE.md), which points to the [development rules](.agents/skills/dev/SKILL.md) and the [interface rules](.agents/skills/ui/SKILL.md). Domain terms, architecture decisions and the current baseline are indexed in the [development documentation](speculo/.speculo/specdev/.config/domain-layout.md).

Use the pnpm version pinned in `package.json`: `pnpm install --frozen-lockfile`, then `pnpm build`, `pnpm lint` and `pnpm test:all`. The build updates `main.js` and `styles.css` in the repository root. The terminal helper is the Rust project in `native/pty-server`; test it with `pnpm check:native`.

Changes by version are in the [changelog](CHANGELOG.md).

## License

NAND is released under the MIT License: see [LICENSE](LICENSE). Third-party attribution:

- [NOTICE](NOTICE) names the works NAND adapts and keeps their license texts: apex-dashboard and obsidian-dashboard (board design), Orca (terminal and browser parts), Iconic (icon rules) and obsidian-git (Git sync). The Orca mapping is in [docs/third-party](docs/third-party/orca-terminal-workbench.md).
- [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) lists the npm packages bundled into the plugin and the Rust crates of the terminal helper.
- Icon, emoji and Unicode data notices are in [src/modules/icons/core/res/NOTICE.txt](src/modules/icons/core/res/NOTICE.txt).

`LICENSE` and `NOTICE` are legal texts and exist only in English, so they have no Chinese companions.
