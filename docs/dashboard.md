English | [简体中文](dashboard.ZH.md)

# Dashboard

The dashboard is the **Home** page of the workbench. A board is a Markdown note that holds a banner, sections with cards, and settings for the widgets shown next to them. You can keep several boards; the Home side panel lists them. Habit, expense, pomodoro and reading statistics are the **Records** pages under Home, see [Records](records.md).

The dashboard module is on by default. The module switch is called **Dashboard**; the rail icon is called **Home**.

## Boards

- The Home side panel (column 2) has **New board** and lists your boards under **Boards**. Select a board to open it. The menu of a board row has **Rename workspace** and **Remove workspace**; removing only takes the board off the list, the note stays in the vault. At least one board must remain. With more than six boards the list gets a search field.
- The first board is the note `dashboard.md` in the vault root. **New board** asks for a name and creates a note for it. A board note that does not exist yet is created with sample content in NAND's current language.
- Boards are also called *workspaces*: in the commands **Switch to next workspace** and **Switch to previous workspace**, and in **Settings → Dashboard → Workspaces**, where you can reorder boards by dragging, change a board's path after moving its note, rename and remove.
- Each workbench page and each window remembers which board it shows.

## Banner

The banner at the top of a board shows either **Poster & quotes** (a background image and a quote) or **Statistics** (note counts, activity and a task completion summary of the vault). Edit the banner from its edit button; the command **Toggle banner view (poster & quotes / statistics)** switches the mode. The bookmark button collapses and expands the banner.

A new board makes no network requests for the banner: with no image set, the banner uses the theme's gradient.

## Sections and cards

Add a section with the command **Add new section** or the add control on the board. Choose a type, optionally name it (the type name is the default), and save. Double-click a section title to rename it. Drag sections to reorder them and drag cards between sections.

| Type | What it shows |
|---|---|
| Notes | Cards that link to notes and show progress |
| Notes (no cover) | The same without cover images |
| Todo | Checkable task lists with due dates and reminders; completed tasks can be archived |
| Memo | Free-form notes with a color; a memo can be saved as a note |
| Sticky Notes | A mix of memo cards, to-do cards and web shortcut cards |
| Dataview | The result of a query written in the Dataview query language (DQL), as a table or list. NAND evaluates the query with its own engine, so the Dataview plugin is not required |
| Library | Notes selected by folder, tags and properties, shown as grid, gallery, list, table or kanban, with search, filters and sorting |
| Folder | Notes in the folders you pick |
| Images, Videos | Media files in your vault, as grid or list, grouped by folder or tag, with tags you can edit |
| Calendar | A month or week calendar of the tasks in your vault |
| Web | A web page shown inside the board |
| Weread | WeRead bookshelf, reading statistics, notes and highlights (needs an API key) |

Task lines in a Todo section can have a reminder: the bell button on a task opens the automation editor with that task as the source (see [Automations and notifications](automation.md)).

The board file is a Markdown note with YAML properties and a Markdown body. NAND updates the fields and regions it manages and keeps unknown YAML, comments and free text. Do not delete a card's `id` line or copy an existing id to create another card.

## Widgets

Widgets sit in a strip below the banner. Drag a widget in the strip to reorder it. Turn widgets on or off in **Settings → Dashboard**.

| Widget | Default | What it does |
|---|---|---|
| Quick Buttons | On | Buttons for files, Obsidian commands and saved automation actions |
| Lunar Calendar | On | The Chinese lunar date, holidays and a daily almanac |
| Pomodoro timer | On | Focus and break timer with a daily goal and an optional floating mini timer |
| Countdown | Sample on in a new vault | Counts down to dates you set; each can have a reminder |
| Habit Tracker | Sample on in a new vault | A daily check-in list |
| Anniversaries | Sample on in a new vault | Time elapsed since a past date, with an optional yearly reminder |
| Reading Tracker | Off | A reading timer |
| Weather | Off | Forecast for a city you search for |
| Year Progress | Off | How much of the year has passed |
| Calendar | Off | A month or week calendar of vault tasks; click a day to see or add tasks |
| Expense Tracker | Off | Quick entry of expenses and income |
| Photo Album | Off | A slideshow of the images in a vault folder |
| Music Player | Off | NetEase Cloud Music songs; not on phones; sign-in for member tracks is desktop only |

Habit, expense, pomodoro and reading data are stored as Markdown, see [Records](records.md). The pomodoro and reading timers belong to the dashboard module as a whole, so there is one timer even when several boards are open.

