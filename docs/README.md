English | [简体中文](README.ZH.md)

# NAND user guide

NAND is an Obsidian plugin that puts boards, comments, coding agents, a built-in browser, archives, icons, automations, notifications and Git sync into one vault. Everything opens from one three-column workbench. The interface is available in English and Simplified Chinese; a new vault follows Obsidian's interface language.

| I want to… | Guide |
|---|---|
| Install NAND, choose a language, turn features on or off | [Settings](settings.md) |
| Pick a style, heading look and accent color | [Appearance](appearance.md) |
| Find my way around the rail, side panel and pages | [Workbench](workbench.md) |
| Organize cards, to-dos, widgets and quick actions | [Dashboard](dashboard.md) |
| Track habits, expenses, reading and pomodoros | [Records](records.md) |
| Run actions by hand or on a schedule, read notifications | [Automations and notifications](automation.md) |
| Use CLI agents with history, usage and context | [Agent workbench](agent-workbench.md) |
| Browse the web, capture material, grant site permissions | [Browser](browser.md) |
| Keep people and companies as Markdown | [Archives](contacts.md) |
| Comment on notes without changing them | [Editor and comments](comments.md) |
| Set file and interface icons and icon rules | [Icons](icons.md) |
| Commit, pull and push the vault with Git | [Git sync](sync.md) |
| Find my data, sync devices, back up and recover | [Data and recovery](data.md) |
| Know what is stored where and what leaves the computer | [Privacy and data boundaries](privacy.md) |

## Quick start

1. Install the plugin and enable it (see [Settings](settings.md#install-and-platforms)). NAND opens the workbench and shows a short introduction once.
2. Use the NAND icon in the left ribbon, or the command `NAND: Open workbench`, to open the workbench at any time.
3. Switch features with the icons in the left column. Turn features you do not need off in the workbench under **Settings → General → Modules**.

Commands appear in the command palette with the prefix `NAND:`. NAND sets no default hotkeys; assign them in Obsidian under **Settings → Hotkeys**.

## Status

NAND is a pre-release. Checks that run automatically (type check, lint, unit and DOM tests, git sync against real git, the terminal helper on five platforms) and a real-host run on Linux with Obsidian desktop are recorded in [Validation](../speculo/.speculo/specdev/context/validation.md). These areas have not been verified:

- Obsidian 1.13.0 itself. The declared minimum is 1.13.0; real-host testing used a later 1.13.x desktop build on Linux.
- Phones and tablets: no mobile device has run the plugin, and mobile performance, input methods and touch behavior are unmeasured.
- Windows and macOS on a real host: ConPTY, the macOS terminal, Chinese input methods in the terminal, the keyboard modes of agent TUIs and the Git lookup paths. Only build and protocol tests cover them.
- Third-party themes and snippets.
- Real accounts: sign-in, launch, resume and quota of the CLI agents, Git over HTTPS credential managers, SSH agents and real hosting, and the WeRead, music and weather widgets against live services.
- Long-running use: long-lived terminals, many concurrent sessions, and automations over days and across sleep.

## Licenses

NAND is MIT licensed. See [LICENSE](../LICENSE), [NOTICE](../NOTICE) and [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md). The parts of the browser, terminal and automation scheduler adapted from Orca are listed in [Orca sources and adapted parts](third-party/orca-terminal-workbench.md). Developers start at [AGENTS.md](../AGENTS.md).
