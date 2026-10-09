English | [简体中文](CHANGELOG.ZH.md)

# Changelog

## 0.0.1-alpha.1

The first public pre-release of NAND. It is a pre-release: expect rough edges, and report problems in the repository's Issues. What each feature does is described in the [user guide](docs/README.md).

### Requirements and install

- Obsidian 1.13.0 or later. The terminal, coding agents, the built-in browser and Git sync need the desktop app; the other modules also run on mobile.
- Install `main.js`, `manifest.json` and `styles.css` from the release into `.obsidian/plugins/nand/`.
- The terminal helper `nand-pty` is a release asset for Linux (x64, arm64), macOS (x64, arm64) and Windows (x64). NAND downloads the one for your platform the first time you open a terminal, checks its SHA-256 digest and keeps it in the plugin folder. Other platforms have no helper.
- The interface is English or Simplified Chinese. A new vault follows Obsidian's language, and the choice can be changed in settings.

### Workbench

- One workbench view with three columns: an icon rail, a side panel for the current module and the page. The ribbon has a single "Open workbench" icon. See [Workbench](docs/workbench.md).
- Clicking the active module icon collapses or expands the panel; switching modules returns to the last place in that module; the panel width can be dragged. Medium windows show the panel as an overlay; narrow windows and phones merge the rail and panel into one drawer. F6 moves focus between the columns.
- "Open in new tab" and "Open in split" show one page in focus mode. Open pages, including browser tabs, are restored with the workspace.
- Notifications and settings sit at the bottom of the rail. A module that is off disappears from the rail; one that failed to start is marked while the others keep working.

### Settings and appearance

- Settings live in the workbench: General (language, status line, module switches), Appearance, one page per module and About. Obsidian's own settings tab keeps only the entry points. See [Settings](docs/settings.md).
- Global appearance covers the Obsidian interface, notes (live preview, source and reading) and NAND's pages: Follow system (the default, which changes nothing), Claude Code and Eye care; heading and bold styles for Markdown, reading line height, light and dark accent colors, and copy, paste and reset. See [Appearance](docs/appearance.md).

### Modules

- Nine modules load on demand: home (dashboard and records), agent (terminal), browser, archives, automations, notifications, icons, comments and sync. Each has a switch, and a module that is off runs no code at startup and leaves no commands, editor extensions or processes behind. Startup code is budgeted at 120 KiB.
- Git sync is off by default; every other module is on.

### Dashboard and records

- Boards are Markdown notes with a banner, sections, cards and widgets. Several boards can be created, renamed and ordered. Cards cover tasks, memos, projects, web shortcuts, weather and trackers; widgets include the calendar with lunar dates, countdowns, anniversaries, year progress, albums and music; library and query sections list notes by folder, tag or property. See [Dashboard](docs/dashboard.md).
- Habits, expenses, reading (with WeRead import) and a pomodoro timer keep their data as Markdown under `NAND/`, with a statistics page for each under the home icon. Saves report saving, saved, unsaved and conflict states, merge independent edits and keep drafts for recovery. See [Records](docs/records.md).

### Coding agents

- A terminal workbench with tabs and splits, built on xterm.js and the native `nand-pty` helper over standard input and output: kitty keyboard protocol and win32-input-mode, input methods, links, search, shell integration marks and flow control. See [Agent workbench](docs/agent-workbench.md).
- Claude Code, Codex, Gemini CLI, OpenCode, Pi and Grok launch from a menu, next to plain shells. Session status comes from each agent's own lifecycle events.
- Native history stays inside the current vault: browse, search, resume with the agent's own resume flags, title, favorite, archive and export to a note. A usage view reads each agent's usage data.
- Sessions survive closing the page and are replayed from the authoritative screen; they end when the module is turned off or Obsidian closes.

### Browser

- Web pages open as tabs in the workbench, with address bar suggestions, find, zoom, screenshots with markup, downloads and a shared login per vault. See [Browser](docs/browser.md).
- Site permissions and recent history are stored per device. Agents can read and operate the same page through a CLI; this is off by default and uses a token that lasts for one run.

### Archives

- People and companies are Markdown folders with a main record, positions, relationships and related material, shown as a list or cards. Full-text search combines space-separated terms with AND. See [Archives](docs/contacts.md).
- Reminders from archive records become automations.

### Comments

- Comments attach to a selection with a text-quote anchor and never rewrite the note. They appear as highlights and a selection popover in live preview, source and reading modes, in a side panel, and in a workbench page that lists every commented note. Anchors follow edits, renames and moves; a comment whose text is gone is marked orphaned instead of guessed. See [Comments](docs/comments.md).

### Icons

- Icons and colors for files, folders, tags, properties, bookmarks and interface entries, with a rule book that applies them in bulk and a picker for icons and emoji. See [Icons](docs/icons.md).

### Automations and notifications

- Seven action types share manual and scheduled runs: script (PowerShell or Bash), Obsidian command, open note, open web page, notify, create a task and run a coding agent. Schedules are manual, once or recurring (cron). Each run belongs to one device and keeps its history. Dashboard quick actions refer to saved actions by id. See [Automations](docs/automation.md).
- Notifications reach an in-app inbox with an unread badge, or the system. Results can notify always, only on failure, or never.

### Git sync

- Commit, pull and push the vault with the system git, by hand or on a timer: changes and history pages, staging and diffs per file, commit and sync in one step, optional squash of unpushed commits before a push, and conflict handling with keep-above, keep-below and keep-both buttons in the editor, continue and abort. Credentials stay with git's credential manager or SSH agent. Desktop only. See [Git sync](docs/sync.md).

### Data

- Your content is Markdown in visible folders; configuration and runtime data are JSON under the vault's `.nand/`, by domain and device. Writes keep the last valid file, merge independent edits and keep recovery drafts. See [Data and recovery](docs/data.md) and [Privacy](docs/privacy.md).
- Obsidian Sync does not sync dot folders, so `.nand/` needs Git, iCloud, Syncthing or similar to reach other devices.
- Diagnostic logs are redacted before they are printed.

### License

- NAND is released under the MIT License. Attribution for adapted works is in `NOTICE`; bundled packages are in `THIRD-PARTY-NOTICES.md`.
