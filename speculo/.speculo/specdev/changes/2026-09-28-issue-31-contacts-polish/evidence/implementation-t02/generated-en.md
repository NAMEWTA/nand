# Archive format

Saved Markdown files are the complete source of archive data. Use the Archives panel to view and edit them. The panel, search and contact counts can be rebuilt from these files without NAND's `data.json`. Copy the whole archive folder to take your records with you; copy any linked attachments outside that folder separately. The original files can also be given to an AI to read. Unsaved form drafts are not in these files.

Each person or company has one Markdown file. `nand-type` is `person` or `company`; `nand-id` is an immutable UUID. Names are not identifiers: people with the same name must remain separate records. The panel recognizes records with these type properties only within the selected folder and its subfolders. Ordinary Markdown notes do not become contacts automatically. Keep the ID when restoring a record; generate a new ID for a different person instead of copying their identity.

The panel creates records in the `联系人/` (people) and `企业/` (companies) subfolders. The guide filename is `档案格式说明.md`. These path names remain the same in either interface language.

## Properties

Place properties in YAML frontmatter at the beginning of the file, between two `---` lines. Missing optional fields are treated as empty; unknown properties are preserved. Do not translate the machine field names below.

| Property | Type | Meaning |
| --- | --- | --- |
| `nand-type` | String | `person` or `company` |
| `nand-id` | String | Stable, unique record identity; the panel generates a UUID |
| `name` | String | Required person or company name |
| `birthday` | String | Birth date, `YYYY-MM-DD`, or empty |
| `birthplace` | String | Place of birth |
| `region` | String | The person's current region or the company's region; these are separate values |
| `website` | String | Company website |
| `aliases` | List of strings | Other names |
| `mobiles`, `phones` | Lists of strings | Mobile and landline numbers |
| `wechat`, `emails` | Lists of strings | WeChat IDs and email addresses |
| `tags` | List of strings | Tags |

Person records do not generate a company website field. Company records do not generate birthdays or personal contact fields. Unknown properties are still preserved. Changing the display name does not rename the file, including when renaming a company. To change the filename, rename it separately in Obsidian and retain `nand-id`.

Write telephone numbers as strings, for example `phones: ["057100000000"]`, to preserve leading zeros and `+`. YAML arrays are recommended for lists; a single text value can also be read as one item. Quote birthdays, for example `birthday: "1990-05-20"`.

## Employment

Place the employment table between `<!-- nand:employments -->` and `<!-- /nand:employments -->`. This example uses English headings:

| Companies | Department | Role | Start date | End date | Employment status | Key role | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [Company](../企业/Company.md) | Department | Engineer | 2020-01 | | current | leader | Employment notes |

`status` is `current` or `past`, independent of missing dates. Dates accept `YYYY-MM` or `YYYY-MM-DD`. Concurrent jobs are allowed. A current job must have an empty `end`; a past job may have unknown start and end dates. `key_role` is empty, `leader`, or `contact`. Key people come from the `key_role` values of current jobs.

A company's employee count means recorded current contacts, deduplicated by person UUID, not its total workforce. Company people lists are calculated from person records; there is no second roster to maintain in the company file.

## Relationships

Place the relationship table between `<!-- nand:relations -->` and `<!-- /nand:relations -->`:

| People | This person’s… | Companies | Notes |
| --- | --- | --- | --- |
| [Alex](Alex.md) | leader | [Company](../企业/Company.md) | Direct manager |

The linked person is the note owner's `kind`: `leader` (manager), `report` (direct report), `colleague`, `friend`, or a custom label. If this table is in Morgan's record, the example means “Alex is Morgan's manager.” Alex's panel shows Morgan as a direct report. The inverse is calculated, not written to a second file. A shared employer does not establish a direct relationship.

`company` can be empty. Custom relationships retain the original label and source; the panel does not guess their inverse meaning.

## Headings, links and row identity

Use one complete heading row from the following three forms, with the same column order. Do not mix languages within a heading row. Both interface languages can read all three forms. When a changed table is saved, it uses the current interface language. These are the exact supported heading texts, not extra tables to add to a record.

Employment:

```text
| company | department | title | start | end | status | key_role | notes |
| Companies | Department | Role | Start date | End date | Employment status | Key role | Notes |
| 企业 | 部门 | 职务 | 开始时间 | 结束时间 | 任职状态 | 关键角色 | 备注 |
```

Relationships:

```text
| person | kind | company | notes |
| People | This person’s… | Companies | Notes |
| 联系人 | 对方是此人的… | 企业 | 备注 |
```

`<!-- nand:row UUID -->` identifies a row. `<!-- nand:ref UUID -->` identifies a link target even after a rename. Replace `UUID` with the actual corresponding identifier and keep existing identifiers when possible. Readable links and table contents carry the facts; comments carry identity only. New manual rows can omit identifiers if their links resolve. Unknown or broken targets remain in the file.

Use standard Markdown links relative to the current file, not `[[wikilinks]]`. URL-encode spaces and special characters in paths. Put the row marker in the first column and the target marker immediately after its link. Do not combine one object's visible link with another object's ID: conflicting destinations prevent the panel from saving.

In table cells, use `&#124;` for a literal pipe, `&#92;` for a backslash, and `<br>` for a line break.

## Prose

Text between the following markers is ordinary Markdown. Do not translate, duplicate or nest the markers. Text outside these regions and unknown properties are preserved.

| Content | Opening marker | Closing marker |
| --- | --- | --- |
| Personality and preferences | `<!-- nand:traits -->` | `<!-- /nand:traits -->` |
| Habits | `<!-- nand:habits -->` | `<!-- /nand:habits -->` |
| Notes or company notes | `<!-- nand:notes -->` | `<!-- /nand:notes -->` |

## Usage and recovery

The panel writes changes when you explicitly save. External edits to different basic fields or prose regions can be merged. Concurrent edits to the same field or employment/relationship table report a conflict and retain the form draft. Table conflicts are handled for the whole table, not merged row by row. Copy the draft before reloading the original record if needed. The copied JSON preserves your input; it is not a Markdown export.

Changing the configured folder switches the data source; it does not move or delete the old folder. Deletion follows Obsidian's file deletion settings and keeps references in other records. Disabling or uninstalling NAND does not remove saved archive files. Keep an independent backup for disk failure or accidental deletion.

This guide is generated in the current NAND language when a record is created and the folder has no guide yet. Language changes and upgrades never overwrite an existing guide or automatically rewrite existing records.
