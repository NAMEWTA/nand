English | [简体中文](motion-a11y.ZH.md)

# Motion and accessibility

## Motion

- Animate only `transform` and `opacity`. Never animate width, height, grid tracks or padding.
- Durations come from `--nand-duration-fast` (120ms: hovers, small fades), `--nand-duration` (180ms: panels, page fades) and `--nand-duration-slow` (240ms); easing is `--nand-ease`.
- Panel open/close uses FLIP (`src/shell/Shell.tsx`, `src/shell/styles/shell.css`): the grid jumps to its final layout once (so the page lays out once and observers fire once), then the panel and page animate from an offset `translateX` back to zero. The root carries `is-opening` / `is-closing` for 200ms.
- Terminals and other measured content fit once after the motion settles, not on every frame.
- Page switches fade in briefly; switching terminal or browser tabs does not animate.
- `prefers-reduced-motion: reduce` turns animations off: the shell skips the motion classes and the CSS removes animations under `.nand-shell`. New animations follow the same rule.
- Never animate on the hot path of typing or terminal output.

## Keyboard

| Where | Keys |
|---|---|
| Shell | F6 / Shift+F6 cycles focus between rail, panel and page |
| Rail | arrow keys, Home and End move between icons (roving focus); Enter or Space activates |
| Side panel | Up and Down move between rows; Enter opens |
| Panel separator | arrow keys resize, Home and End jump to the minimum and maximum width |
| Overlay panel | Esc closes and returns focus to where it came from; focus stays inside while open |
| Tab strip | arrow keys, Home and End move, Delete closes, middle click closes |
| Dialogs | Obsidian `Modal` handles Esc and focus; put the primary action last |

NAND sets no default hotkeys; users bind commands themselves.

## Semantics

- Landmarks: the rail is `nav`, the panel is `aside`, the page is `main`. The rail marks the current module with `aria-current` and the panel toggle with `aria-expanded`.
- Route changes are announced in a polite live region; busy messages use `role="status"` and errors `role="alert"`.
- Every icon-only button has an accessible name (`IconButton`'s `label`, or `aria-label` + `setTooltip`). Inputs have labels; help text is linked with `aria-describedby`, not stuffed into the label.
- Use native `button`, `input`, `select`. A clickable `div` is a bug; if something must not be a button, give it a role, `tabindex` and Enter/Space handling.
- Keep `:focus-visible` outlines (`--nand-focus-ring`); never remove focus styles.
- Hidden pages are `hidden` and `inert` so focus and screen readers skip them.

## Size and contrast

- Click targets at least 32px; touch targets 44px (`--nand-touch-target`).
- Normal text in NAND UI meets 7:1 against its background in every preset and mode, muted text and link or accent text 4.5:1 (`src/theme/presets.test.ts`). Faint text (`--text-faint`) is 3:1: use it only for decoration and non-essential hints, never for content the user must read.
- Do not convey state by color alone: pair status colors with an icon or text.
