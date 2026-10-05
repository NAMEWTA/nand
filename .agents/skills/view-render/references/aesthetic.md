# Visual scale, primitives and libraries

A rendered leaf looks like the rest of Obsidian and like every other NAND product. Color comes from the app's CSS variables, so community themes still win. Geometry, motion and the shared building blocks come from the NAND design foundation, the first file in `src/view/styles/order.json`. Do not bring a second design system.

Touch targets, focus rings, `!important`, and `:has` stay in `../../dev/references/obsidian-api.md`. Class prefixes stay in that skill's architecture reference: use the prefix the product already has. This file owns the leaf scale, the shared primitives and the library list. The directories for the files are the tree in `../SKILL.md`.

## Tokens

Defined on `body` in the foundation block. Read them; do not redefine them in a product.

| Use | Token |
|---|---|
| Radius: chip inside a control, progress track | `--nand-radius-xs` (4px) |
| Radius: button, input, list row | `--nand-radius-sm` (6px) |
| Radius: card, panel, popover | `--nand-radius-md` (10px) |
| Radius: modal, hero surface | `--nand-radius-lg` (14px) |
| Radius: tag, badge, pill tab | `--nand-radius-pill` |
| Surface / muted surface | `--nand-surface` / `--nand-surface-muted` |
| Hover / active fill | `--nand-surface-hover` / `--nand-surface-active` |
| Hairline border | `--nand-border` (or `--nand-border-color`, `--nand-border-color-strong` on hover) |
| Selection, active row, soft badge | `--nand-accent-soft` background, `--nand-accent-border` border, `--text-accent` text |
| Status meaning only | `--nand-tone-success`, `-warning`, `-error`, `-info` |
| Elevation | `--nand-shadow-xs` resting card, `--nand-shadow-sm` hover, `--nand-shadow-lg` floating layer |
| Motion | `--nand-duration-fast` (120ms) / `--nand-duration` (180ms) with `--nand-ease` |
| Control height / touch target | `--nand-control-height` / `--nand-touch-target` (44px) |
| Type: title / body / caption | `--nand-text-title` / `--nand-text-body` / `--nand-text-caption` |
| Spacing | Obsidian's 4px grid: `var(--size-4-1)` … `var(--size-4-8)` |
| Text | `var(--text-normal)` / `var(--text-muted)` / `var(--text-faint)` |

Nested radius is the outer radius minus the inset. Numbers that line up (counts, money, times) use `font-variant-numeric: tabular-nums`.

## Primitives

Compose these classes before writing new CSS. Add the product's own class next to them for layout; do not copy their declarations.

| Class | What it is |
|---|---|
| `nand-ui-card` (+ `is-interactive`, `is-selected`) | Resting surface: hairline border, `--nand-radius-md`, 16px inset. Interactive cards lift one tier on hover |
| `nand-ui-btn`, `nand-ui-btn-ghost` | Text button with optional icon; ghost has no fill until hover |
| `nand-ui-icon-btn` (+ `is-active`) | Square icon-only button. Always give it `aria-label` |
| `nand-ui-segmented` | Pill track of `aria-pressed` buttons for a small exclusive choice (tabs, ranges, kinds) |
| `nand-ui-field` | Caption label (`span` first child) above an input or select |
| `nand-ui-badge` (+ `--accent`, `--success`, `--warning`, `--error`, `--info`), `nand-ui-dot` | Status chip and status dot |
| `nand-ui-list`, `nand-ui-list-item` (+ `is-active`), `-title`, `-meta` | Selectable navigation rows in a rail or master list |
| `nand-ui-section-label` | Small uppercase caption above a group |
| `nand-ui-toolbar`, `nand-ui-spacer`, `nand-ui-stack`, `nand-ui-divider`, `nand-ui-scroll` | Layout helpers |
| `EmptyState` / `renderEmptyState` in `src/view/primitives/` | Centered empty, disabled and no-file states |

A generic primitive that more than one product needs goes into the foundation block, next to the others. Anything else stays in the product's own region with the product prefix.

## Composition rules

- One primary action (`mod-cta`) per view or dialog. Secondary actions are ghost or icon buttons; destructive ones use `mod-warning` or a ghost button tinted with `--nand-tone-error`.
- Separate with whitespace first, then a muted surface, then a hairline border. A resting card never has both a strong border and a heavy shadow.
- Hover changes one step (fill, border or one shadow tier) in about 150ms. No scale jumps, no 2px hops.
- Neutral by default. Color marks selection and meaning, never decoration.
- Hierarchy is weight and size: title 600, body regular, meta caption in `--text-muted`.
- Group gap is at least twice the gap inside a group. Card padding 12–16px.
- Empty, loading and error states are designed, centered and use the same tokens.
- Keep text nodes stable when restyling: tests assert `textContent`. Icons from `setIcon` add no text; replacing a glyph such as `×` or `●` does.

## Dashboard board

The board (`.nand-dashboard-root[data-theme]`) keeps its thirteen palettes. Inside the board, color comes from `--db-*` tokens, never from `--nand-surface*`. Geometry follows the same family through the theme's `--db-radius-sm` / `-md` / `-lg` (floor 6 / 10 / 12). Motion and pill radius may use the `--nand-*` tokens. Per-theme component overrides read `var(--db-accent)` and friends instead of repeating a palette hex. Body text on a card stays at or above 4.5:1 and muted text at 3:1 in both light and dark. Check new palette values against the painted card, not the token alone.

Editor, contacts, automation, workbench, inbox and settings UI must not depend on `--db-*`; they must look right with the board unmounted. Workbench body, helper, and placeholder text target 4.5:1. Do not relax that to 3:1 because a style is named muted.

## Density

Columns and rails scroll inside the leaf; the leaf's `.view-content` padding is zero when the surface manages its own inset. Column width is `272px`. Header chrome is one row of icon buttons. On a phone, do not keep that row: put the actions on the pane menu, and pad the bottom by the mobile navbar height the view measures. Tags reuse Obsidian's tag variables (`--tag-background`, `--tag-color`) or `nand-ui-badge`.

A drop target tints with `--nand-accent-softer` and uses the accent as its border. An empty column is a faint dashed border, not an illustration. Do not write hex colors in product CSS.

## Libraries

| Allowed | When |
|---|---|
| `preact`, `preact/compat` | The first rendered leaf, in that same change |
| `@tanstack/react-table` | A task that adds a real table view, and only if it runs on Preact |
| Pointer events on `view.contentEl.doc` | Dragging inside one window |

Refused, even if a tutorial suggests them: `react` 19, `react-dom` 19, MUI, Chakra, Ant Design, shadcn, Tailwind, Bootstrap, styled-components, Emotion, Excalidraw, roughjs, dnd-kit, react-beautiful-dnd, choices.js, flatpickr, react-colorful.

Color, date, and select controls in a form use Obsidian's `Setting`, suggesters, and `setIcon`. A drag interaction that pointer events cannot express is a reason to stop and say so, not a reason to add a drag library.

If a package renders on Preact and then breaks, leave the rest of the plugin on Preact. Replace that one package with DOM, or isolate it. Do not switch the plugin to React 19 to make one package happy.
