English | [简体中文](comments.ZH.md)

# Editor and comments

Comments let you discuss a passage of a Markdown note without changing the note. The comment text is never inserted into or written to the note. The feature is the **Editor** module, which is on by default (**Settings → General → Modules → Editor**).

## Add and read comments

1. Select text in a Markdown note in the editor (Live Preview or Source mode).
2. Click **Comment** in the popover above the selection, or run the command `NAND: Comment on selection`. The command works even if the popover is turned off.
3. Write the comment. **Ctrl/Cmd+Enter** submits and Enter starts a new line.

You cannot comment inside frontmatter or code blocks. Commented text is highlighted in Source mode, Live Preview and Reading view; clicking a highlight selects its thread.

The **editor panel** in the right sidebar shows the threads of the current note. Open it with the command `NAND: Open editor panel`. In a thread you can reply, resolve and reopen, delete, and jump to the quoted text. A thread can also be opened from the **Comments** page of the workbench: its side panel lists every note that has comments, switchable between **Unresolved** and **All**, with the number of open and total threads next to each note. Select a note to see and handle its threads, or choose **Open note**.

## Anchors and detached comments

A comment is tied to the file, the selection and the quoted text with some text around it. After you edit, rename or move the note, NAND keeps the anchor up to date when it can. When it cannot confirm the position, the thread is marked **Detached**; a detached thread is never treated as a reliable location and does not reopen by itself. Select new text and choose **Attach again** to bind it to a new passage.

## Turning it off

Closing the editor panel only hides the panel. Turning the Editor module off removes the highlights, the selection popover, the Reading view marks and the related commands, and finishes the saves it already accepted. Saved comments are kept and appear again when you turn the module on. Finish unsubmitted input before turning it off.

## Settings

**Settings → Editor** has two switches, both on by default:

| Setting | Effect |
|---|---|
| Show comment highlights | Highlights stay on after the editor panel is closed |
| Selection comment button | Shows the **Comment** popover above a selection; the command still works if it is off |

## Storage and recovery

Comments, the thread index and the recovery journal are sidecar JSON files in `.nand/editor/comments/` (`index.json`, `pending.json` and `files/<hash>.json`). Back up this folder together with your notes: copying only the notes does not take the comments with them. Because `.nand/` starts with a dot, Obsidian Sync does not sync comments; use Git, iCloud, Syncthing or a similar tool for the whole vault (see [Data and recovery](data.md)).

If saving fails, check that the note and the sidecar folder are readable and writable. Do not delete anchor or journal files to force a repair: copy the input you want to keep, make a backup, then look at the error and the last valid snapshot. Anchor recovery does not replace a file backup.
