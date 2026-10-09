English | [简体中文](theme.ZH.md)

# Global theme

Code: `src/theme/settings.ts` (the `theme` settings namespace, presets, resolution to body classes and variables), `src/theme/runtime.ts` (applies them to the main window and every popout, removes them on unload), `src/theme/styles/presets.css`, `src/theme/styles/markdown.css`, `src/app/settings/appearance.ts` (Settings → Appearance), tests in `src/theme/*.test.ts`.

## How it works

The theme overrides Obsidian's own **variables** on `body`, never Obsidian's selectors. One class per choice:

| Class | From |
|---|---|
| `nand-theme--<preset>` | the preset (`claude-code`, `eye-care`; none for `system`) |
| `nand-md-headings--accented` | heading style (preset default or user choice) |
| `nand-md-emphasis--accent` / `--highlight` | bold style |
| `nand-theme-accent-light` / `-dark` + `--nand-user-accent-light/-dark` | a custom accent per mode |
| `nand-theme-line-height` + `--nand-user-line-height` | a custom reading line height |

Preset rules are written as `body.nand-theme--<id>.theme-light` and `.theme-dark` and set `--background-*`, `--text-*`, `--interactive-accent*`, `--h1…h6-*`, `--bold-*`, `--italic-color`, `--link-*`, `--blockquote-*`, `--code-*`, `--hr-*` and fonts. Because the editor (live preview and source), reading view and NAND's own UI all read those variables, one change reaches all three. Markdown decorations that have no variable (the H1 rule, the H2 bar) are a few rules under `.markdown-rendered` and `.markdown-source-view .HyperMD-header-N` in `markdown.css`.

## Presets

| Id | Look |
|---|---|
| `system` (default) | no classes, no overrides: Obsidian or the community theme decides everything |
| `claude-code` | ivory / charcoal backgrounds, terracotta accent, serif headings; accented headings, accent bold |
| `eye-care` | pale green / deep green-grey backgrounds, softer contrast, taller line height; accented headings, highlighted bold |

`src/theme/presets.test.ts` checks contrast for each preset in both modes: normal text 7:1, muted text 4.5:1, faint text 3:1, links and accent text 4.5:1, and text on the accent color 4.5:1. The command "cycle theme preset" (`cycle-theme`) moves through the presets.

## Adding a preset

1. Add the id to `THEME_PRESETS` and its heading and bold defaults to `PRESET_STYLES` (`src/theme/settings.ts`).
2. Add `body.nand-theme--<id>.theme-light` and `.theme-dark` blocks to `presets.css`, setting variables only. Colors live here and nowhere else.
3. Add the label key `appearance.preset.<id>` (startup dictionary `src/shared/i18n/appearance.ts`, both languages).
4. Extend `presets.test.ts` with the new palette and run `pnpm test`.
5. Take screenshots with `scripts/obsidian-acceptance/theme-matrix.mjs` (reading, live preview, source; light and dark).

## Appearance settings

Settings → Appearance (also the preset row in Obsidian's settings tab): preset, heading style, bold style, reading line height, light/dark accent with reset, and copy / paste / reset of the whole appearance as JSON. Values are normalized by the schema (`#rrggbb` accents, line height 0–2.2 where 0 keeps the preset).

## Coexistence

- With "follow system" NAND changes nothing, so community themes are untouched.
- Other presets override the theme's variables; the appearance page suggests keeping "follow system" with a community theme.
- Module UI must look right with every preset and with the board unmounted; the `--db-*` variables belong to the board.
- Body classes and variables are removed on unload, in every window.
