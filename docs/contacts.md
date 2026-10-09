English | [简体中文](contacts.ZH.md)

# Archives

Archives is a page of the workbench (the **Archives** icon in the rail). You view and edit people and companies through cards, lists and detail pages. The data itself is Markdown, so it is easy to back up, read directly and hand to an AI.

## Get started

1. Check under **Settings → General → Modules** that **Archives** is on.
2. Open **Settings → Archives**, choose or type the archive folder and click **Preview and apply**. The confirmation shows the target folder and how many records were found.
3. Click the Archives icon in the rail, or run `NAND: Open archives`. The side panel switches between **People** and **Companies**.
4. On the **People** page click **Add**, fill in a name and contact details and save. Click a card to open its detail page and add positions, relationships and notes.
5. On the **Companies** page create a company and note anything special about it. You can also create a company from the company picker when you add a position.

Adding and editing happen in a form on the Archives page. If you have unsaved changes, Cancel, Esc and switching to another section ask first. An unsaved draft has not been written to Markdown and cannot be restored by restarting. Creating a company from within a position opens a small dialog; that is a separate save, and cancelling the position afterwards does not delete the company.

## Settings

| Setting | Default | Effect |
|---|---|---|
| Archives module switch | On | Under **General → Modules**. Turning it off keeps the files |
| Archive folder | `档案` | A visible folder inside the vault. It may not exist yet and is created when the first record is saved |
| Maximum card columns | 6 | 5 or 6; narrow windows and phones show fewer |

An example path is `Contacts/Archive`. Absolute paths outside the vault, hidden folders and `..` are not accepted. Editing the folder text changes nothing until you use **Preview and apply**. Switching never moves or deletes files in the old folder; switching to an empty folder shows an empty panel, and switching back reads the old data again.

## People and companies

| Data | How to fill it in |
|---|---|
| Name, aliases | A name is required. People with the same name can have separate records; an independent id tells them apart |
| Mobile, phone, WeChat, email | One per line; **Add another** adds a line. You can paste several lines; duplicates are removed. Phone numbers are stored as text, keeping leading zeros and country codes |
| Date of birth, birthplace | A date control; leave empty when unknown |
| Current region, tags | Used for search and filters. A person's current region and a company's region are separate values |
| Employment | Company, department, role, start and end date, current or former, key role and notes |
| Relationships | Link another person, choose the relationship, optionally add a company and notes |
| Personality and preferences, habits, notes | Plain text or Markdown; previewed on the detail page |
| Company data | Name, contact details, website, region, tags and company notes; the people list comes from the employment of people |

### Employment

Add a position under **Employment** on a person's detail page. Dates are `YYYY-MM` or `YYYY-MM-DD`, or empty. The status is the choice you make, *Current* or *Former*: after someone leaves, set *Former*, even if the end date is unknown. A *Current* position cannot have an end date. A person can hold positions at several companies at once.

Set the **Key role** of a current position to *Leader* or *Key contact* and the person appears under **Key people** on the company's detail page. This is a role at the company and is recorded separately from the manager/report relationship between two people.

The company detail page lists current and former personnel. The count means **recorded current contacts**, not the real number of employees; a person with several positions at one company is counted once.

### Relationships

The relationship field reads "**the other person is this person's …**". In Zhang San's record, choose Li Si with the relationship *Manager*: Li Si is Zhang San's manager. Li Si's detail page shows Zhang San as a direct report in return.

*Manager* and *Direct report* are each other's inverse; *Colleague* and *Friend* are shown both ways. You enter a relationship once; the inverse is calculated and nothing is written to the other record. To change a relationship that comes from the other person's record, go back to that record. A custom relationship shows its source and the original label, and NAND does not guess a matching label for the other side.

Working at the same company only creates a link through employment; it does not create friend or colleague relationships. A person who has no record yet must be created first, then linked.

## Search and browse

