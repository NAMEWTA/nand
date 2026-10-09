---
name: ui
description: >-
  How NAND draws its interface: the three-column workbench (icon rail, side
  panel, page), workbench pages and panels, dialogs, the design system
  (tokens, primitives, patterns), the global theme and Markdown styles, and
  motion and accessibility rules. Use when adding or changing a page, panel,
  settings page, dialog, component or CSS in this repository, or when the
  user mentions 工作台, 三栏, 图标轨, 侧栏, 页面, 界面, 样式, 主题, 外观, 动画,
  组件, Preact, workbench, rail, panel, theme or design system. Module
  wiring, settings storage and builds are the dev skill.
license: MIT
metadata:
  short-description: Workbench UI, design system and theme
---

English | [简体中文](SKILL.ZH.md)

# Workbench UI

This skill is for this repository only. The `dev` skill owns zones, module wiring, settings storage, strings and builds; this skill owns how things look and behave on screen.

## Read before editing

| Before you… | Open |
|---|---|
| Add a page, change the rail, side panel, header, tabs or focus mode | [references/shell.md](references/shell.md) |
| Pick a color, spacing, radius, component or CSS approach | [references/design-system.md](references/design-system.md) |
| Touch presets, Markdown styling or Settings → Appearance | [references/theme.md](references/theme.md) |
| Animate anything, or handle keyboard, focus or screen readers | [references/motion-a11y.md](references/motion-a11y.md) |
| Call an Obsidian DOM API or write CSS | [../dev/references/obsidian-api.md](../dev/references/obsidian-api.md) |

## The shape

NAND registers one workbench view. Its leaf shows ① a 52px icon rail, ② a side panel for the current module (lists, sections, search, primary action) and ③ the page with its header. Modules contribute pages; the shell (`src/shell/`) owns layout, navigation, panel state, page lifetime and motion. A module never builds its own leaf, router or tab system.

| Need | Use |
|---|---|
| A screen the user navigates to | a workbench page (`PageCreate` → `NativeSurface`) |
| A list of things to pick in column ② | the contribution's `panel` model (`PanelModel`), fed by a module service |
| Settings | the module's `settingsPage` renderer with native `Setting` rows |
| A short decision or one input (confirm, rename, pick) | `openDialog` / `promptText` (`src/ui/primitives/`), or an Obsidian `SuggestModal` |
| An action menu | `showMenu` (Obsidian `Menu`) |
| A transient message | `Notice` |
| Editing a record, rules, long forms | inline in the page, not a dialog |

## Rules

1. Render business content with Preact into the element the host gives you (`contentEl` of the surface, the panel's custom slot) and unmount with `render(null, root)` on close. Native chrome (settings rows, menus, notices, the status bar) uses Obsidian APIs.
2. Pages read state from their module and emit actions; they do not own durable data. Ephemeral UI state (a rename box, an open menu) may live in components; anything that must survive a window move or restart goes into `getState()` with keys listed in the contribution's `stateKeys`.
3. Take the window from the element (`el.win`, `el.doc`); never capture `window` or `document` at module scope. Popout windows have their own document.
4. Build from the primitives and tokens in `references/design-system.md`. No second design system, no CSS-in-JS, no UI library outside the allowed list.
5. Colors come from tokens that derive from Obsidian variables, so community themes and the NAND presets both work. Literal colors exist only in `src/theme/` and the token layer. No `!important`, no `:has`, z-index only through tokens.
6. Every interactive element is a real button or input with an accessible name, reachable by keyboard and visible on `:focus-visible`. Targets are at least 32px (44px on touch).
7. Motion uses only `transform` and `opacity`, the duration tokens and `--nand-ease`, and is off under `prefers-reduced-motion`.
8. Text nodes are part of tests: keep wording and structure stable when restyling.

## Procedure

1. Decide where it goes using the table above. If it is a page, follow `references/shell.md` and the page steps in `../dev/references/module-authoring.md`.
2. Put files in the module's `ui/` folder: PascalCase for components (`InboxPanel.tsx`), kebab-case for logic and loaders (`workbench-page.ts`).
3. Compose primitives; add the module's own class next to them for layout. A generic primitive that two modules need goes to `src/ui/`.
4. Write CSS in the module's `styles/` file, scoped to its classes; rebuild `styles.css` (`node scripts/build-styles.mjs --write`) and run `pnpm run lint:css`.
5. Check light and dark, the three presets, and the three widths (≥960, 600–960, <600 / phone). The real-Obsidian probe covers the workbench at several widths; take screenshots for visual changes.

## Checklist

- [ ] Lives in the shell's page/panel slots; no new leaf, router or tab bar
- [ ] Unmounts on close; uses the element's window
- [ ] Primitives and tokens only; no literal colors, `!important`, `:has` or raw z-index
- [ ] Keyboard reachable, named, visible focus; reduced motion respected
- [ ] Looks right in light/dark, all presets and all three widths
- [ ] `pnpm run build`, `pnpm run lint` and `pnpm run lint:css` pass
