English | [简体中文](README.ZH.md)

# NAND

A personal workbench for Obsidian: dashboards, comments, coding agents, a built-in browser, contact archives, icons, automations, notifications and Git sync. Everything opens from one three-column workbench, and a global appearance covers the Obsidian interface and Markdown.

NAND is at version 0.0.2-alpha.1, a pre-release.

The interface is available in English and Simplified Chinese. A new vault follows Obsidian's interface language; change it later in the workbench under **Settings → General → Language**.

## Install

1. Download `main.js`, `manifest.json` and `styles.css` from the [GitHub release](https://github.com/NAMEWTA/nand/releases).
2. Put them in `.obsidian/plugins/nand/` inside your vault and enable NAND under **Settings → Community plugins**.

NAND needs Obsidian 1.13.0 or later. The terminal, coding agents, the built-in browser and Git sync need the desktop app.

The terminal uses a small native helper, `nand-pty`. It is not part of the three plugin files: NAND downloads the helper for your platform from the release of the same version the first time you open a terminal, checks its SHA-256 digest, and keeps it in `.nand/helpers/<device-id>/<platform-arch>/<version>/` inside the vault.

The ribbon has a single "Open workbench" icon. The rail on the left switches modules, the second column lists the current module's items, and the third column is the page. Settings are behind the gear at the bottom of the rail. See [Workbench](docs/workbench.md).

## Features

The [user guide](docs/README.md) covers every feature, including settings, appearance, recovery and privacy.

| Feature | Guide |
|---|---|
| Workbench | [Responsive rail and side panel, focus mode, usage and status in the Obsidian status bar](docs/workbench.md) |
| Settings and appearance | [Language and module switches](docs/settings.md); [styles, Markdown headings and accent colors](docs/appearance.md) |
| Dashboard and records | [A free widget canvas on the Apex grid: add, drag, resize and size presets](docs/dashboard.md); [habits, expenses, reading and pomodoro](docs/dashboard.md#统计与账本) |
| Automations | [Templates, scheduled actions, prechecks, run history and notifications](docs/automation.md) |
| Coding agents | [Terminal/browser tab groups, resume, native history, quick commands and usage](docs/agent-workbench.md) |
| Browser | [Profiles, Cookie import, downloads and material capture](docs/browser.md) |
| Archives | [People, companies, positions, relationships and related material](docs/contacts.md) |
| Notes navigator | [Two-pane folder and tag browser with search, shortcuts, calendar and periodic notes, templates, vault profiles, merge and tag tools](docs/navigator.md) |
| Comments | [Line and selection comments, hover threads and an Obsidian sidebar](docs/comments.md) |
| Icons | [File and interface icons, colors and rules](docs/icons.md) |
| Git sync | [Commit, pull and push the vault with the system git; resolve conflicts (desktop, off by default)](docs/sync.md) |
| Data and privacy | [Locations, backup and recovery](docs/data.md); [logs, network use and material handed to agents](docs/privacy.md) |

Each module has its own switch in the settings. A module that is off is not loaded at startup. Git sync is off by default.

## Data and sync

All NAND-managed data lives in the current vault's `.nand/`: managed Markdown and attachments in `.nand/content/`, configuration, device identity, browser sessions and downloads, CLI homes/credentials/hooks and versioned helpers. Use the workbench to browse and edit managed documents. Ordinary notes, host data and Git metadata keep their locations. Obsidian Sync excludes dot folders, including all of `.nand/content/`; use a file sync tool that includes hidden folders. Browser and CLI login state may require authentication again on another device. [Data and recovery](docs/data.md) explains formats, backup and failure recovery. Current maintained guides are in Chinese; this README also has a Chinese version.

The unreleased redesign changes board and comment formats and replaces record Markdown with JSON. Old files are retained without migration; unsupported settings and old leaf layouts fall back to current defaults. The former headline module and browser automation extensions are removed. Back up before upgrading; see [format boundaries](docs/data.md#本次重构的格式边界) and the [changelog](CHANGELOG.md).

## Development

Coding agents and contributors start at [AGENTS.md](AGENTS.md), which points to the [development rules](.agents/skills/dev/SKILL.md) and the [interface rules](.agents/skills/ui/SKILL.md). Domain terms, architecture decisions and the current baseline are indexed in the [development documentation](speculo/.speculo/specdev/.config/domain-layout.md).

Use the pnpm version pinned in `package.json`: `pnpm install --frozen-lockfile`, then `pnpm build`, `pnpm lint` and `pnpm test:all`. The build updates `main.js` and `styles.css` in the repository root. The terminal helper is the Rust project in `native/pty-server`; test it with `pnpm check:native`.

Changes by version are in the [changelog](CHANGELOG.md).

## License

NAND is released under the MIT License: see [LICENSE](LICENSE). Third-party attribution:

- [NOTICE](NOTICE) names the works NAND adapts and keeps their license texts: apex-dashboard and obsidian-dashboard (board design), Orca (workbench, agent, browser and automation UI), Margin Comments (anchors and comment interactions), shadcn/ui (components), Geist fonts, Iconic (icon rules), and obsidian-git (Git sync). The notes navigator reimplements the behavior of Notebook Navigator without including its code; see [its reference scope](docs/third-party/notebook-navigator.md) and the [Orca mapping](docs/third-party/orca-terminal-workbench.md).
- [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) lists the npm packages bundled into the plugin, CSS and font licenses, and the Rust crates of the terminal helper.
- Icon, emoji and Unicode data notices are in [src/modules/icons/core/res/NOTICE.txt](src/modules/icons/core/res/NOTICE.txt).

`LICENSE` and `NOTICE` are legal texts and exist only in English, so they have no Chinese companions.
