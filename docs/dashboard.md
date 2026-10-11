English | [简体中文](dashboard.ZH.md)

# Dashboard

The dashboard is the **Home** page of the workbench. A board is a Markdown note that holds a banner, sections with cards, and settings for the widgets shown next to them. You can keep several boards; the Home side panel lists them. Habit, expense, pomodoro and reading statistics are the **Records** pages under Home, see [Records](records.md).

The dashboard module is on by default. The module switch is called **Dashboard**; the rail icon is called **Home**.

## Boards

- The Home side panel (column 2) has **New board** and lists your boards under **Boards**. Select a board to open it. The menu of a board row has **Move board up**, **Move board down**, **Rename workspace** and **Remove workspace**. The order survives a restart; removing only takes the board off the list, the note stays in the vault. At least one board must remain. With more than six boards the list gets a search field.
- The first board is the note `dashboard.md` in the vault root. **New board** asks for a name and a layout, then creates and opens its note. Cancelling creates nothing. New boards use sample content in NAND's current language.
- Boards are also called *workspaces*: in the commands **Switch to next workspace** and **Switch to previous workspace**, and in **Settings → Dashboard → Workspaces**, where you can reorder boards by dragging, change a board's path after moving its note, rename and remove.
- Each workbench page and each window remembers which board it shows.

Use **Board layout** on the page, or a layout entry in the board row's menu, to choose **Side layout** (widgets beside sections), **Stacked layout** (widgets above sections), or **Immersive grid** (widgets, sections and standalone cards in one grid). The choice belongs to that board and survives a restart. Opening or resizing an older board does not write a layout into its note; its historical layout setting is used when present, otherwise it opens stacked. Phones display the side arrangement while retaining the saved choice for desktop.

The immersive grid saves positions in 12 columns. Drag a tile's title to move it, or its bottom-right **Resize** handle to set a fixed size. **Fit content** lets its height follow the content within the saved height limit. For keyboard control, focus the title and press Enter or Space to pick up or drop the tile; arrows move it, Shift+arrows resize it, and Escape cancels. Dropping saves the complete move once, including any tile exchanged with it.

Narrow panes show a temporary 6- or 3-column arrangement. Widen the page to edit positions; resizing the pane, fitting content and cancelling a gesture leave the saved geometry intact. An unavailable widget or missing tile keeps its place. Invalid saved values show a notice and a safe display; an explicit layout edit saves the corrected values.

## Banner

The banner at the top of a board shows either **Poster & quotes** (a background image and a quote) or **Statistics** (note counts, activity and a task completion summary of the vault). Edit the banner from its edit button; the command **Toggle banner view (poster & quotes / statistics)** switches the mode. The bookmark button collapses and expands the banner.

A new board makes no network requests for the banner: with no image set, the banner uses the theme's gradient.

Each banner image and each card cover has its own crop position in the editor. Drag the preview, use the arrow keys (Shift moves by 10%), or enter horizontal and vertical percentages. **Center image** resets only that image; Escape cancels a drag, and Cancel discards the form. The preview uses the same cover-position percentages as the board, including when the window changes size. Both banner modes retain the positions of all carousel images. Renaming a vault image or its folder moves its saved position with the reference.

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
| Workflow | Notes in configured stages, with status changes, optional folder moves, checklists, reminders and scoped skills |
| Images, Videos | Media files in your vault, as grid or list, grouped by folder or tag, with tags you can edit |
| Calendar | A month or week calendar of the tasks in your vault |
| Web | A web page shown inside the board |
| Weread | WeRead bookshelf, reading statistics, notes and highlights (needs an API key) |

Task lines in a Todo section can have a reminder: the bell button on a task opens the automation editor with that task as the source (see [Automations and notifications](automation.md)).

Library and Folder file cards expose **Delete** on hover or keyboard focus, and keep it visible on touch screens, including grid, gallery and kanban views. The confirmation defaults to **Cancel**. Confirming uses Obsidian's trash operation and refreshes the count; cancelling or a failed deletion keeps the file and card. Pressing the delete button does not open or drag the card.

The board file is a Markdown note with YAML properties and a Markdown body. NAND updates the fields and regions it manages and keeps unknown YAML, comments and free text. Do not delete a card's `id` line or copy an existing id to create another card.

## Note templates in Library and Folder sections

