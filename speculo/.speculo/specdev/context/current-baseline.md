English | [简体中文](current-baseline.ZH.md)

# Current baseline

This document states what the code is now. A declared target is not written as a measured result: measurements and open verification items are in [validation](validation.md).

## Identity

| | |
|---|---|
| Display name, plugin id | NAND, `nand` |
| Version | 0.0.1-alpha.1 (`manifest.json`, `package.json`, `versions.json`) |
| `minAppVersion` | `1.13.0`, declared |
| `isDesktopOnly` | `false` |
| License | MIT |
| Entry | `src/app/main.ts`, built into the committed `main.js` |
| Styles | one committed `styles.css`, joined from the author files listed in `src/styles.json` |
| Native helper | `native/pty-server` (`nand-pty`), built by CI and shipped as release assets |
| Interface languages | Simplified Chinese (`zh`) and English (`en`) |

## Views and entry points

- Two view types are registered: `nand-workbench-view` (the workbench) and `nand-comments-view` (the comments side panel).
- The ribbon has one entry, which opens the workbench. The `open-workbench` command does the same.
- The shell also provides commands to open the browser, automations, notifications and archives, to create an automation, to cycle the theme preset and to copy a note reference. Each module adds its own commands while it is active.
- Settings are pages of the workbench (General, Appearance, one page per enabled product, About). Obsidian's settings tab keeps an entry that opens them.

## Modules

`src/app/manifests.ts` lists nine modules. Each has a data-only manifest and a lazy entry.

| Module | Order | Platforms | Default | Activation | Feature(s) in the workbench |
|---|---:|---|---|---|---|
| `browser` | 10 | desktop, mobile | on | startup | `browser` (pages need Electron, desktop only) |
| `home` | 20 | desktop, mobile | on | startup | `dashboard`, `records` |
| `comments` | 30 | desktop, mobile | on | startup | `comments`; editor extension; side panel |
| `archives` | 40 | desktop, mobile | on | startup | `contacts` |
| `agent` | 50 | desktop | on | startup | `terminal` |
| `icons` | 60 | desktop, mobile | on | startup | `icons` |
| `notifications` | 70 | desktop, mobile | on | startup | `notifications` (bottom of the rail) |
| `automations` | 80 | desktop, mobile | on | startup | `automations` |
| `sync` | 90 | desktop | off | layout-ready | `sync` |

The `settings` feature belongs to the app. The `records` feature (habits, expenses, pomodoro, reading) is a child of `dashboard` on the rail.

Services and contribution points that cross modules: `agent.sessions`, `agent.workbench`, `agent.automation-runtime`, `automations.ui`, `automations.sources`, `browser.open`, `browser.agent-bridge`, `comments.panel`, `comments.index`, `home.workbench`, `notifications.inbox`, `notifications.openers`, `sync.workbench`.

## Settings and data locations

Settings are namespaces (`app`, `theme`, and one per module that has settings) stored in two files: `.nand/config/settings.json` (vault scope) and `.nand/config/devices/<device-id>.json` (device scope). See [ADR-0003](../adr/0003-namespaced-settings-store.md).

| Data | Location |
|---|---|
| Comment threads | `.nand/editor/comments/` |
| Icon rules and preferences | `.nand/icons/iconic.json` with rotating backups |
| Automation run records | `.nand/automation/<device-id>/runtime.json` |
| Automation definitions | `NAND/自动化/` (Markdown), plus the documents of boards and archives |
| Notification inbox and receipts | `.nand/notifications/<device-id>/inbox.json` |
| Agent history labels, caches | `.nand/terminal-agent/<device-id>/` (`index.sqlite` is a rebuildable cache) |
| Browser history and site permissions | `.nand/browser/<device-id>/state.json` |
| Recovery drafts, board backups and conflicts | `.nand/recovery/` |
| Caches | `.nand/cache/` |
| Records | `NAND/习惯/`, `NAND/记账/`, `NAND/番茄钟/`, `NAND/阅读/` (Markdown) |
| Archives | the configured folder (default `档案`), with `个人档案/<name>/基本信息.md` and `企业档案/<name>/基本信息.md` |
| Agent session exports | `NAND Exports/` |
| Git sync clock and pause state | `<git dir>/nand-sync.json`, never committed |
| Terminal helper binary | `<plugin folder>/binaries/` |

