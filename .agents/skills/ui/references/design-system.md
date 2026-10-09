English | [简体中文](design-system.ZH.md)

# Design system

Code: `src/ui/styles/000-foundation.css` (tokens), `src/ui/styles/001-primitives.css` (`nand-ui-*` classes), `src/ui/primitives/` (Preact components and native wrappers). Everything derives from Obsidian variables, so the active Obsidian theme, community themes and the NAND presets all flow through. Do not redefine tokens in a module.

## Tokens

| Use | Token |
|---|---|
| Spacing (4px base) | `--nand-space-1` … `--nand-space-8` |
| Radius | `--nand-radius-xs` 4px (chips, tracks), `-sm` 6px (controls, rows), `-md` 8px (cards, popovers), `-lg` 12px (dialogs), `-pill` |
| Surfaces | `--nand-surface`, `--nand-surface-muted`, `--nand-surface-hover`, `--nand-surface-active` |
| Borders | `--nand-border`, `--nand-border-color`, `--nand-border-color-strong` |
| Accent | `--nand-accent`, `--nand-accent-soft` (selection fill), `--nand-accent-softer` (drop targets), `--nand-accent-border`, text in `--text-accent` |
| Status (meaning only) | `--nand-tone-success`, `-warning`, `-error`, `-info` |
| Elevation | `--nand-shadow-xs` resting, `-sm` hover, `-md` popover, `-lg` floating |
| Type | `--nand-text-caption`, `-body`, `-title`, `-heading`; text colors `--text-normal`, `--text-muted`, `--text-faint` |
| Controls | `--nand-control-height-sm` 28px, `--nand-control-height` 32px, `-lg` 36px, `--nand-touch-target` 44px, `--nand-icon-size` 16px |
| Shell | `--nand-rail-width` 52px, `--nand-panel-width`, `--nand-header-height` 44px, `--nand-list-row-height` 32px |
| Layers | `--nand-z-base`, `-sticky`, `-overlay`, `-popover`, `-modal`, `-toast` (highest 50) |
| Motion | `--nand-duration-fast` 120ms, `--nand-duration` 180ms, `--nand-duration-slow` 240ms, `--nand-ease` |
| Focus | `--nand-focus-ring` |

Numbers that line up (counts, money, times) use `font-variant-numeric: tabular-nums`. Nested radius is the outer radius minus the inset.

## Primitives

Preact components in `src/ui/primitives/`:

| Component | For |
|---|---|
| `Button` (variants default/primary/ghost/danger, sizes sm/md), `IconButton` | actions; `IconButton` needs `label` (it becomes `aria-label` and the tooltip) |
| `TextField`, `SearchField` | labeled input / textarea; panel and list search |
| `Tabs` (segmented, `aria-pressed`), `TabStrip` | small exclusive choice; resource tabs in the page area |
| `ListItem` | selectable rows with icon, meta, badge and hover actions |
| `Badge`, `SaveStatus`, `Skeleton`, `EmptyState` / `renderEmptyState` | status chip, saving/saved/error, loading placeholder, empty/disabled/error states |
| `Icon` | Obsidian `setIcon` in a component |
| `openDialog`, `promptText` | an Obsidian `Modal` with a Preact body; a one-field prompt |
| `showMenu` | an Obsidian `Menu` from entries |
| `localized-dom`, `localized-form` | native labels that follow the language without a rerender |

CSS-only building blocks in `001-primitives.css`: `nand-ui-card` (`is-interactive`, `is-selected`), `nand-ui-btn`, `nand-ui-btn-ghost`, `nand-ui-icon-btn`, `nand-ui-segmented`, `nand-ui-field`, `nand-ui-badge` (`--accent`, `--success`, `--warning`, `--error`, `--info`), `nand-ui-dot`, `nand-ui-list`, `nand-ui-list-item` (`-title`, `-meta`), `nand-ui-section-label`, `nand-ui-toolbar`, `nand-ui-spacer`, `nand-ui-stack`, `nand-ui-divider`, `nand-ui-scroll`, `nand-ui-panel-muted`.

Shell patterns (`src/shell/`): `Rail`, `SidePanel`, `PageHeader`. Settings pages use native `Setting` rows with `setHeading()` groups.

## Composition

- One primary action per page or dialog. Secondary actions are ghost or icon buttons; destructive ones use the danger variant or `mod-warning`.
- Separate with whitespace first, then a muted surface, then a hairline border. A resting card never has both a strong border and a heavy shadow.
- Hover changes one step (fill, border or one shadow tier). No scale jumps.
- Neutral by default; color marks selection and meaning, never decoration.
- Hierarchy is weight and size: titles 600, body regular, meta in `--text-muted` caption.
- Gaps between groups are at least twice the gaps inside them. Card padding 12–16px.
- Reading and form pages limit their width (760–960px); boards, terminal and browser use the full width.
- Empty, loading and error states are designed and centered, with the same tokens.

## CSS rules

Enforced by `pnpm run lint:css` (stylelint, `stylelint.config.mjs`; files listed in the shrink-only baseline `scripts/stylelint-baseline.json` may keep the violations listed for them):

- No literal colors (hex, `rgb()`, `hsl()`…) outside `src/theme/` and the token layer.
- No `!important`, no `:has`.
- `z-index` only through `--nand-z-*` tokens.
- No duplicate selectors.
- Scope to the module's classes; rules for Obsidian's own DOM hang off a body class the module adds while active (`body.nand-iconic-enabled`, `body.nand-theme--…`).

The board's `--db-*` variables are aliases defined once from the global tokens (`src/modules/home/styles/004-root.css`). They belong to the board and its dialogs; new UI uses the `--nand-*` tokens.

## Libraries

Allowed: `preact` (with `preact/compat` for `react` imports), Obsidian's own controls (`Setting`, `Menu`, `Modal`, `SuggestModal`, `setIcon`, `setTooltip`), pointer events for dragging within one window, chart.js (lazy, home charts), xterm.js (agent).

Refused: React 19 / `react-dom`, MUI, Chakra, Ant Design, shadcn, Tailwind, Bootstrap, styled-components, Emotion, dnd-kit, react-beautiful-dnd, flatpickr, choices.js, color-picker packages. If something cannot be done with these, stop and say so.
