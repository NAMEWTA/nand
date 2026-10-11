English | [简体中文](automation.ZH.md)

# Automations and notifications

Automations and notifications are two workbench pages. The **Automations** icon in the rail opens the management page; its side panel has **Tasks** and **Run history**. The **Notifications** bell at the bottom of the rail opens the inbox (a number shows unread items); its side panel switches between **Unread** and **All**. The bottom status shows running automations and items that need attention. When automations are switched off you can still read history and notifications.

## Actions

| Action | What it does | Manual | Scheduled | Needs desktop |
|---|---|---|---|---|
| Reminder | Sends a notification with your text | Yes | Yes | No |
| Create to-do | Adds a to-do to a card of a registered board | Yes | Yes | No |
| Run agent | Starts a coding agent with a prompt in a working directory inside the vault | Yes | Yes | Yes |
| Terminal script | Runs a PowerShell or Bash script in a working directory | Yes | Yes | Yes |
| Obsidian command | Runs an Obsidian command | Yes | No | No |
| Open note | Opens a note | Yes | No | No |
| Open web page | Opens a page in the [browser](browser.md) (or the system browser if the module is off) | Yes | No | No |
| Browser workflow | Runs a verified finite workflow on explicitly selected pages and accounts | Yes | Yes, subject to page and confirmation requirements | Yes |

For an Obsidian command the result means only that the command was invoked. A script's result is its real exit code.

## Create an automation

Creating and editing happen on the Automations page, not in a dialog. Use **New automation** on the page, the command **New automation**, or one of these starting points, which open the page with the source and title filled in. Saving or cancelling returns to the task list.

- **To-do reminder.** The bell button on a task in a board's Todo section opens the editor with that task as the source. The reminder stays attached to the task in the board note; a task that is checked off or deleted is no longer scheduled.
- **Archive reminder.** Choose **New automation** in the menu of an archive record. **Source** in the automation list opens the record.
- **Automatic to-dos.** Choose the action *Create to-do*, pick the target board and card, and enter the text. Run it now or on a schedule.
- **Independent actions.** A new automation on the page, for example *Run agent* or *Terminal script*, with a schedule of **Shortcut (manual)**, **Once**, **Recurring** or **Now**.

On the Tasks list, each automation can be run now, paused or resumed, edited and deleted.

A to-do target must be a card that can show and manage to-dos, including a task card in a mixed section. Memos, ordinary project cards, Library queries and web cards are not valid targets. Renaming a target does not change its identity. If the target is deleted, changes type or is no longer unique, pick a valid card and save again. NAND re-checks the target on disk before it writes. It never redirects to the first card or converts a card, and a run id prevents a repeated confirmation from inserting twice.

