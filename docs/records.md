English | [简体中文](records.ZH.md)

# Records: habits, expenses, reading and pomodoros

Records belong to the [Dashboard](dashboard.md). Turn on the widgets you need under **Settings → Dashboard**. The widgets handle day-to-day input; the statistics are pages under **Home → Records**. Open one from the Home side panel, or with the statistics button on the widget. The side panel lists a Records page only for widgets that are turned on.

The pomodoro and reading timers belong to the dashboard module as a whole, so there is one timer even when several boards are open.

## What each page shows

| Page | Input in the widget | Statistics page |
|---|---|---|
| Habits | Add habits and check them off for today; **Backfill yesterday** checks off missed habits for the previous day only | Streak, completion rate of the last 30 days, total check-ins, a 12-week heatmap; rename and delete habits |
| Expenses | Log an expense or income with an amount, category, note and date; future dates are not accepted | Totals, net, daily average, category share, trends, income versus expense and category ranking by week, month, year or history; a ledger of all records |
| Pomodoro | Start focus and break periods for an activity | Pomodoros today, efficiency, interruptions, break adherence, 7-day average, month and year focus time, daily goal gauge, time-of-day distribution, today's timeline, heatmap; filter the trend by activity |
| Reading | Pick a book by searching a title or ISBN, or type its name, then start the timer | Totals, today, books, streak, recent reading and a book list; ending a session records the date, duration and progress as pages or percent, and can mark the book as finished |

Settings for these widgets (durations, daily goal, sounds, currency symbol and so on) are under **Settings → Dashboard**. The daily pomodoro goal is 1 to 16. The currency symbol is shown before amounts.

### Expense ledger

The ledger lists every record with search, filters and sorting, and supports editing, deleting a selection, CSV import and CSV export. Import expects the columns `date,type,category,amount,note` and reports how many rows were imported or skipped. Export writes the current filter to `expense-export-<date>.csv` in the vault root.

Categories come in two levels. Built-in categories cannot be removed. You can add up to 30 custom categories (names of 1 to 12 characters) and up to 10 primary groups. Removing a custom category keeps the data and label of records that used it.

## Where the data is stored

| Domain | Data | Default location |
|---|---|---|
| Habits | Habit definitions and check-ins | `NAND/习惯/` |
| Expenses | Categories, income and expense records | `NAND/记账/` |
| Reading | Books and reading records | `NAND/阅读/` |
| Pomodoro | Activities and focus records | `NAND/番茄钟/` |

The folder names are Chinese in every interface language. Files:

- Habits and books each have a folder named `<name>-<last 8 characters of the id>` with `习惯.md` (habit) or `书籍.md` (book).
- Expense categories are in `分类.md` and pomodoro activities in `活动.md` in the domain folder.
- Records are split by year and date: `记录/<year>/<date>.md`. A row in the table of a daily file has a stable id.

All of them are ordinary Markdown with YAML properties; `nand-type` and the ids identify NAND's data. Editing identifiers or managed tables by hand can make NAND stop recognizing a record. Back up before you do.

Deleting something in NAND marks its file with `nand-deleted: true`; the file is kept and is not deleted automatically. Records are never trimmed because of paging or because automation history is limited.

## Saving

The interface distinguishes **Saving…**, **Saved**, **Not saved** and **Conflicting edits**. When you see *Not saved*, open the error details, check file permissions and sync status, and retry. Rely on a restart to restore your input only after a save has succeeded.

A file that cannot be read or is damaged is never treated as empty and overwritten. When several changes arrive together, NAND compares the state at open time, your edit and the latest file on disk: independent changes are merged, and a conflict on the same record keeps both versions. A deletion is not brought back by a simple union.

Recovery drafts are kept in `.nand/recovery/drafts/`. Back up the whole domain folder, see [Data and recovery](data.md).

## Network use

Searching for a book in the Reading widget sends the text you typed to `book.douban.com`. Nothing else in Records contacts the network. See [Privacy and data boundaries](privacy.md#network).
