---
name: view-render
description: >-
  How to render any NAND product surface inside an Obsidian leaf with Preact,
  and where those files go. Use when adding or changing a rendered leaf, or
  when the user mentions 前端渲染, 视图渲染, React, Preact, 画布, 叶子,
  弹出窗口, or createRoot. Also /view-render. Settings, menus, notices, and
  the status bar stay on the dev skill. This skill is for this repository only.
when-to-use: >-
  A product draws its own interface inside a leaf. Also /view-render.
  Not for settings rows or native Obsidian chrome.
license: GPL-3.0-only
metadata:
  version: "1.2.0"
  short-description: Leaf rendering with Preact
---

# Leaf rendering

Use this skill when a product surface is drawn inside a leaf. The current products are not the scope of this skill. Any later product follows the same directories.

Settings rows, menus, notices, and the status bar stay on the `dev` skill and use `Setting` or `createEl`. Do not turn an existing DOM view into Preact unless the task asks for a rendered surface.

The `dev` skill still owns view-type strings, import boundaries, i18n, the build gate, and the list of products that exist today. This skill owns the render runtime, the leaf's visual scale, and the directories below.

## Where the files go

A rendered surface belongs to `src/view/<domain>/`. Preact component files use PascalCase; controller/adapter/logic files use kebab-case. Native leaf classes and functional panels are distinct files.

```
src/view/<domain>/             panels and their related visual components
src/view/<domain>/host.ts      narrow native capabilities required by the surface
src/view/primitives/           domain-neutral visual primitives
src/core/<domain>/             models, application rules and ports
src/platform/<host>/<domain>/  native/Vault/desktop adapters
src/plugin/modules/           native registration and assembly
src/plugin/workflows/         cross-domain coordination
src/view/styles/              ordered author sources; order.json is the sequence
styles.css                    the one emitted root stylesheet
```

Compose panels in code using props and slots, as `view/terminal/TerminalWorkbench.tsx` does. A panel takes state and actions, not the plugin class or an ItemView implementation. Do not add a router, a service container, an end-user workbench configuration format or package publishing. Workbench navigation is a page slot inside `WorkbenchShell`, not a second router. The dev architecture reference owns dependency directions. The emitted stylesheet remains the one root `styles.css`.

## Read before editing

| Before you… | Open |
|---|---|
| Mount, move, or unmount a rendered view | [references/runtime.md](references/runtime.md) |
| Pick a color, spacing, radius, component, or UI library | [references/aesthetic.md](references/aesthetic.md) |
| Touch DOM helpers, touch targets, or CSS bans | [../dev/references/obsidian-api.md](../dev/references/obsidian-api.md) |

## Procedure

1. Confirm the work is a leaf surface. Settings rows, native menus, notices and status-bar items use native APIs and the `dev` skill. A native Modal may host a Preact business panel; retain its native lifecycle.
2. Put each new file on the tree above before writing it.
3. Keep the source of truth in the product's existing state. A component reads that state and emits actions. Ephemeral UI, such as which row is being renamed, may live in component state.
4. Follow `references/runtime.md`. A surface that stays inside its pane renders into `contentEl`. A surface whose drag preview leaves the pane uses one Preact root per `Window` and portals into `contentEl`. Take the DOM window from the element (`win` / `doc`) or from the second argument of `window-open` / `window-close`. Do not capture `window` or `document` at module scope, and do not call `createRoot` from a component.
5. Keep a drag layer on that same window's root, not on the main window.
6. When the leaf moves, `onWindowMigrated` renders it again on the destination window. A window host unregisters the leaf from the old window first.
7. On plugin unload, unmount every root and remove a window host's node.
8. Render note markdown with Obsidian's markdown renderer, as a child of the view. Icons use `setIcon`.
9. Build from the shared `nand-ui-*` primitives and style only with the tokens in `references/aesthetic.md`. Follow its composition rules: one primary action, neutral by default, one-step hover. Keep existing text nodes and queried class names stable.
10. Add `preact` in the same change that first renders a view, with the esbuild alias in `references/runtime.md`. Do not add a library that file refuses.

## Checklist

- [ ] New files sit on the directory tree in this file
- [ ] Settings and chrome still use `Setting` or `createEl`
- [ ] The root's document is the leaf's window, not a `window` captured at load
- [ ] Unload unmounts every root
- [ ] Shared primitives reused; no parallel button, card, badge or tab styles
- [ ] No hardcoded colors or radii, and no library outside `references/aesthetic.md`
- [ ] `pnpm run build` and `pnpm run lint` still pass if source changed
