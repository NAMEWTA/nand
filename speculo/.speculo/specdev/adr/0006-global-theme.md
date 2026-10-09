English | [简体中文](0006-global-theme.ZH.md)

# ADR-0006: Global theme

Status: accepted. Checked against the code on 2026-10-08.

## Problem

NAND's screens and the user's Markdown notes should look like one product, and NAND's colors should follow Obsidian's light and dark themes. Private palettes inside individual features fight with the Obsidian theme and cannot change how notes look.

## Decision

- **Body classes and variables.** The theme is applied as classes on `body` that override Obsidian's own variables (background, text, accent, headings, bold, links, quotes, code), so the editor, reading view and NAND's interface change together without fighting selectors. The classes are `nand-theme--<preset>`, `nand-md-headings--<style>`, `nand-md-emphasis--<style>`, and `nand-theme-accent-light`, `nand-theme-accent-dark` and `nand-theme-line-height` with the variables `--nand-user-accent-light`, `--nand-user-accent-dark` and `--nand-user-line-height`.
- **Presets.** `system` (the default, which sets no override), `claude-code` and `eye-care`, each with a light and a dark variant. The Appearance page adjusts heading style (`preset`, `accented`, `plain`), emphasis style (`preset`, `accent`, `highlight`, `plain`), the accent color for light and dark (`#rrggbb` or empty to keep the preset's), and the reading line height (0 keeps the preset's). The page also imports and exports these choices.
- **One runtime for every window.** `ThemeRuntime` applies the state to the main window and to every popout window, reapplies it when the `theme` namespace changes, and removes every class and variable on unload.
- **No private palettes.** NAND's interface uses tokens derived from Obsidian's variables (`src/ui/styles/000-foundation.css`). A feature does not define its own palette.

## Consequences

A preset other than `system` can stack with a community theme; the Appearance page says so. The default leaves Obsidian untouched.

## Evidence

[Theme settings](../../../../src/theme/settings.ts), [runtime](../../../../src/theme/runtime.ts), [preset styles](../../../../src/theme/styles/presets.css), [foundation tokens](../../../../src/ui/styles/000-foundation.css). The preset and settings tests (`src/theme/presets.test.ts`, `src/theme/settings.test.ts`) and the screenshot matrix `scripts/obsidian-acceptance/theme-matrix.mjs`.
