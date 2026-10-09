English | [简体中文](workbench.ZH.md)

# Workbench

The ribbon has one NAND icon, **Open workbench**. The command with the same name has the id `open-workbench`. Every page of NAND lives in the workbench. Obsidian's own **Settings → NAND** only holds a short entry point; the full settings are in the workbench (see [Settings](settings.md)).

## Three columns

| Column | Contents |
|---|---|
| 1. Icon rail | One icon per feature. Notifications and Settings sit at the bottom. Click the icon of the current feature to collapse or expand column 2; click another icon to return to where you last were in that feature |
| 2. Side panel | The objects and sections of the current feature: the board list and Records, agent sessions and history, browser pages, archive groups, automation tasks, icon settings sections, settings categories. Panels with many items have a search field |
| 3. Page | The page header shows where you are, status chips and a **Page actions** menu. Browser pages have a tab strip above the page |

Rail icons, top to bottom: Home, AI Agent, Browser, Archives, Automations, Git sync, Icons, Comments; at the bottom: Notifications (with an unread count) and Settings. Home and Settings are always listed. The other icons are hidden while their feature is off or not supported on the device. A feature that failed to start has a warning dot on its icon.

Keyboard: the arrow keys, Home and End move between rail icons. F6 and Shift+F6 move focus between the rail, the side panel and the page.

The side panel is 220 to 360 pixels wide (260 by default). Drag its right edge to resize it; double-click the edge to reset it. With the edge focused, the left and right arrows change the width by 8 pixels, and Home and End jump to the limits.

### Narrow windows

| Container width | Layout |
|---|---|
| 960 px or more | Rail and side panel are shown next to the page |
| 600 to 959 px | The rail stays; the side panel opens over the page |
| Under 600 px, and on phones | Rail and side panel are combined in one drawer that opens from the left of the page header; Escape closes it |

## Pages

| Page | Feature ID | View type |
|---|---|---|
| Workbench | — | `nand-workbench-view` |
| Home (boards) | `dashboard` | — |
| Records (habits, expenses, pomodoro, reading) | `records` | — |
| AI Agent | `terminal` | — |
| Browser | `browser` | — |
| Archives | `contacts` | — |
| Automations | `automations` | — |
| Git sync | `sync` | — |
| Icons | `icons` | — |
| Comments | `comments` | — |
| Notifications | `notifications` | — |
| Settings | `settings` | — |
| Editor panel (right sidebar) | — | `nand-comments-view` |

The workbench and the editor panel are the only two Obsidian views NAND registers. The editor panel shows the threads of the current note, see [Editor and comments](comments.md).

Records is not a separate feature module. It belongs to Home: open it from the Home side panel or with the **Statistics** button on a widget, and the rail keeps Home highlighted. Only the widgets that are turned on list a Records page.

Names differ slightly between the rail, the module switches and the settings pages:

| Rail icon | Module switch | Settings page |
|---|---|---|
| Home | Dashboard | Dashboard |
| AI Agent | Agents | Agents |
| Archives | Archives | Archives |
| Comments | Editor | Editor |
| Icons | Icons | (on the Icons page) |
| Notifications | Notifications | — |

## Focus mode

**Open in a native tab** and **Open in a split** in the **Page actions** menu open a new workbench leaf that shows only that page, without rail or side panel. Its page header has **Open in workbench**, which puts the page back into a full workbench. A browser page opened this way is a new page with the same address, title, zoom and scroll position; the original stays where it was.

Browser pages are limited to 50 open pages. Close one before opening another.

## Bottom status

On desktop, NAND adds an item to Obsidian's status bar. It lists only what needs attention, up to two items plus a **More status items** menu; clicking an item opens the related page.

- automations that are running, and a failed automation load
- notifications with failed or interrupted runs that are still unread
- agent sessions that are working or waiting for input
- Git sync: a running action, conflicts, a failed last run, automatic sync paused after repeated failures, commits that are not pushed
- a board that cannot be saved
- the subscription quota of agents, when **Show quota in the status bar** is on in the Agents settings

**Settings → General → Bottom status** can hide the item. Errors, running work and unread items also appear as chips in the page header (up to three).

## Unavailable pages

A page can show a message instead of its content:

- The feature is turned off. Your data is kept. **Turn on in settings** opens the settings.
- The feature is not supported on this device.
- The feature is not ready yet or failed to start. **Retry** tries again.
- The selected resource no longer exists, for example a deleted board or archive record.

## Restarting Obsidian

The workbench saves its pages, the side panel width and the last position of each feature with the Obsidian workspace. Browser pages return with address, title, zoom and scroll position and load when they are shown.

Terminal sessions do not survive a restart: nothing is started again and no earlier command is replayed. A saved link to a session that no longer exists opens the AI Agent page instead of failing. A link to a board, archive record or browser page that no longer exists does fail with a message.

## Commands

Shell commands are always available:

| Command | Result |
|---|---|
| Open workbench | Opens the workbench in the current window |
| Cycle to next theme | Switches the global style, see [Appearance](appearance.md) |
| Copy relative reference, Copy absolute reference | See [Settings](settings.md#copy-reference-commands) |

The commands of a feature are available while the feature is on. They are listed in each feature's guide.
