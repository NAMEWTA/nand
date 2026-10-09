English | [简体中文](skill-maintenance.ZH.md)

# Keeping this skill true

Open this file only when you changed an invariant, or when you are editing the `dev` or `ui` skill itself. Code, `package.json`, and `.github/workflows` win. Then update the one file below that owns the fact, in the same change.

## One fact, one file

| Fact | Owner |
|---|---|
| Display name, plugin id, view types, module ids, `minAppVersion`, `isDesktopOnly`, license, entry, stylesheet, helper | `SKILL.md` identity table |
| Rules that apply to every edit, and the finish gate | `SKILL.md` |
| Zones, import matrix, lazy-loading rules, module system overview, workbench composition, command homes, persisted names, TypeScript settings | `references/architecture.md` |
| Module files, adding a module, pages, settings pages, services and contributions | `references/module-authoring.md` |
| Settings store, schemas, scopes, dictionaries, language behavior | `references/settings-and-i18n.md` |
| Obsidian API, lint severity, DOM, CSS rules, timers | `references/obsidian-api.md` |
| Comment sidecars, anchors, comment tests | `references/editor-comments.md` |
| Test layers, which test to run, golden samples, the real-Obsidian probe | `references/testing.md` |
| Scripts, styles build, esbuild, budgets, CI, version bump, current version, release workflow | `references/build-and-release.md` |
| License files, dependencies, adapting outside code, terminal sources, similarity check | `references/licensing.md` |
| Workbench shell behavior, page and panel contracts, dialogs | `../ui/SKILL.md` and `../ui/references/shell.md` |
| Design tokens, primitives, patterns, CSS scoping | `../ui/references/design-system.md` |
| Theme presets, Markdown styles, appearance settings | `../ui/references/theme.md` |
| Motion, keyboard and accessibility rules | `../ui/references/motion-a11y.md` |
| This map, and how to revise the skills | this file |

Point at the owner. Do not copy the value into a second file. `SKILL.md` links directly to every reference. A sibling may name another reference that `SKILL.md` already links; do not add a file that is only reachable through that hop.

## Two languages

Every skill file has a Chinese companion next to it with `.ZH` before the extension (`SKILL.ZH.md`, `references/architecture.ZH.md`), and every file starts with a language switch line after any frontmatter. Only `SKILL.md` carries frontmatter and is loaded by tools; the `.ZH.md` files are read by people. The two versions have the same structure and facts, and links inside a Chinese file point at the Chinese companions. Change both in the same edit.

## How to revise it

1. Read the host's skill rules and the open Agent Skills practices before inventing a new layout. The description triggers the skill. The body is the every-run procedure. Long material waits in `references/` until a step names it.
2. List the claims you are about to write: paths, command ids, page ids, scripts, gates.
3. Check each claim against the current source. A file comment that disagrees with the imports is not the source of truth.
4. Sort the result. Wrong claims get replaced. Over-specific claims get loosened to the real boundary. Duplicated claims lose the extra copy. Generic advice the agent already follows gets cut. A mistake the agent will make without being told stays as one sentence in `SKILL.md`, with the procedure in the owner file.
5. Describe what is true now, in the present tense. A skill is not a changelog: leave out earlier states, version histories and migration notes.
6. Keep `SKILL.md` under 500 lines. Link one level deep.
7. Keep the description specific, third person, under 1024 characters, and include the words a user actually types: NAND, nand, 看板, 仪表盘, 评论, 终端, 设置, 发版, Obsidian 插件, plus the English area names.
8. Re-read the diff against this table. A new version number, directory, or command line belongs in the owner only.
9. Check the skill by opening every path it names and matching every script it names to `package.json`. Do not add a separate skill linter. `pnpm test:docs` checks the links.

Do not add `README.md`, `CHANGELOG.md`, or another numbered catch-all file inside this skill.