## Quick actions

**Quick Buttons** shows buttons that run an action with one click. **Add action** offers three tabs: **File** (open a note), **Command** (run any Obsidian command) and **Saved actions** (an action defined in the Automations page).

To put an automation on a board, create it on the Automations page with the schedule **Shortcut (manual)**, then use **Add to dashboard** and pick the board. The same action can be pinned to several boards. A button points to the definition, so renaming or editing the action updates every button. Removing a button keeps the definition; deleting the definition makes its buttons show as unavailable. While an action runs you can see its status, open its terminal or stop it, when the action supports that.

Buttons work with Tab, Enter and Space, and Alt plus the arrow keys reorders them.

## Common actions

**Common Actions** is an optional bar at the top of the board (on in a new vault). Under **Settings → Dashboard → Common actions → Configure** you can add:

- create buttons that make a note from a template into a folder (file names accept `{{date}}`, `{{time}}` and `{{title}}`)
- pinned notes that open with one click
- quick commands that run any Obsidian command
- a capture box that appends a line to a note, or creates a new note per capture
- a **Today** button that opens or creates today's daily note (it needs Obsidian's core Daily notes plugin)

## Web shortcuts

In a Sticky Notes section, add a card and choose **Web shortcut**. Enter a name, a URL and **Open in** (dialog or tab). A dialog is the default. The card menu can switch the choice for one visit or open the page in the system browser. See [Browser](browser.md#board-shortcuts).

## Notes and the recently edited list

Clicking a document card opens the note in an editing popover on the board. **Open notes directly in a tab** in the settings, or the command **Toggle: open notes directly in a tab**, opens notes in a tab instead.

**Recently Edited** lists recently changed notes; its length is **Recent documents count** (3 to 15, default 5). It leaves out files and folders whose names start with a dot, the managed folders of NAND (`NAND/习惯`, `NAND/番茄钟`, `NAND/记账`, `NAND/阅读`, `NAND/自动化`), the board notes, and the entry notes and format guide of the [archives](contacts.md). Other notes, including other notes under `NAND/`, are not hidden.

## Settings → Dashboard

| Group | What you can set |
|---|---|
| Board appearance | See below |
| Common actions | The bar described above |
| Recent documents count | 3 to 15 |
| Workspaces | The list of boards: order, path, rename, remove |
| Memo | Folder where memo cards are saved as notes (empty: the vault root) and an optional template note |
| Task archive | Archive completed tasks to a fixed file (default `Archive/Done.md`) or to today's daily note |
| Library | Folder where the new-note button of a Library section creates notes |
| Open notes directly in a tab | Skip the editing popover |
| Weread | API key and the folder where highlights are imported as notes (default `Weread/Highlights`, one file per book) |
| Widgets | Switches and options for each widget in the table above |

The default paths are the same in every interface language. Switching language does not move files.

### Board appearance

**Settings → Dashboard → Board appearance → Customize appearance** opens a dialog with a background image (browse the vault; dimming, blur, cover or contain), card opacity, glass blur, corner radius and text size (small, medium, large). Changes apply live to all open boards. Colors are not part of it: boards follow the global colors from [Appearance](appearance.md).

## Saving and conflicts

A board save runs in the background. If someone else edits the note while you edit the board, NAND pauses saving to the original and keeps a recovery copy at `.nand/recovery/dashboard/conflicts/<id>.json`; the status area on the board shows the path. A saved recovery copy does not mean the original was updated. The status area offers **Copy local draft**, **Copy recovery path**, **Retry saving** and **Reload original** (after a confirmation that keeps the recovery copy). The recovery file holds the original, current and external text as JSON; it is not board Markdown and must not be pasted over the board.

If you also have the board note open in an editor with unsaved changes, finish that edit before saving from the board. Do not overwrite the whole note to resolve a conflict. A forced exit or an unwritable disk cannot guarantee that input which never reached the disk is saved.

## Commands

| Command | Result |
|---|---|
| Open dashboard | Opens Home |
| Switch to next workspace, Switch to previous workspace | Cycles through the boards |
| Add new section | Adds a section to the active board |
| Toggle banner view (poster & quotes / statistics) | Switches the banner mode |
| Toggle: open notes directly in a tab | Switches how document cards open |

## Phones

On a phone the board uses its own single-column layout with the widgets that fit a phone: quick actions, recent documents, pomodoro, reading, lunar calendar, calendar, habits and expenses. The Music Player is not available, and web shortcuts open in the system browser.
