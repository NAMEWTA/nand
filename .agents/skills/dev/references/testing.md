English | [简体中文](testing.ZH.md)

# Testing

Name the tests you ran when you report. A passing build does not verify UI; only the real-Obsidian probe does.

## Layers

| Layer | Where | Run |
|---|---|---|
| Unit and DOM tests | co-located `src/**/*.test.ts(x)`, `test/**/*.test.ts` | `pnpm test` (vitest, `vitest.config.ts`) |
| User-format golden samples | `test/golden/user-formats.test.ts` + `__snapshots__/` | part of `pnpm test` |
| Verify scripts | `scripts/verify-*.ts`, wired as `test:<name>` in `package.json` | `pnpm run test:<name>` |
| Gate scripts | architecture, i18n, docs, styles, promise callbacks, workbench entry, build text | `pnpm test:architecture`, `test:i18n`, `test:docs`, `test:styles`, … |
| Everything above | every `test:*` script except itself | `pnpm run test:all` |
| Rust helper | `native/pty-server/tests`, unit tests | `pnpm run check:native` (`cargo test --locked`) |
| Real Obsidian | `scripts/obsidian-acceptance/` (CDP against a disposable vault) | see below |

## Vitest

Two projects: `unit` (Obsidian aliased to `scripts/obsidian-stub.ts`, node environment) and `settings-iconic` (the two tests listed in `vitest.config.ts`, aliased to `scripts/iconic-obsidian-stub.ts`). The setup file `scripts/module-strings.ts` registers module and lazy dictionaries, so components render real strings. `.svg` and `.md` imports load as text, like the bundle.

New tests are co-located `*.test.ts` files that import `test`/`vi` from `vitest`, not new verify scripts. Tests are type-checked by `tsconfig.test.json` during `pnpm run build`. Pin time zones or clocks the test depends on (`vi.useFakeTimers({ now, toFake: ['Date'] })`).

## Golden samples

`test/golden/user-formats.test.ts` writes boards, archives, automation definitions and the habit, expense, reading and pomodoro documents through production code and compares the bytes with `__snapshots__/`, then reads them back. A refactor must leave the snapshots unchanged. If a format change is the task, update with `pnpm vitest run test/golden -u` and review the diff. Comment sidecars are locked by the comments tests and `iconic.json` by the Iconic port tests.

`.gitattributes` keeps the golden fixtures in LF on every platform so checkout settings cannot change the bytes being asserted.

## Which test for which change

| You changed | Run |
|---|---|
| Module lifecycle, registry, commands, settings store, language | `pnpm test` (registry, settings and language tests) and `pnpm test:i18n` |
| Imports, file moves, startup code | `pnpm test:architecture`, `pnpm run check:bundle` |
| A string | `pnpm test:i18n` |
| CSS | `pnpm run lint:css`, `pnpm test:styles` (after `node scripts/build-styles.mjs --write`) |
| Comments | `pnpm test` (`src/modules/comments/comments.test.ts`, which imports `scripts/verify-comment-*.ts`) |
| Board parsing, widgets, records | `pnpm test` plus the board `test:*` scripts that match the feature name |
| Automations, notifications | `pnpm test` (automation and notification suites), `pnpm run test:safety-regressions` |
| Archives | `pnpm test` (`src/modules/archives/archives.test.ts`); scale: `pnpm run accept:contacts-scale` |
| Icons | `pnpm test` (Iconic oracle in `src/modules/icons/iconic-port.test.ts`) |
| Git sync | `pnpm test` (`src/modules/sync`, `test/sync/git-flow.test.ts`, which runs the system git against a temporary remote) |
| Terminal model, keyboard, presentation | `pnpm test` (`src/modules/agent/**`); the Rust helper: `pnpm run check:native` and `node scripts/verify-pty-helper.mjs <binary>` |
| Version bump, release files | `pnpm test` (`test/release/release-artifacts.test.ts`) and `node scripts/verify-release-artifacts.mjs <version>` |
| Docs or skills | `pnpm test:docs` |
| Workbench, pages, settings UI, terminal UI, browser | the real-Obsidian probe |

## Real-Obsidian probe

`scripts/obsidian-acceptance/workbench-fresh-runtime.mjs` creates a disposable vault and profile, starts Obsidian with remote debugging, installs the built plugin and runs `workbench-probe.mjs`, then restarts Obsidian and runs it again with `--verify-restart`. The probe covers the workbench layout at several widths, every rail page, settings pages, module switches, archives editing, comments, browser tabs, focus mode, records pages, the terminal through a real `nand-pty`, Git sync, and route restore after restart. Evidence (JSON and screenshots) goes to `<root>/evidence/`.

```sh
pnpm run build
cargo build --release --manifest-path native/pty-server/Cargo.toml
NAND_PTY_BINARY=$PWD/native/pty-server/target/release/nand-pty \
NAND_ALLOW_FRESH_ISSUE_FIXTURE=1 NAND_FRESH_FIXTURE_ROOT=/tmp/nand-probe-<name> \
NAND_OBSIDIAN_EXECUTABLE=/opt/Obsidian/obsidian \
xvfb-run -a -s "-screen 0 1600x1100x24" node scripts/obsidian-acceptance/workbench-fresh-runtime.mjs
```

Use a new root each run; it must not exist yet. `NAND_PTY_BINARY` makes the plugin use a local helper instead of downloading the release asset. `theme-matrix.mjs` takes screenshots of the theme presets in reading, live preview and source modes. Keep the evidence you cite; temporary directories are cleaned.

CI has no Obsidian runtime; Windows and macOS terminal behavior (ConPTY, IME, CLI agents) is checked on real machines, and what has and has not been verified is recorded in `speculo/.speculo/specdev/context/validation.md`.
