English | [简体中文](appearance.ZH.md)

# Appearance

Appearance is set in the workbench under **Settings → Appearance**. It applies to the Obsidian interface, to notes (Live Preview, Source mode and Reading view) and to NAND's own pages, in the main window and in pop-out windows. Changes take effect at once and are stored in `.nand/config/settings.json`. The **Style** choice is also in Obsidian's **Settings → NAND**.

## Style

| Style | Effect |
|---|---|
| Follow system (default) | Changes nothing. Your Obsidian theme or community theme is used as it is |
| Claude Code | Ivory background in light mode and charcoal in dark mode, terracotta accent, serif headings. Headings and bold use the accented look |
| Eye care | Soft green background in light mode and dark green-gray in dark mode, lower contrast peak, taller line height (1.75). Headings use the accented look and bold uses the highlighter look |

Claude Code and Eye care each have a light and a dark palette and follow Obsidian's light/dark mode. Body text keeps a contrast ratio of at least 7:1 against its background; secondary text and accent-colored text keep at least 4.5:1.

The command `NAND: Cycle to next theme` switches through the three styles in order.

## Markdown looks

| Setting | Options |
|---|---|
| Headings | Use the style default; Accented (a rule under H1, an accent bar beside H2, an accent tint for H3, smaller sizes for H4 to H6); Plain (the theme's own headings) |
| Bold text | Use the style default; Accent color; Highlighter; Plain (bold only) |
| Reading line height | 0 keeps the style default; up to 2.2 |

These settings change how notes are shown. They never modify the notes.

## Accent colors

**Accent in light mode** and **Accent in dark mode** replace the accent used for buttons, links and selection. Colors are `#rrggbb` values. When none is set, the field shows the style's accent; **Use the style accent** resets it.

## Copy, paste and reset

- **Copy settings** puts the appearance settings on the clipboard as JSON, to paste into another vault.
- **Paste settings** applies appearance settings copied from NAND. If the clipboard holds something else, nothing changes and NAND shows a notice.
- **Reset appearance** returns to Follow system with the default Markdown looks.

## Community themes

With a community theme, keep Follow system. The other styles override the theme's background, text, accent and heading variables, so the two can clash. Turning NAND off or uninstalling it removes all appearance changes it made.

Boards have no color scheme of their own: cards, widgets and the banner use the global colors. The board's background image, glass blur, corner radius, card opacity and text size are set separately under **Settings → Dashboard → Board appearance** (see [Dashboard](dashboard.md#board-appearance)).
