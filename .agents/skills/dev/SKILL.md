---
name: dev
description: >-
  Development rules for the NAND Obsidian plugin in this repository
  (plugin id nand). Use when editing the plugin shell, dashboard, editor
  comments, terminal agent, icons, archives, sync placeholder, shared modules, manifest,
  styles.css, main.js, settings, i18n, esbuild, eslint, or a GitHub release.
  Use when the user mentions NAND, nand, 看板, 仪表盘, 评论, 终端, 图标, 档案, 设置, 发版,
  or Obsidian 插件. Project rules override generic Obsidian plugin advice.
license: GPL-3.0-only
metadata:
  version: "2.0.0"
  short-description: Plugin development rules
  adapted-from: https://github.com/gapmiss/obsidian-plugin-skill (MIT, skill version 1.11.0, eslint-plugin-obsidianmd v0.4.x)
---

# Plugin development

This skill is for this repository only. It adapts the Obsidian plugin rules named in `metadata.adapted-from`. When those rules disagree with this file, follow this file. Do not scaffold a new plugin. Do not rename the plugin id. Do not turn this repo into a web app.

Editing src/, styles.css, manifest.json, main.js, esbuild.config.mjs, eslint.config.mts, package.json scripts, or .github/workflows in this repository. Also /dev. This skill is for this repository only.

## Read before editing

| Before you… | Open |
|---|---|
| Consolidate documentation or look up domain terms and architecture decisions | [SpecDev developer documentation index](../../../speculo/.speculo/specdev/.config/domain-layout.md) |
| Move files, add a product, add a command, add UI copy, or change settings pages | [references/architecture.md](references/architecture.md) |
| Call the Obsidian API, or edit settings UI, CSS, or DOM | [references/obsidian-api.md](references/obsidian-api.md) |
| Render a product surface inside a leaf | [../view-render/SKILL.md](../view-render/SKILL.md) |
| Touch comments, highlights, or `.nand/editor/` | [references/editor-comments.md](references/editor-comments.md) |
| Build, test, bump a version, or release | [references/build-and-release.md](references/build-and-release.md) |
| Change the identity table, an import boundary, a settings product, the i18n home, a test entry, or the release path | [references/skill-maintenance.md](references/skill-maintenance.md) |

## Identity

| | |
|---|---|
| Display name | `NAND` |
| Plugin id | `nand` |
| View types (frozen) | `nand-dashboard-view`, `nand-editor-view`, `terminal-view`, `nand-contacts-view`, `nand-automation-view`, `nand-browser-view` |
| `minAppVersion` | `1.12.0` |
| `isDesktopOnly` | `false` |
| Entry | `src/plugin/main.ts` → committed `main.js` |
| Styles | one `styles.css` at the repo root |

Pinned leaves store the view type string. The project is in pre-release development: use the current namespace directly, without migration tools, compatibility aliases, or a namespace startup gate. See `references/architecture.md` for persisted names.

## Hard rules

1. Keep the view type strings in the identity table. Register native product views on phones and when a module is off. A terminal leaf whose module is off shows `InactiveTerminalView`; browser leaves render a disabled/mobile placeholder without creating desktop resources.
2. Source is layered as `plugin`, `view`, `platform`, `core`, `shared`. The import matrix is in `references/architecture.md` and enforced by `pnpm test:architecture`, including type imports and lazy runtime cycles. Domain logic belongs in `core`; shared is not a dumping ground for feature models.
3. `plugin/` is the composition root. Views receive explicit host/action contracts; they do not import the plugin class, even with `import type`. Platform adapters never import views or plugin modules. Inject UI actions from composition. TerminalService owns native PTY sessions; views acquire xterm renderers separately.
4. `src/core/sync/index.ts` stays `export {}`. Dashboard markdown write-back belongs in `src/platform/obsidian/dashboard/`.
5. User entities and records use Markdown; NAND-owned configuration/runtime JSON belongs under vault `.nand/` by domain/device, never in the plugin installation directory. No legacy migration or dual writes. Comments never rewrite the note. Bodies live in `.nand/editor/comments/`, not in `data.json` and not in the plugin folder.
6. Construct `TerminalAgentController` only when `Platform.isDesktopApp` and the terminal module is on. Skip music on phones. Destroy music when the dashboard module turns off.
7. Source files use relative imports. `tsconfig` `baseUrl` is `src`; that does not allow `dashboard-view/...` specifiers.
8. User-facing copy goes through `src/shared/i18n/`, with `en` and `zh` in the same module, both merged in `runtime.ts`. Terminal strings are keys prefixed `terminalAgent.` in `src/shared/i18n/terminal-agent.ts`. `src/shared/i18n/terminal-accessor.ts` only adds that prefix. Do not add a new `section-NN.ts`. A missing key is echoed by `t()`. Default language is `zh`.
9. Put a command id in `NAND_COMMANDS` only when another product must spell it. Register new shell commands in `src/plugin/commands.ts`. Leave the commands already inline in `main.ts` where they are. Leave terminal commands inside `plugin/modules/terminal` and icon commands inside `plugin/modules/icons`. Ids omit the plugin id. Names omit the word "command". No default hotkeys.
10. One `DashboardSettingTab`. Products and the section order come from `src/plugin/settings/nav.ts`. The top row is home, then the open modules, automation, then sync. There is no left-hand page list. Keep `display()` / `renderFallback()` because `minAppVersion` is below 1.13. Normalize `editorWorkbench` in `loadSettings` after the `{...raw}` spread.
11. For editor comments, register CodeMirror extensions and the reading post-processor once, inside `createEditorHost`. Closing the editor side panel only detaches panel DOM. Turning the editor module off flushes and disposes the comment store and does not unregister those extensions.
12. A new editor domain implements `EditorDomain`. `writing-stats` and `focus` stay placeholders unless the task names them.
13. Do the task you were asked to do. A bug fix does not restyle a widget. A comment change does not retile the dashboard.
14. If you change the identity table, an import boundary, a settings product, the i18n home, a test entry, or the release path, update the one skill file that owns that fact in the same change. The map is in `references/skill-maintenance.md`.

## Where code goes

```
src/plugin/      native entry, module registration, settings, cross-domain workflows
src/view/        functional panels, workbenches, native UI integration, primitives
src/platform/    Obsidian/Vault, desktop and Rust transport adapters
src/core/        host-independent domain slices
src/shared/      basic utilities, serialization ports, protocols and i18n
```

Folder map, command homes, and settings pages are in `references/architecture.md`.

## Before you finish

Run `pnpm run build`, then `pnpm run lint`. When behavior changed, run the matching `pnpm run test:*` named in `references/build-and-release.md`. The CI subset is listed in that reference. Run `pnpm test:architecture` after any structural change.

Version bumps and releases follow that same file.

## Checklist

- [ ] View type strings unchanged
- [ ] Architecture boundary and runtime cycle checks pass
- [ ] Notes are not rewritten by comments
- [ ] New strings exist in both languages, in the i18n home from rule 8
- [ ] `pnpm run build` and `pnpm run lint` report no new errors
- [ ] `main.js` is rebuilt when source changed
- [ ] The matching `test:*` script was run when behavior changed
