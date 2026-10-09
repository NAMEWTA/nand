English | [简体中文](data.ZH.md)

# Data and recovery

Your content is Markdown in visible folders. NAND's own configuration and runtime data live in the `.nand/` folder of the current vault. Nothing in the plugin installation folder is business data, apart from the terminal helper and separate agent logins listed below.

## Where data is stored

| Data | Location |
|---|---|
| Boards | The board notes you choose (the first one is `dashboard.md` in the vault root) |
| People, companies and their files | The archive folder you choose, default `档案/` with `个人档案/` and `企业档案/` inside |
| Independent automation actions | `NAND/自动化/<name>-<short id>/操作.md` |
| Habits, expenses, reading, pomodoro | Domain folders under `NAND/` (`NAND/习惯`, `NAND/记账`, `NAND/阅读`, `NAND/番茄钟`) |
| Global settings | `.nand/config/settings.json` |
| Device settings | `.nand/config/devices/<device-id>.json` |
| Icons and their backups | `.nand/icons/` |
| Comments and anchors | `.nand/editor/comments/` |
| Automation runs, notification receipts | `.nand/automation/<device-id>/`, `.nand/notifications/<device-id>/` |
| Terminal index, history labels, automation sessions | `.nand/terminal-agent/<device-id>/` |
| Browser history and site permissions | `.nand/browser/<device-id>/` |
| Recovery drafts and board conflict copies | `.nand/recovery/` |
| Caches (WeRead progress) | `.nand/cache/` |
| Agent conversations exported as notes | `NAND Exports/` |
| Expense CSV exports | `expense-export-<date>.csv` in the vault root |
| Git sync clock and pause state | `.git/nand-sync.json` inside the repository, never committed |
| Terminal helper | `binaries/` in the plugin folder |
| Separate agent logins (optional) | `accounts/` in the plugin folder |

The folder names `档案`, `个人档案`, `企业档案`, `NAND/自动化`, `NAND/习惯`, `NAND/记账`, `NAND/阅读` and `NAND/番茄钟` are Chinese in every interface language, and file names such as `基本信息.md` and `操作.md` are too. A vault starts from defaults when it has no settings files.

## Outside the vault

- The native logs, history and sign-in of CLI agents belong to those CLIs. NAND reads the history and never copies it into the vault. NAND adds small status hooks to the CLIs' own configuration files, see [Agent workbench](agent-workbench.md#status-hooks).
- Browser cookies stay in Obsidian's Electron session on this computer.
- The browser connection files, and the screenshots and descriptions handed to agents, are in `nand-browser/<vault-id>/` inside Obsidian's application data folder, not in the vault, and are not part of a vault backup. Back them up separately if you want to keep them.
- The device id is in Obsidian's local storage. Copying or syncing a vault does not make two computers the same device, and a copy does not replace device ownership or CLI sign-in. The connection token exists only while NAND runs.

## Several devices and sync

`.nand/` starts with a dot, and **Obsidian Sync does not sync folders that start with a dot**. NAND's settings, comments, icon rules, automation runs and notification receipts therefore do not reach another device through Obsidian Sync, while Markdown content such as boards, archives, records and independent actions does. To keep several devices consistent, use a tool that syncs the whole vault including hidden folders: Git, iCloud, Syncthing or similar. On desktop you can use NAND's own [Git sync](sync.md).

- `.nand/config/settings.json` is shared by all devices of the vault. `.nand/config/devices/<device-id>.json` and the per-module `<device-id>` folders belong to one device and do not overwrite each other after a sync.
- Automations run only on the device they belong to, see [Automations and notifications](automation.md#devices).
- Before writing a JSON file, NAND merges outside changes on disk with its own changes (a three-way merge) and keeps the previous valid content in a `.backup` file. Conflict copies made by a sync tool still need manual handling.

## Everyday backup

1. Finish saving in editors and panels, and check that nothing shows *Not saved* or *Conflicting edits*.
2. Back up your Markdown, related attachments and the whole `.nand/` folder. The backup tool must include hidden folders.
3. Before restoring, turn the affected modules off, keep a copy of the current damaged files and restore the contents and settings you know are valid.
4. Turn the modules on again and check the content and the device settings. Do not replay interrupted external actions just to get things running.

Caches and indexes can be rebuilt. Entity text, business records, comments and notification receipts must not be cleaned up as if they were caches. Browser cookies and CLI accounts and logs need backups in the ways their own hosts provide.

## Save failures and conflicts

A file that cannot be read, a damaged file or a managed region that cannot be parsed blocks writing. Saving a JSON file keeps the previous valid snapshot as `.backup`. If the main file is damaged and a `.backup` exists, NAND loads the backup and keeps the damaged file as `.corrupt`; without a backup NAND reports the error and does not overwrite the file. Icons use their own backup rotation, see [Icons](icons.md#data-backups-and-turning-the-module-off). A disk error is never shown as a successful save.

When an error appears, keep your current input first, then check permissions, sync conflicts and the file content. Panels that support retry offer error details and a retry; recovery drafts are in `.nand/recovery/drafts/`. For archives, copy the draft and then reload the original record; the draft JSON is not importable Markdown.

Changes to different fields or records merge; a change to the same field needs a decision from you. If the original note has unsaved edits, save the editor first; NAND does not bypass that protection to write. A deleted entity file can carry a `nand-deleted` marker: that is a logical delete, not a normal record waiting to be restored.

## Board conflicts

When an outside edit and a board save collide, NAND pauses writing to the original board and keeps a recovery copy at `.nand/recovery/dashboard/conflicts/<id>.json`. The message shows the real file path. *Recovery copy saved* does not mean the change reached the original; further edits update the latest revision of the same conflict.

The status area on the board offers **Copy local draft**, **Copy recovery path**, **Retry saving** and **Reload original**. If the copy fails, the page stays open: copy the draft first, fix the disk or permissions and retry. Reloading needs a confirmation and keeps the recovery copy. The copy is JSON with the original, current and outside text; do not use it as board Markdown to overwrite the board. A forced exit or an unwritable disk cannot guarantee that input that never reached the disk is saved.

## Formats and language

The language setting changes only the interface. It never changes file paths, identities, note text or action parameters.
