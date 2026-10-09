English | [简体中文](shell.ZH.md)

# The workbench shell

Code: `src/app/workbench/workbench-leaf.ts` (the registered view; loads the shell on open), `src/shell/host/workbench-surface.tsx` (state, navigation, rendering), `src/shell/host/workbench-pages.ts` (page lifetime), `src/shell/Shell.tsx`, `Rail.tsx`, `SidePanel.tsx`, `PageHeader.tsx`, `layout.ts`, `navigation-state.ts`, `navigation-transition.ts`. Rail entries are declared in `src/app/workbench/compose-workbench.ts`.

## Layout

```
┌────┬────────────────┬──────────────────────────────────────────┐
│ ①  │ ② side panel   │ ③ page header 44px: ⟨panel⟩ title · status · ⋯ │
│rail│ title + primary│ tab strip (resource pages only)           │
│52px│ search         │ page content                              │
│    │ sections/rows  │                                           │
│ 🔔 │ (220–360px,    │                                           │
│ ⚙  │  default 260)  │                                           │
└────┴────────────────┴──────────────────────────────────────────┘
```

| Width of the leaf | Layout |
|---|---|
| ≥ 960px (`wide`) | three columns; the panel is inline |
| 600–960px (`medium`) | rail stays; the panel opens as an overlay (scrim, Esc closes, focus moves in and back) |
| < 600px or phone (`narrow`) | rail and panel merge into one drawer opened from the header |

The layout follows the leaf's own width (container measurement), not the window's. On desktop the native view header is hidden and the page header replaces it; its `⋯` menu calls the page's `onPaneMenu` and adds "open in a native tab", "open in a split" and, for resource pages, "close page".

## Rail and panel behavior

- Clicking the active module's icon toggles the panel. Clicking another icon returns to that module's last route in this leaf (`lastTargets`) and leaves the panel open or closed as it was.
- Top slot: home, agent (desktop), browser (desktop), archives, automations, git sync (desktop), icons, comments. Bottom slot: notifications (unread badge), settings. A module that is off disappears from the rail; one that failed shows a warning mark.
- Records pages (habits, expenses, pomodoro, reading) belong to home (`railParent: 'dashboard'`), so the home icon stays highlighted.
- Panel width: dragging changes only the `--nand-panel-width` CSS variable; the value is committed on pointer release and saved with the leaf. Double-click resets to 260px; the separator also takes the arrow keys, Home and End.
- The panel model (`PanelModel` in `src/app/contracts/workbench.ts`): an optional primary action, optional search over row labels, and sections of rows (`label`, `icon`, `meta`, `badge`, `target` or `select`, `menu`, `active`). Rows show `⋯` on hover; right click opens the same menu. Sections have an `emptyText`. A module may instead render a custom panel into `navigationEl` (agent sessions, archives filters).

## Pages

A page is created by the contribution's `create(context, target, state, signal)` and returns a binding:

| Member | Meaning |
|---|---|
| `surface` | a `NativeSurface` (`src/ui/native-surface.ts`) rendering into `context.contentEl` |
| `navigate(target, signal)` | change section or resource without recreating the page; must not start sessions or other side effects |
| `getTarget()` | the route actually shown (for header title and restore) |
| `getState()` / `restore(state)` | bounded state saved in the leaf; only keys in `stateKeys` survive (`cleanPageState`) |

Rules:

- Creation is abortable: honor `signal` and return quickly; heavy work continues after the first paint.
- Pages are kept while hidden (`hidden` + `inert`, `setVisible(false)`); on reveal they get `setVisible(true)` and one resize. A contribution with `releaseWhenHidden` (the inbox) is closed when left. Resource pages (`resourcePages: true`, browser tabs, agent sessions) stay until closed.
- An unknown section falls back to the module's default page; a disabled module shows an "enable the module" state instead of redirecting; a missing resource shows a recoverable message.
- `context.changed()` tells the shell the page's route or title changed (header, panel highlight, leaf state).
- Header status: `WorkbenchStatus` rows come from module services through compose-workbench; the header shows them only when Obsidian's status bar is absent (mobile).

## Focus mode, tabs and restore

- "Open in a native tab" and "Open in a split" create another workbench leaf with `focus: true` and that page's state: no rail or panel, plus an "Open in workbench" action. Browser pages get a new page id when copied.
- The tab strip (`TabStrip` primitive) appears for resource pages: select, close, middle-click close, keyboard arrows, Home, End and Delete, reorder by drag, `+` for a new resource.
- The leaf state is the shell state `{ target, focus, panelOpen, panelWidth, lastTargets }` plus the kept pages with their bounded state, normalized on load (`normalizeWorkbenchState`). Restoring a route whose resource no longer exists opens the section instead of failing.

## Do not

- Do not add a router, history stack or tab system inside a module.
- Do not nest an `ItemView` or open a new leaf type to show a page.
- Do not start a terminal, guest page or network request just because a page or panel was rendered; wait for an explicit action.
