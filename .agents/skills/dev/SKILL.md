---
name: dev
description: >-
  Development rules for the NAND Obsidian plugin in this repository
  (plugin id nand): module system, lazy loading, settings store, i18n,
  storage under .nand/, tests, build budgets, licensing and releases. Use
  when editing src/, native/pty-server, styles, main.js, manifest.json,
  package.json scripts, esbuild, eslint, CI workflows or a GitHub release,
  or when the user mentions NAND, nand, 模块, 看板, 仪表盘, 评论, 终端, 智能体,
  浏览器, 档案, 自动化, 通知, 图标, 设置, Git 同步, 发版, or Obsidian 插件.
  Project rules override generic Obsidian plugin advice. Rendering inside the
  workbench is the ui skill.
license: MIT
metadata:
  short-description: Plugin development rules
  adapted-from: https://github.com/gapmiss/obsidian-plugin-skill (MIT, skill version 1.11.0, eslint-plugin-obsidianmd v0.4.x)
---

English | [简体中文](SKILL.ZH.md)

# Plugin development

This skill is for this repository only. It adapts the Obsidian plugin rules named in `metadata.adapted-from`; where they disagree with this file, follow this file. Do not scaffold a new plugin, rename the plugin id, or turn the repo into a web app.

## Read before editing

| Before you… | Open |
|---|---|
| Look up domain terms, architecture decisions or the current baseline | [Development documentation](../../../speculo/.speculo/specdev/.config/domain-layout.md) |
| Move files, import across zones, add a command, or touch persisted names | [references/architecture.md](references/architecture.md) |
| Add a module, a workbench page, a service or a settings page | [references/module-authoring.md](references/module-authoring.md) |
| Add or change a setting, a user-facing string or a language rule | [references/settings-and-i18n.md](references/settings-and-i18n.md) |
| Call the Obsidian API, or edit DOM, CSS or timers | [references/obsidian-api.md](references/obsidian-api.md) |
| Render a page, panel or dialog inside the workbench | [../ui/SKILL.md](../ui/SKILL.md) |
| Touch comments, highlights or `.nand/editor/` | [references/editor-comments.md](references/editor-comments.md) |
| Pick or write a test, or run the real-Obsidian probe | [references/testing.md](references/testing.md) |
| Build, check budgets, bump a version or release | [references/build-and-release.md](references/build-and-release.md) |
| Add a dependency, adapt outside code, or touch the terminal | [references/licensing.md](references/licensing.md) |
| Change a fact this skill owns, or edit the skills themselves | [references/skill-maintenance.md](references/skill-maintenance.md) |

## Identity

| | |
|---|---|
| Display name | `NAND` |
| Plugin id | `nand` |
| View types | `nand-workbench-view` (the workbench), `nand-comments-view` (comments side panel) |
| Modules | `home`, `agent`, `browser`, `archives`, `automations`, `notifications`, `icons`, `comments`, `sync` |
| `minAppVersion` | `1.13.0` (do not use APIs marked `@since 1.13.1` or later) |
| `isDesktopOnly` | `false` |
| License | MIT (`LICENSE`; attributions in `NOTICE` and `THIRD-PARTY-NOTICES.md`) |
| Entry | `src/app/main.ts` → committed `main.js` |
| Styles | one committed `styles.css`, joined from the author files listed in `src/styles.json` |
| Native helper | `native/pty-server` (`nand-pty`), built only by CI and shipped as release assets |

The version lives in `manifest.json`; `references/build-and-release.md` says how it is bumped.

## Hard rules

1. Register only the two view types above. Product screens are workbench pages that a module returns from `pages`; "open in new tab / split" opens a focus-mode workbench leaf, never another view type.
2. Code lives in zones (`app`, `shell`, `ui`, `theme`, `host`, `shared`, `modules/<id>/{core,platform,services,contrib,ui}`). Imports follow the matrix in `references/architecture.md`, type imports included; `pnpm test:architecture` fails on any violation. Modules reach each other only through the other module's `api.ts`.
3. Module code is lazy. Startup code (`app`, manifests, `api.ts`, startup dictionaries) never imports a module's `module.ts`, `core`, `platform`, `services`, `contrib` or `ui` statically, and `module.ts` never imports its own `ui/` statically. `pnpm run check:bundle` enforces the startup budget and the per-module budgets.
4. A module starts and stops itself. Everything it creates is released in `dispose()` or through `context.lifetime`, `context.commands` and `context.editor`; turning a module off must leave no listener, command, editor extension, body class or process behind. One module failing never stops the others.
5. Settings are namespaces in the settings store: bind the module's schema with `context.settings.bind(name, schema)` and change values with `update`. Never add a flat plugin setting or call `saveData`.
6. User content is Markdown in visible folders; NAND configuration and runtime JSON live under the vault's `.nand/`, by domain and device. The only thing stored in the plugin folder is the downloaded terminal helper (`binaries/`). Comments never rewrite the note. User data formats are locked by tests: boards, archives, automations and records by the golden samples, comment sidecars by the comments tests, `iconic.json` by the Iconic port tests. Change them only on purpose, with the fixture.
7. Every user-facing string goes through `t()` with `en` and `zh` in the module's own `i18n.ts`, registered when `module.ts` loads. Startup dictionaries in `src/shared/i18n/` hold only keys startup code reads.
8. Node and Electron are used only in `desktop/` folders, reached only on desktop. Core and shared code use no host package at all.
9. Lint passes with zero warnings (`pnpm run lint`). Do not silence a rule to get there; fix the code or record a scoped override in `eslint.config.mts` with its reason.
10. Terminal code is written for NAND. Never copy or paraphrase code from GPL-licensed terminal projects; allowed references are in `references/licensing.md`.
11. Do the task you were asked to do. A bug fix does not restyle a widget; a comment change does not retile the board.
12. Documents are bilingual: English is the default (`README.md`), the Chinese version sits next to it with `.ZH` before the extension (`README.ZH.md`), and each starts with a language switch line. Change both together. `LICENSE` and `NOTICE` are English only.
13. When you change a fact this skill owns, update the one file that owns it in the same change (`references/skill-maintenance.md`).

## Before you finish

Run `pnpm run build` (it rebuilds `main.js`), `pnpm run lint`, and the tests that cover what you changed (`references/testing.md`). After structural changes also run `pnpm test:architecture` and `pnpm run check:bundle`; after CSS changes `pnpm run lint:css`; after documentation changes `pnpm test:docs`. Commit the rebuilt `main.js` and `styles.css` with the source.

## Checklist

- [ ] Only the two view types are registered; persisted names unchanged
- [ ] Architecture check and bundle budgets pass
- [ ] Turning the module off and on again leaves nothing behind
- [ ] New strings exist in both languages in the owning dictionary
- [ ] User data formats unchanged, or the golden fixture changed on purpose
- [ ] Documents changed in both languages
- [ ] `pnpm run build`, `pnpm run lint` and the matching tests pass; `main.js` rebuilt