Open the section's **Configure** button and edit **New-note template**. Add paths or browse existing notes, reorder the list with its arrow buttons, or remove entries. These changes stay in the form until **Save**; **Cancel** leaves the board unchanged.

**New note** creates a blank note when the list is empty, uses a single template directly, and asks you to select one when several are configured. Cancelling the title prompt or template chooser creates nothing. Creation keeps the existing title/date substitutions, prefills supported section filters and chooses a unique file name.

An older `templatePath` is read as a one-item list without rewriting the board. Saving the template configuration records ordered `templatePaths` and mirrors its first item into `templatePath`; an explicit empty list means blank notes. Older NAND versions understand only that first-item mirror, so edit multi-template configurations with a version that supports the list.

## Large grouped lists and kanban boards

Grouped views and kanban initially show up to 50 notes per group. **Show more** adds the next 50 while keeping the notes already on screen. Each group's footer distinguishes the number shown, the number currently available and the full group total.

After filtering and sorting, each section makes its first 500 matching notes available across all groups. When more match, a message asks you to narrow the filters; a search can find notes outside that initial range. Changing the query starts the groups at 50 again. These limits are temporary display state and never remove files or write note properties. Ordinary ungrouped views keep their page-size controls.

## Table columns

In a Library or Folder section's **Table** view, open **Table columns**. Check a field to show it, uncheck to hide it, or use the up/down buttons to reorder it. These controls support the keyboard and save to the current section. They do not change note properties or the badges shown in card views.

Candidates come from all matching notes, including other pages and groups. A field that disappears from the results keeps its saved order and visibility and is marked **Not in current results** in the editor. New fields appear at the end; returning fields reuse their preferences. **Reset table columns** removes only that section's preferences and restores the default derived columns.

## Workflows

Add a **Workflow** section and use **Configure workflow** inside it. Choose a root folder, the status property, and each stage's label and stored value. A stage folder is relative to the root; leaving it empty changes only the status. Excluded folders and the optional archive folder are vault-relative. No folders are preselected. Save applies the configuration; Cancel keeps the previous values. Only notes under the root, outside exclusions and with a matching status appear. Status matching ignores case and surrounding spaces.

Drag a note's title to another stage or use its **Move to stage** selector with the keyboard. NAND reads the current note before updating its status and uses Obsidian's file move operation when a stage has a folder; internal links follow Obsidian's update-links setting. An occupied destination is refused before changing the source. If the status saves but moving fails, the message reports the completed step and current path. **Retry unfinished move** finishes the remaining operation. **Archive note** writes `archived` and moves to your configured archive folder, removing the note from active stages.

Search, property filters, sorting and column widths belong to this section. Save search text with its Save button or Enter; the other controls save on change. A width field also supports the arrow keys. Counts cover all matches; filtering and sorting happen before the 500-note display limit. Each stage first renders up to 50 notes, with **Show 50 more** retaining existing cards. Skills use their actual file scope, including matches beyond the display limit.

Expand a card's checklist to change a task in its latest Markdown text. If that exact task was edited or appears more than once, refresh the card and resolve the ambiguity before retrying. **Due date** edits the note's `due` and `remind` fields. **Remind me on this device** creates a reminder in the existing [Automations and notifications](automation.md) system; keep those modules enabled. Clearing the due date removes that reminder. **New note** uses one of your configured templates, prefills the selected property filters and stage status, and chooses a unique file name. Cancelling the form creates nothing.

The configuration form can add skills for a card or a whole stage, optionally limited to named status values. Its inner skill edits remain a draft until you save the workflow configuration. Stage previews list all currently filtered notes in that column and let you select a subset; an explicitly configured direct-send button uses the full column. Card skills use that note's current path, title, folder, stage and selected card text. Empty columns offer no files. These buttons use the shared [skill delivery and session choices](agent-workbench.md#board-skill-buttons).

## Widgets

