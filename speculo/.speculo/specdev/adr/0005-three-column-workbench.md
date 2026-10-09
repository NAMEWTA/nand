English | [简体中文](0005-three-column-workbench.ZH.md)

# ADR-0005: Three-column workbench

Status: accepted. Checked against the code on 2026-10-08.

## Problem

Nine features need screens, settings and navigation. One view type and one ribbon entry per feature would scatter navigation across the Obsidian UI and tie it to business lifecycles: closing a tab could end a terminal session, and showing a page could start a process.

## Decision

- **Two view types.** The plugin registers `nand-workbench-view`, the workbench, and `nand-comments-view`, the comments side panel. No product screen has its own view type. The ribbon has one entry that opens the workbench.
- **Three columns.** The rail (column 1) holds module icons: top slot for home, agent, browser, archives, automations, sync, icons and comments, bottom slot for notifications (with an unread badge) and settings. The side panel (column 2) shows the selected module's navigation. The page area (column 3) shows the content. Clicking the active icon collapses or expands the panel; clicking another icon returns to that module's last route in the leaf. A module that is off disappears from the rail, a failed module shows a warning, and a disabled module's route shows an "enable the module" state instead of redirecting.
- **Width follows the leaf.** The layout depends on the leaf's own width, not the window's: 960 px or more is `wide` with an inline panel, 600 to 959 px is `medium` with the panel as an overlay, and under 600 px or on a phone is `narrow` with the rail and panel merged into one drawer.
- **Contributions and pages.** `compose-workbench.ts` declares one contribution per feature: rail slot, navigation tree, side panel model, availability (enabled, supported, ready), the page state keys that survive restore, and a `create` function. A feature's page comes from the owning module's `ModuleInstance.pages`; opening it activates an idle module. Pages render through `NativeSurface`.
- **Navigation has no side effects.** Navigating, switching a section or restoring a route never starts a session, a guest page or a network request. Closing a page releases its presentation only; business state belongs to the module. Hidden pages stay alive (`inert`), except those marked to be released when hidden, such as the notifications inbox.
- **Focus mode.** "Open in new tab" and "open in split" create another workbench leaf locked to one route, without rail and panel. The leaf state is `{ target, focus, panelOpen, panelWidth, lastTargets, pages }` and is normalized on load. A saved route whose resource is gone opens its section.
- **Settings are in the workbench.** General, Appearance, one page per enabled product and About are pages of the `settings` feature. Obsidian's settings tab keeps an entry that opens them.
- **Status.** Statuses (running automations, agent sessions that wait for input, notifications that need attention, sync rows, board save failures) come from module services. They go to Obsidian's status bar when it exists and to the page header otherwise.
- **Records belong to home.** Habit, expense, pomodoro and reading pages are the `records` feature, a child of `dashboard` on the rail.

## Consequences

Adding a feature is a contribution plus a module page, not a new view type. Navigation stays cheap because it creates nothing. The shell stays independent of module internals because it sees only contracts.

## Evidence

[Workbench leaf](../../../../src/app/workbench/workbench-leaf.ts), [composition](../../../../src/app/workbench/compose-workbench.ts), [shell surface](../../../../src/shell/host/workbench-surface.tsx), [contracts](../../../../src/app/contracts/workbench.ts), [layout](../../../../src/shell/layout.ts). The layout, navigation-state and workbench-lifecycle tests, and the real-Obsidian probe.