To use an action as a board button, save it with the schedule *Shortcut (manual)*, choose **Add to dashboard** and pick the board, see [Dashboard](dashboard.md#quick-actions).

## Schedules and time

- Obsidian must be running. There is no cloud scheduler, no operating system service, no remote run and no worktree creation.
- Choices: **Now**, **Once**, and **Recurring** with the presets *Hourly*, *Daily*, *Weekdays*, *Weekly*, or *Custom* with a five-field Cron expression or an RRULE. RRULE supports `FREQ=HOURLY`, `FREQ=DAILY` and `FREQ=WEEKLY` with `BYHOUR` and `BYMINUTE`, and `BYDAY` for weekly. Any other field is rejected when you save; it is never silently ignored.
- A calendar schedule stores its time zone, by default the time zone of this device. A local time that does not exist because of daylight saving time is skipped, and a repeated hour counts as two different moments. NAND checks the schedule every minute and again when the window gets focus.
- Only the most recent missed time is considered, not every missed run. The default grace is 720 minutes (editable as *Missed-run grace*) plus two minutes of polling tolerance. A run outside the grace, or one that starts while the previous run is still active, is recorded as **Skipped**.
- NAND saves the pending run and the schedule cursor before it performs the action. After a restart, runs that were unfinished are marked **Interrupted** and are not replayed. Each run has an id, so a to-do is not inserted twice.
- Each definition keeps its latest 100 finished runs; active runs are always kept. **Clear completed history** removes finished runs and keeps active runs and delivery receipts.
- Countdown and anniversary reminders are set in the widget's settings and run through the same automation service, with dates decided by the widget. The board does not have to be open.

## Notifications

Choose the channels for each automation. They are per automation, not global defaults.

| Channel | Behavior |
|---|---|
| In-app | Writes to the inbox and shows an Obsidian notice |
| System | A desktop operating system notification; it needs the system's notification permission |

**Notify after execution** is *Success and failure*, *Failure only* or *Never*.

In the inbox you can mark all read, clear read notifications and open the source of a notification. Clearing keeps the delivery receipts that prevent a repeat. Receipts show *Submitted*, *Pending*, *Failed* or *Unverified*: a delivery whose result cannot be confirmed after a restart stays *Unverified* and is never resent. Notifications are deduplicated by run id.

Notifications is its own module. Switch it off under **Settings → General → Modules** and automations keep running; their result is shown as one Obsidian notice and nothing is written to the inbox. Earlier notifications are still there when you turn it back on.

## Run history

| Status | Meaning |
|---|---|
| Pending | Waiting to start |
| Running | The action is running |
| Submitted; completion unverified | The action was started but no completion event is known yet |
| Succeeded, Failed | The result of the action |
| Stopped | You stopped the run |
| Interrupted | Obsidian closed while it was running |
| Skipped | Outside the grace window, or the previous run was still active |

You can filter the list by action and status and by agent. Deleting a definition keeps the runs it produced so you can still read their history; stop an active run first.

## Agent actions

You can choose any enabled agent that is installed, see [Agent workbench](agent-workbench.md). A session can be:

- **New each time**
- **Reuse previous live session**: the previous session if it is still alive and idle; otherwise a new one
- **Choose a session**: pick from the history (searchable) or enter an exact native session ID. Pi also needs the transcript file path. NAND resumes it with the CLI's own resume arguments and never falls back to a new session; if it is unavailable the run fails.

A manual run opens its terminal. For a scheduled run, use **Open** in the run history. In the terminal menu **Hide panel** keeps the process; closing the workbench tab only hides it, and opening it again reconnects to the live process. Ending the session, or **Stop** in the run history, ends the process. Closing the Automations page does not stop scheduling.

Claude Code, Codex, Gemini, Grok, Pi and OpenCode report their lifecycle through native hooks that NAND installs when it starts a session. Existing hooks and settings are preserved and the original file is backed up. See [Agent workbench](agent-workbench.md#status-hooks). For a CLI without a native completion event the run stays *Submitted; completion unverified* until the process exits or you stop it; output going quiet is never taken as success. A CLI that needs a typed prompt must signal that its input is ready, otherwise the run times out and asks you to finish its setup by hand.

Directory trust, login and hook permissions of each CLI are managed by the CLI. Complete them by hand first. If **Approval prompts** is YOLO (the default) and the agent has such flags, launch the agent by hand once so you can acknowledge the permission mode; until then an automation run fails with *Launch this agent manually once to acknowledge its configured permission mode*. Usage is taken from the difference of the native session totals before and after the run; when the baseline or the native record is missing, usage is shown as missing and no cost is estimated.

## Browser workflows

Choose **Browser workflow** as an action, select a verified workflow version, enter its public variables and explicitly bind every page scope. The definition retains that version and those page/account choices. Missing versions or pages are shown as unavailable; another active tab is never substituted. Required secrets must be supplied through a reviewed manual run in Browser workflows, so they cannot be saved in an automation definition.

Manual and scheduled runs use the same automation history, cancellation and **Open workflow result** action. The browser records step checks under that run ID. Scheduling requires Browser and Automations to remain enabled and the selected native pages to be loaded in the required account and scope. A scheduled run does not reveal a page or bypass login or a final submission confirmation; unmet conditions fail or interrupt the run for manual attention.

Turning Browser off revokes its running workflows and makes new triggers unavailable without enabling it again. Turning Automations off cancels its owned workflows. Definitions and historical results remain on disk. Restarting interrupts unfinished runs without replaying page actions. See [Browser workflows](browser.md#reusable-browser-workflows) for verification, pause/resume, secrets and storage.

## Devices

Each definition has an owning device. Only that device runs it. A definition synced from another computer shows *This automation belongs to another device*. The device id lives in Obsidian's local storage, so do not copy local storage to clone an execution device. Restoring files never changes the owning device automatically.

## Module switch

**Settings → General → Modules → Automations** controls the whole feature. It is on by default. Turning it off waits for automations that are starting, stops the agent terminals that automations own and saves their cancelled state, then stops the schedule check and file watching. Independent manual terminals are not affected. Notifications already delivered and file changes already made are not undone.

While it is off, the Automations page says so and board buttons for saved actions are unavailable; the notification inbox keeps working. Definitions, run history and schedule cursors stay on disk. Turning it on again checks pending triggers by the existing device ownership, cursor and grace rules, and does not replay events that were already handled. If saving the switch fails it goes back to its previous value; if stopping runs or saving their state fails, the switch keeps the new value and shows a failure, and you can toggle it again after the cause is fixed.

## Where things are stored

| Data | Location in the vault |
|---|---|
| To-do reminders | The board note, on the task line |
| Archive reminders | The record's `基本信息.md`, in a block between `<!-- nand:reminders -->` markers |
| Countdowns and anniversaries | The dashboard settings |
| Independent action definitions | `NAND/自动化/<name>-<id>/操作.md` |
| Schedule cursors and run history | `.nand/automation/<device-id>/runtime.json` |
| Notifications and delivery receipts | `.nand/notifications/<device-id>/inbox.json` |
| Sessions that automations started | `.nand/terminal-agent/<device-id>/automation-sessions.json` |

Back up the related notes and the whole `.nand` folder (see [Data and recovery](data.md)).

An unreadable action document causes a load failure instead of an empty action list. Repair the indicated Markdown file, then retry loading or re-enable Automations. Saving or removing definitions also stops if the latest documents cannot be read; a temporary write failure can be retried after its cause is fixed.

## Limits

In-app notifications need Obsidian to be running, and system notifications need operating system permission. The real account flows of the six CLI agents and mobile devices have not been fully verified.