| Way | Scope |
|---|---|
| Search | Searches this record's `基本信息.md` by default: basic data, contact details, employment, personality, habits, notes, relationship notes and the free text outside the managed regions. Attachments and other notes are not searched |
| Basic fields only | Only the basic data, role and company names of employment |
| People filters | Current company, former company, current region, tags, relationship type |
| Company filters | Region, tags |
| Sort | By name, or recently modified. A match does not change the order |

Several choices in one filter mean *or*; different filters mean *and*. Choosing companies A and B and the region Hangzhou shows people who work at A or B and whose current region is Hangzhou. Words separated by spaces (half-width or full-width) in the search box are combined with *and*: every word must appear somewhere in the record, possibly in different sections, for example one in the notes and one in a position. A word does not span sections. English is case-insensitive and Chinese matches substrings. The record's `nand-id` and the `<!-- nand:row … -->` markers are not searchable text; other ids written in the note are. A match shows the line of the original `基本信息.md` when it can be mapped; otherwise no line number is made up. An email address is only contact data: records with the same email are not merged, and identity is still `nand-id`.

The list and the cards are two views of the same query. A new Archives page lists people and shows companies as cards. After you switch, people and companies each remember their last choice and new pages start from it; each page's own layout wins and survives a reload. The list shows, on a wide pane, name, current position, region, first email and tags for a person, and name, region, website and the count of recorded current contacts for a company; a narrow pane keeps the name and two lines of detail. A match adds a plain-text summary line with its source, for example *Hit: Notes*; for a company the notes read *Hit: Company notes*. With several words, the summary uses the passage that contains the most of them. Clicking it opens that section of the detail page; a match in the free text says roughly at which line it is, and the **Open original note** button opens the note at that line. The detail page does not render the whole free text again.

Card lists, lists and company personnel lists show up to 60 entries per page. Links to companies and people continue inside Archives, and Back restores what you saw in the layout you used. On a phone, Add, filters, sort and delete are in the tab menu. The top of a detail page edits the basic data; the other sections keep their own Add and Edit buttons. **Open original note** is for the moments you need to inspect the underlying file.

## Detail page and related files

The basic data and related material share one page. Employment, relationships, company personnel, personality, habits and notes are collapsed by default; click the title to expand. Forms group fields (identity, contact details and so on); aliases and tags are removable chips; long text starts at three lines. A failed save keeps the draft; conflicts offer copy and reload.

**Related files** lists, recursively, every ordinary file in the archive's folder. The entry `基本信息.md` is reached through the more menu: **Open original note**. A file belongs to a record because of the folder it is in; nothing needs to be linked one by one.

- **New note**: enter a name; NAND creates the Markdown file in the archive folder and opens it in a native tab.
- **Add files**: choose local files to copy into the archive; on desktop you can also drag files onto the list. The source files stay, and a name that exists gets a number instead of being overwritten. Adding several files reports each one and keeps the successful ones.
- You can make subfolders yourself. Added, edited, renamed, moved or deleted files update the list. Search matches names and relative paths only; sort by modified time or name; 60 entries per page.
- A click opens the file with Obsidian: PDFs in the PDF viewer, Markdown in the editor, other formats as far as the host supports them. The more menu can reveal the archive folder.

## Files, backup and disabling

Every person and company has its own folder with the basic data as Markdown. This is the default layout; a folder with the same name as another one gets a short id suffix:

```text
档案/
  个人档案/
    Example Person/
      基本信息.md
      First meeting.md
      resume.pdf
      project-files/proposal.pdf
    Another Contact/基本信息.md
  企业档案/
    Example Tech/基本信息.md
  档案格式说明.md
```

NAND recognizes only the file `基本信息.md` in an entity folder directly under `个人档案` (people) or `企业档案` (companies). The folder names and the file names stay the same in every interface language. A changed display name does not move the folder; if you rename the folder in Obsidian, the record is still recognized by its stable id.

