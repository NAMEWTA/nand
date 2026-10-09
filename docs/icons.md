English | [简体中文](icons.ZH.md)

# Icons

The icons module sets icons and colors for files, folders, tabs, bookmarks, tags, properties and some interface entries, and applies them in bulk with rules. It is on by default and needs Obsidian 1.13.0 or newer. The icon settings are on the **Icons** page of the workbench rail.

## Get started

1. Check under **Settings → General → Modules** that **Icons** is on.
2. Open a note and run `NAND: Change icon of the current file` in the command palette.
3. Search for an icon in the picker, for example `star` or `folder`, and click a result to apply it and close the picker. The buttons at the bottom switch between icon and emoji search.
4. To change the color, use the color control next to the search field. If you change only the color, click **Save**.

You can also change an icon from the context menu of supported items (**Change icon…**, **Remove icon**, **Reset color**). On desktop, clicking an icon opens the picker by default; the **Clickable icons** setting changes that.

Interface text follows NAND's language setting. Icon names and search keywords come from upstream English resources, so searching in English is usually more direct.

## Bulk icons with rules

Open the rulebook with **Rulebook → Manage** on the Icons page, or run `NAND: Open rulebook`. File rules and folder rules are managed separately.

For example, to give every Markdown file the same icon:

1. In file rules, add a rule and give it a recognizable name.
2. Add a condition: *Extension* *is* `md`.
3. Choose an icon and color, enable the rule and save.

Conditions can use the name, filename, extension, folder path, path, headings, links, embeds, tags, properties, created and modified time, and the system clock. With several conditions you choose whether *All*, *Any* or *None* must match. When several enabled rules match the same item, the first matching rule in the list order wins; you can move rules (to top, to bottom, or by dragging).

If an icon looks different from what you chose by hand, look in the rulebook for a matching rule. The picker points out rules that affect the current item. Rules are stored with the icon data, never in the note body.

## Settings

The side panel of the Icons page lists six sections. The table shows each setting with its default; the two manage buttons are **Rulebook** and **View unused icons**.

| Section | Setting | Default |
|---|---|---|
| General | Bigger icons | Mobile only |
| General | Clickable icons (tappable on mobile) | Desktop only |
| Sidebars & tabs | Show all file icons | Off |
| Sidebars & tabs | Show all folder icons | Off |
| Sidebars & tabs | Minimal folder icons | On |
| Sidebars & tabs | Show Markdown tab icons | On |
| Editor | Show title icons | On |
| Editor | Show tag pill icons | Off |
| Menus & dialogs | Show menu actions | On |
| Menus & dialogs | Show suggestion icons | Off |
| Menus & dialogs | Show quick switcher icons | On |
| Menus & dialogs | Show “Move file” icons | On |
| Icon picker | Show item name | Desktop only |
| Icon picker | Use search keywords | On |
| Icon picker | Maximum search results | 100 (slider from 50 to 500) |
| Icon picker | Main color picker | List of colors |
| Icon picker | Second color picker | RGB picker |
| Advanced | Colorless hover | Off |
| Advanced | Colorless drag | Off |
| Advanced | Colorless selection | Off |
| Advanced | Colorless ribbon button | Off |
| Advanced | Maximum automatic backups | 2 (None, or 1 to 9) |

Settings with a platform choice take *On*, *Desktop only*, *Mobile only* or *Off*. *Show all file icons* and *Show all folder icons* decide whether items without a custom icon also get one; switching them off does not turn the icons module off.

Commands toggle most of these settings: Toggle bigger icons, Toggle clickable icons, Toggle all file icons, Toggle all folder icons, Toggle minimal folder icons, Toggle Markdown tab icons, Toggle title icons, Toggle tag pill icons, Toggle menu actions, Toggle suggestion icons, Toggle quick switcher icons and Toggle “Move file” dialog icons.

## Data, backups and turning the module off

The icon data is stored in the vault at `.nand/icons/iconic.json`, and its backups are in the same folder.

| File | Contents |
|---|---|
| `.nand/config/settings.json` | NAND's main settings; for icons it holds only the module switch |
| `iconic.json` | Icons and colors, file and folder rules, icon preferences, picker state |
| `iconic.json.backup1`, `.backup2` and so on | Automatic backups of the icon data; a lower number is newer |

Saving coalesces changes made within about 300 ms. Automatic backups keep 2 copies by default (0 to 9 allowed); a backup rotates in when the last one is at least 3 hours old when you save. This is not a history version for every change.

If the main file is missing, cannot be parsed or is an empty object and a first backup exists, NAND restores `.backup1` and shows a notice. It uses `.backup1` only and does not look for later backups. To restore by hand, turn the icons module off, save copies of the current main file and the backups, copy the backup you trust over `iconic.json`, and turn the module on again.

Turning the module off removes the icon changes from the interface (including editor and Reading view), closes its dialogs and removes its commands from the palette; the saved data stays. The icon search keywords and emoji data load the first time you open the picker (rules that match by icon name load them in the background after the module turns on). While the module is on, outside changes to `iconic.json` are picked up through file watching and window focus checks.

## Troubleshooting

| Symptom | What to check |
|---|---|
| No Icons entry in the rail | Turn Icons on under **Settings → General → Modules**; a feature that is off shows no entry |
| The command “Change icon of the current file” is missing | Make sure the module is on and a file is open |
| An icon cannot be found by a Chinese description | Try the English name or keyword and check the icon/emoji search mode |
| A new icon is overridden | Look at the rulebook, the matching conditions and the rule order |
| An icon remains after you removed the custom icon | Check matching rules and the *Show all file/folder icons* settings |
| The standalone Iconic plugin is also installed | Disable it while you use NAND's icons so both do not change the same interface; NAND does not import its data |

Real-host runs cover Obsidian desktop on Linux only, see [Validation](../speculo/.speculo/specdev/context/validation.md); the declared minimum version is not the same as a completed run on that version.
