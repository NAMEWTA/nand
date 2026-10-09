English | [简体中文](settings.ZH.md)

# Settings

NAND settings live in the workbench: click the gear at the bottom of the left icon rail. The second column lists the categories and the third column shows the selected page. Changes are saved as you make them.

| Category | Contents |
|---|---|
| General | Language, bottom status, module switches, and help for the copy-reference commands |
| Appearance | Global style, Markdown heading and bold looks, reading line height, accent colors, copy/paste/reset (see [Appearance](appearance.md)) |
| Dashboard, Browser, Editor, Agents, Archives, Automations, Git sync | Settings of each feature; a page is listed only while its feature is on |
| About | A short description of NAND and a link to the author's GitHub profile |

Icon settings are on the Icons page of the rail, not in the settings categories. Notifications and Records have no settings page of their own.

Obsidian's own **Settings → NAND** is a short entry point: a button that opens the workbench settings, the language, the bottom status, the style and the module switches. Everything else is in the workbench.

## Language

**Language** offers **简体中文** and **English**. A new vault uses Chinese when Obsidian's interface language is Chinese and English otherwise. The choice applies at once and is kept across restarts. If saving fails, the previous choice stays and NAND shows a notice.

The language changes NAND's titles, menus, buttons, notices and accessible names, and the language of sample content created from then on (a new board, a new archive format guide). It does not translate your notes, scripts, prompts, web pages, CLI output, icon names and search keywords, or the Chinese fortune sticks. It never renames or moves files and folders, and it does not re-run actions or restart running terminals.

## Bottom status

**Bottom status** has two values: *Show when needed* (default) and *Hide*. On desktop, NAND adds an item to Obsidian's status bar that shows only running work and items that need attention. See [Workbench](workbench.md#bottom-status).

## Modules

Each feature is a module with its own switch under **General → Modules**.

| Switch | Feature | Default | Platforms |
|---|---|---|---|
| Browser | Web pages in the workbench, web shortcuts, browser tools for agents | On | Desktop; on phones, pages open in the system browser |
| Dashboard | Boards, widgets, to-dos and [Records](records.md) | On | Desktop and mobile |
| Editor | [Comments](comments.md) on Markdown notes | On | Desktop and mobile |
| Archives | People and companies ([Archives](contacts.md)) | On | Desktop and mobile |
| Agents | Terminal sessions and coding agents ([Agent workbench](agent-workbench.md)) | On | Desktop only |
| Icons | File, folder and interface icons ([Icons](icons.md)) | On | Desktop and mobile |
| Notifications | Inbox for automation results and reminders | On | Desktop and mobile |
| Automations | Manual and scheduled actions | On | Desktop and mobile; agents and scripts need desktop |
| Git sync | Commit, pull and push with the system Git ([Git sync](sync.md)) | Off | Desktop only |

A switch decides whether a feature runs at all. It is not the same as closing a tab.

- A feature that is off is not loaded at startup, and its rail icon, settings page and commands are hidden.
- Turning a feature off stops what it owns and keeps your data: Dashboard stops its services, Agents ends its terminal processes, Browser closes its pages and local connection, Automations stops its runs, Git sync stops its timers and ends running Git processes.
- If the workbench is on the page of a feature that is off, the page says the feature is turned off and offers **Turn on in settings**. It does not jump to another page.
- If one feature fails to start, only that feature is marked as failed (a warning dot on its rail icon). The others keep working.

## Copy-reference commands

Two commands are available whatever modules are on, and they never change your notes. Find them in the command palette or bind them in Obsidian's hotkeys.

| Command | Result |
|---|---|
| Copy relative reference | Copies a reference relative to the vault for the current note or the files selected in the file explorer, with the selected lines when available |
| Copy absolute reference | Copies a reference with the full file system path when available, for external tools |

## Install and platforms

1. Download `main.js`, `manifest.json` and `styles.css` from the GitHub release of the version you want.
2. Put the three files in `.obsidian/plugins/nand/` inside the vault and enable NAND under **Settings → Community plugins**.
3. NAND requires Obsidian 1.13.0 or newer. The first time you enable it, NAND opens the workbench and shows a short introduction once.

CLI agents, the terminal helper and the built-in browser need the desktop app. Phones keep the dashboard, archives, comments, icons, automations and notifications; desktop-only entries are hidden. The terminal helper is downloaded the first time you use a terminal (see [Agent workbench](agent-workbench.md#terminal-helper)).

## Where settings are stored

| File | Contents |
|---|---|
| `.nand/config/settings.json` | Settings shared by every device of the vault: language, module switches, appearance, dashboard, browser, comments, archives, Git sync behavior |
| `.nand/config/devices/<device-id>.json` | Settings of one device: Agents settings, and the Git program and repository folder of Git sync |

A vault with no settings files starts from defaults. The device id is kept in Obsidian's local storage, not in the vault, so copying a vault does not make two computers the same device.

Obsidian Sync does not sync folders that start with a dot, so `.nand/` is not synced by it. To keep several devices consistent, sync the whole vault with Git, iCloud, Syncthing or a similar tool. See [Data and recovery](data.md#several-devices-and-sync) for backup steps.