Boards are the notes the user selects. Obsidian Sync does not sync dot-folders, so `.nand/` needs Git or another tool that copies hidden folders.

## Size budgets

`scripts/bundle-budget.json` holds the ceilings; `pnpm run check:bundle` compares the build with them and fails when one is exceeded.

| Budget | Ceiling |
|---|---|
| Code evaluated at startup | 120 KiB |
| `main.js` | 3.75 MiB (3,932,160 bytes) |
| `styles.css` | 720 KiB (737,280 bytes) |
| Activation of `home` | 450 KiB |
| Activation of `agent` | 1,126 KiB |
| Activation of `browser` | 250 KiB |
| Activation of `archives`, `automations`, `icons` | 220 KiB each |
| Activation of `sync` | 150 KiB |
| Activation of `comments` | 120 KiB |
| Activation of `notifications` | 40 KiB |

The startup set may not contain `lunar-typescript`, `chart.js`, `@xterm/xterm`, `@xterm/headless` or `simple-icons`. When this baseline was written, the startup set measured 94 KiB; the ceilings leave little room for `main.js`, so growth needs a recorded reason.

## Gates

| Command | What it enforces |
|---|---|
| `pnpm run build` | Type check of source and tests, style file check, production build of `main.js` |
| `pnpm run lint` | ESLint with zero warnings |
| `pnpm run lint:css` | stylelint with a shrink-only baseline of files (`scripts/stylelint-baseline.json`) |
| `pnpm test:architecture` | Zone import matrix, host packages, desktop-only code, barrels and runtime cycles; no baseline |
| `pnpm run check:bundle` | Startup, per-module and total budgets |
| `pnpm test` | Vitest unit, DOM and user-format golden tests (`test/golden`) |
| `pnpm test:i18n` | Key parity between `zh` and `en`, placeholders, unknown keys |
| `pnpm test:docs` | Documentation inventory, links, anchors, SpecDev status index |
| `pnpm run test:all` | Every `test:*` script |
| `pnpm run check:notices` | `THIRD-PARTY-NOTICES.md` matches the bundle and the crate graph |
| `pnpm run check:native` | `cargo test --locked` for the terminal helper |
| `node scripts/verify-pty-helper.mjs <binary>` | The built helper over stdio: sessions, flow control, exit on stdin close |
| `node scripts/verify-release-artifacts.mjs <version>` | Version, changelog and release file consistency |
| `scripts/obsidian-acceptance/` | A real Obsidian instance driven over the debugging port, in a disposable vault |

## Continuous integration and release

- `.github/workflows/lint.yml` runs on every push and pull request. Linux (Node 22 and 24) installs with a frozen lockfile and runs build, `check:bundle`, a check that the rebuilt `main.js` equals the committed one, lint, `lint:css`, `test:all`, `check:notices` and `check:native`. Windows (Node 24) runs build, the `main.js` check, lint, `lint:css` and `test:all`.
- `.github/workflows/terminal-build.yml` tests and builds the helper for linux-x64, linux-arm64, darwin-x64, darwin-arm64 and win32-x64, and runs `scripts/verify-pty-helper.mjs` on each.
- `.github/workflows/release.yml` runs when a tag is pushed. It builds the helpers, checks the tag against `manifest.json`, `package.json`, `versions.json` and `CHANGELOG.md`, rebuilds, checks that `main.js` and `styles.css` equal the committed files, and creates the release with the plugin files, a zip, the helpers with their `.sha256` files, `SHA256SUMS.txt`, `LICENSE`, `NOTICE` and `THIRD-PARTY-NOTICES.md`. A tag with a pre-release suffix becomes a pre-release.

## Terminal helper

Protocol version 3. Frames are a 4-byte big-endian length, a 1-byte kind (control JSON, session input, session output) and the body, up to 16 MiB. The helper pauses reading a session when more than 1 MiB of output is unacknowledged and resumes below 256 KiB. The plugin downloads `nand-pty-<platform>-<arch>[.exe]` from the release with its own version, checks its SHA-256 and runs it. `NAND_PTY_BINARY` points development runs at a local build. See [ADR-0008](../adr/0008-terminal-helper.md).