Basic fields are YAML properties, positions and relationships are tables in the body, and personality, habits and notes are body regions. HTML comments mark identity and editing boundaries; the facts remain ordinary Markdown. Reminders you create for a record (see [Automations and notifications](automation.md)) are stored in the same note between `<!-- nand:reminders -->` markers. The full rules are in `档案格式说明.md`, a guide NAND creates in the archive folder, in the current interface language, when it saves the first record and no guide exists yet. An existing guide is never overwritten.

The panel builds an in-memory index from the files. Archive data does not depend on any database or on `data.json` in the plugin folder; the settings keep only the chosen folder and display preferences.

### Backup and moving

1. Finish and save edits in the panel or in the original notes.
2. Copy the whole archive folder, keeping the subfolders. If a body links to images or attachments outside the folder, back those up too.
3. In another vault, put the folder in place and choose it in the settings. The records and their relationships are rebuilt from the files. The folder choice and the panel layout are not part of the backup.

When you move the folder inside the same vault, finish editing first, move it as a whole and choose it again.

Turning the module off or uninstalling NAND keeps the saved Markdown. You can read it with Obsidian, a text editor or an AI; turn NAND on again and choose the folder to get the panel back. That keeps your data independent of the panel, but a disk failure or an accidental deletion still needs an independent backup.

### Deleting and restoring

The delete confirmation shows the name, the folder, the number of files and the number of affected links. After you confirm, the whole entity folder, with all its files, is handled according to Obsidian's deletion setting. Other archives are not deleted along with it. Deletion stops if the folder content changed after you confirmed or if a note in the folder has unsaved edits; check the real scope and try again. Other people's past positions, relationship text and references stay, and a target that cannot be found is shown as a broken link.

To restore, bring back the whole entity folder from your trash or backup with its original `nand-id`. Do not create a new record with the same name instead; a new record has a different identity.

## External edits and problems

Saving an original note refreshes the panel. When the panel saves, it compares the content when the form was opened with the file now: changes to different basic fields or different body regions can be merged; a concurrent change to the same field or the same employment or relationship table is reported as a conflict, never merged line by line.

| Message or symptom | What to do |
|---|---|
| The same field changed elsewhere | The form keeps your draft. **Copy draft** first, then **Reload original record**, check the latest content and edit again. The copy is JSON text to recover your input; it is not a Markdown export and cannot be imported |
| The original note has unsaved edits | Save in the original note first, then come back to the draft |
| The archive folder was switched | Copy any draft you want to keep, then reopen the archive from the current folder; an old form cannot write to the new folder |
| Invalid properties, tables or region markers | Open the original note and fix it against the format guide; the panel refuses to overwrite damaged content |
| Several files use the same id | Check whether you copied a file. To create another person, add it in the panel and do not copy an identity |
| The visible link and the linked identity disagree | Check the link target and the identity comment in the original note; do not change only one of them |
| Some records could not be read | Check that the files are readable, then use **Reload**; other records still show |
| The record was saved but the format guide could not be created | The record is written; check the folder's write permission. Later saves try to create the missing guide again |

A draft exists only in the current form: save or copy it before closing the workbench or restarting. The panel's conflict check does not replace how your sync tool handles cross-device file conflicts.

## Let an AI read it

Give the AI the archive folder and its `档案格式说明.md`; no panel interface is needed. For example: "Read this archive folder and list the recorded current contacts of Xinghe Tech with their roles and source files. Separate current from former and do not infer relationships that are not recorded."

Relative links in the files trace people and companies, and `nand-id` tells records with the same name apart. Whether to send files to an external AI service is your choice; Archives has no automatic AI upload or sync.

## Scope

Included: creating records by hand, editing in the panel, the company view, positions, direct relationships, combined filters and Markdown storage. Not included: CSV or Excel import, syncing a phone address book, a relationship graph, automatic birthday reminders and coordination of cross-device conflicts.