News contributes **Featured news**, **Hot news** and saved **News view** widgets when its module is enabled. Use **Create and add** for independent instances and **Configure** for their item count, summaries, stale threshold and saved view. The News settings page also manages these configurations. See [Home news widgets](news.md#home-widgets) for refresh behavior and navigation.

Add **Agent skills** to configure this board's skill buttons. The widget edits its buttons in place and previews their prompt before delivery by default. The sparkle buttons beside fleeting capture and in card headers use the same saved skills with their local text and current note context. See [Board skill buttons](agent-workbench.md#board-skill-buttons) for templates, file scope and session choices.

**Quick Buttons** shares the same widget list and can contain saved automation actions. Turning Automations off disables those actions immediately; turning it back on restores their current availability without changing board membership or layout. Home also respects the system's reduced-motion setting for widget and page transitions.

Widgets sit in a strip below the banner in stacked layout, beside the sections in side layout, or in the immersive grid. **Board widgets** lets you add existing widgets, remove them from this board, and move them up or down. Save applies the list; Cancel leaves the list unchanged. You can also drag widgets to change their order on this board.

For albums, countdowns and anniversaries, **Create and add** opens the configuration editor, including when no instance exists yet. Confirming saves the instance and adds it to the current board; cancelling the editor saves nothing. **Configure** updates an existing instance shared by all its boards. In the immersive grid, a widget's × button or **Remove from board** menu action removes it immediately from the current board. These controls also work with the keyboard, and the × button supports touch.

Widget configuration is shared: removing a countdown, anniversary or album from one board keeps its configuration and its references on other boards. Add it again from the same list. When a provider such as News is disabled, its widgets keep their places and show a settings link; enabling the provider restores them. Older boards use the global widget switches and order until you explicitly save their layout or member list. Simply opening a board does not migrate its file.

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

### Lunar anniversaries

In an anniversary's editor, choose **Solar** or **Lunar**. Lunar input accepts a year, month, day and **Leap month**, and shows the corresponding solar date. Switching calendars keeps the same historical date, including an existing time; the elapsed-time precision also stays unchanged. Invalid or nonexistent dates block Save. Cancel discards the draft.

Annual reminders and the widget use the same rule: a missing leap month becomes the ordinary month with the same number, and a missing day becomes that month's last day. For example, lunar leap 4/2 in 2020 (May 24) becomes ordinary 4/2 in 2021 (May 13); lunar 2/30 in 2023 (March 21) becomes 2/29 in 2025 (March 28). Before Lunar New Year, late-month anniversaries still belong to the preceding lunar year. A conversion failure is shown explicitly. Dates remain stored as solar ISO values; lunar mode changes their annual recurrence.

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

Use a button's icon to choose from Obsidian's full icon list. Common icons appear first in the empty search; fuzzy name search scans the complete list and displays at most 400 suggestions. The picker also works with NAND's Icons module disabled.

## Web shortcuts

In a Sticky Notes section, add a card and choose **Web shortcut**. Enter a name, a URL and **Open in** (dialog or tab). A dialog is the default. The card menu can switch the choice for one visit or open the page in the system browser. See [Browser](browser.md#board-shortcuts).

## Notes and the recently edited list

Clicking a document card opens the note in an editing popover on the board. **Open notes directly in a tab** in the settings, or the command **Toggle: open notes directly in a tab**, opens notes in a tab instead.

Project document rows preserve wiki aliases and heading/block targets, such as `[[Plan.md#Next steps|Roadmap]]`. Tab to the link and press Enter to open that location. The add-document search excludes files already linked under an alias; Tab to a result and press Enter or Space to add it, then continue from the search field. **Remove document link** asks for confirmation and removes only the card's link; the note stays in the vault. Dragging a document row still moves its nested links together.

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

**Saved appearances** stores a named combination of the current global theme and Home decoration, including background focus. Enter a unique name and choose **Save current appearance**. **Apply** restores the theme preset, heading/emphasis styles, both accent colors, reading line height and Home decoration across all boards, editors and popout windows. Names ignore surrounding spaces and letter case when checking duplicates. Deleting a saved appearance removes its snapshot and selection marker while retaining the current look.

Success appears after settings are written. If saving fails, the visible changes remain in the current session and the form shows **Retry saving**, including after reopening it. Retry before restarting to retain those changes. Background focus supports dragging, arrow keys (Shift moves 10%), percentage fields and a center reset; Escape cancels an active drag.

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

On a phone or narrow window, expand **Board widgets** below the banner and select a widget. These buttons follow the current board's saved membership and order, including Agent skills and module contributions. Closing the panel releases that widget's subscriptions and pending work. Unavailable providers show their settings link. The banner also gives access to quick actions and recent documents; web shortcuts open in the system browser on mobile.
