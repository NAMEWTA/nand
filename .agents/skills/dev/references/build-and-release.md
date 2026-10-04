# Build, test, and release

The commands to run before finishing an edit are in SKILL.md. This file is what those scripts do, which test to pick, and how a version becomes a GitHub release.

## Scripts

| Script | What it does |
|---|---|
| `dev` | esbuild watch, inline sourcemap, no minify |
| `build` | `tsc -noEmit -skipLibCheck`, then esbuild production. Writes the repo-root `main.js` |
| `lint` | `eslint .` |
| `test:all` | All discovered test scripts, including browser and fault-injection/storage regressions |
| `test:reliability` | Read/write failures, conflicts, Markdown fidelity, cancellation, action documents, DST and 10,000 records |
| `test:i18n` | Paired Chinese/English keys, interpolation parameters and literal translation references |
| `test:docs` | Current Markdown links, code fences and SpecDev active/archive indexes |

`main.js` is committed. A source change that is not rebuilt ships the old bundle to anyone who installs from the repo. Commit the rebuilt file with the source.

The package manager is pnpm. `package.json` pins `packageManager`. The lockfile is `pnpm-lock.yaml`. CI runs `pnpm install --frozen-lockfile`.

`pnpm.peerDependencyRules.allowedVersions` allows two mismatches that an older npm install ignored. Leave them unless the task is the dependency bump:

- `eslint-plugin-obsidianmd` peers an older `obsidian` than this repo's type package (`obsidian` 1.13.1). The manifest `minAppVersion` stays the identity-table value.
- `@xterm/addon-canvas` peers `@xterm/xterm` 5. This repo depends on `@xterm/xterm` 6.

`pnpm run format` rewrites every file under `src/` and `scripts/` and is not part of CI. Run it only when the task is a format change.

## Esbuild

`esbuild.config.mjs`:

- One entry, the path in the SKILL identity table. Format `cjs`, target `es2021`. Production minifies and drops the sourcemap.
- Externals: `obsidian`, `electron`, `@codemirror/*`, `@lezer/*`, Node builtins.
- `ws` resolves to `node_modules/ws/wrapper.mjs`.
- `.md` and `.svg` load as text.
- The generated banner embeds `src/core/icons/res/NOTICE.txt` so upstream and resource licenses ship in the existing three-file release.

Do not add a second entry. Do not bundle CodeMirror.

## Tests

`test:build-text` verifies identical `.md`/`.svg` text-loader output for LF and CRLF fixtures and normalized license banners. Production builds use `scripts/build-text-resources.mjs`; do not normalize a user's existing files. Linux and Windows CI run this check and `test:issue-regressions`, then require the rebuilt `main.js` to match the committed artifact. Rebuild and include `main.js` with source changes.

`pnpm run test:all` discovers and runs every `test:*` script except itself, including browser and reliability regressions. CI (`.github/workflows/lint.yml`) runs this aggregate, build and lint on Linux Node 22/24 and Windows Node 24. New test entries automatically enter the gate. The terminal workflow uses the MSVC target on Windows and the existing Linux/macOS matrix; Windows additionally runs real ConPTY/Job integration. There is no Obsidian runtime in CI. Name the script you ran; a passing build does not verify UI.

A `*.test.ts` file runs when a script names it, or when it is under one of the roots discovered by `scripts/run-terminal-tests.mjs`. `scripts/verify-*.ts` files are wired as `test:<name>`:

```sh
esbuild scripts/verify-foo.ts --bundle --platform=node --format=cjs \
  --outfile=node_modules/.tmp/verify-foo.cjs \
  --alias:obsidian=./scripts/obsidian-stub.ts \
  && node node_modules/.tmp/verify-foo.cjs
```

Copy the nearest script, including extra aliases such as the music stubs. Do not add a Jest runner.

| When you change… | Run |
|---|---|
| Comment composer, language subscriptions, dashboard persistence | `pnpm run test:issue-regressions` |
| Comment anchors, the comment store, or comment panel | `pnpm run test:editor-comments` |
| Attachment paths, timestamped names, import queue, relative links or relocation decisions | `pnpm run test:editor-attachments`; core tests do not establish Obsidian integration |
| Automation scheduler, notification delivery, native hooks or reminder metadata | `pnpm run test:automation`; for Rust/PTTY changes also `cargo test --manifest-path processes/rust-terminal-servers/Cargo.toml` and `node scripts/verify-pty-automation.mjs` against a local release build (Linux) |
| Promise callback handling of Obsidian controls | `pnpm run test:promise-callbacks` (run separately from lint: it creates then removes a temporary typed fixture under src) |
| Terminal agent behavior covered by its `*.test.ts` files | `pnpm run test:terminal-agent` |
| Module lifecycle, settings navigation or global language | `pnpm run test:settings-nav` (including serialized language saves and searchable Home) and `pnpm test:i18n` |
| Archive model, Markdown format, index or controller | `pnpm run test:contacts`; see Archives checks below |
| Icon rules, lifecycle, settings or persistence | `pnpm run test:iconic-port`, plus `test:settings-nav` for shell changes |
| Source moves, ports, dependency direction or composition | `pnpm test:architecture`, `pnpm test:panel-composition`, `pnpm test:dashboard-isolation` |
| Dashboard Preact cards, media decoder lifetime, ledger state or query refresh | `pnpm test:card-panels` (real Preact DOM: nesting/edit cancellation, drag rollback, Markdown races, shared subscriptions, video cleanup, ledger state, query refresh) |
| A dashboard behavior that already has a verify script | the matching `test:*` in `package.json` |

`test:terminal-agent`, `test:settings-nav` and `test:editor-attachments` use:

```sh
node --experimental-strip-types --import ./scripts/register-ts-hooks.mjs --test <paths>
```

New Node tests use that same runner. Verify scripts are excluded from eslint. `tsconfig.json` includes `scripts/**/*.ts`, excludes `**/*.test.ts`, and targets ES6, so a verify script cannot use top-level await. Wrap the body in `async function main()`.

`test:editor-comments` bundles against `scripts/obsidian-stub.ts`. The bundle's `__dirname` is `node_modules/.tmp`; resolve the repo with `process.cwd()`. What the script asserts is in `references/editor-comments.md`.

## Storage and lifecycle regressions

`pnpm run test:safety-regressions` exercises dashboard write conflicts, DST repeated hours, empty automation targets, native-session launch reservations, and terminal server startup/shutdown with deterministic fixtures and an owned Node child. The native fixture verifies Windows SIGTERM termination and POSIX SIGTERM resistance followed by SIGKILL, confirming actual process exit on both. It is included in CI. Comment read/write failure and journal recovery cases run in `test:editor-comments`.

`test:automation` and `test:iconic-port` use `scripts/run-node-with-tz.mjs` to set the child Node process's timezone on Windows and POSIX. They use `America/New_York` and `UTC` respectively; the caller's environment is unchanged. The automation preflight fixture isolates installed CLI wrappers, including Windows `PATHEXT` suffixes and case differences.

## Lint

`eslint.config.mts` spreads `obsidianmd.configs.recommended` and type-aware TypeScript eslint. Ignored: `node_modules`, `dist`, the esbuild and eslint configs, `version-bump.mjs`, `versions.json`, `main.js`, `scripts/**`, `**/*.test.ts`. Rule severity for production `src/**/*.ts` is in `references/obsidian-api.md`. Warnings do not fail CI. Do not add new warnings.

## Version bump

Do not run `pnpm run version`. That script calls `version-bump.mjs`, which is not in the repo.

Bump these together, or do not release:

| File | What |
|---|---|
| `manifest.json` `version` | the tag, with no `v` prefix |
| `package.json` `version` | the same string |
| `versions.json` | `"<version>": "<minAppVersion>"` using the identity-table `minAppVersion`, unless that value actually changes |
| `CHANGELOG.md` | newest section on top |
| `README.md` | only when user-facing behavior changed |

Raising `minAppVersion` drops users. Keep the settings fallback described in `references/obsidian-api.md` if you ever do. The tag must point at the commit whose `manifest.json` version equals the tag. Do not let a version tool create the tag before `main.js` and the changelog are in that commit.

## Release

`.github/workflows/release.yml` runs on any tag push:

1. `pnpm install --frozen-lockfile`
2. Validate tag, manifest/package versions and compatibility entry with `scripts/verify-release-artifacts.mjs`, then `pnpm run build`
3. Zip `dist/<id>/{main.js,manifest.json,styles.css}` as `<id>-<version>.zip`
4. Attest the zip
5. Wait for `terminal-build.yml`, which builds and tests Linux x64/arm64, macOS x64/arm64 and Windows x64 from the same source commit; download the binaries plus SHA256 artifacts
6. Validate all five binary/checksum pairs with `scripts/verify-release-artifacts.mjs` and exercise the packaged Linux binary through `scripts/verify-pty-automation.mjs`
7. `softprops/action-gh-release` with generated notes, attaching the zip and `terminal-artifacts/*` (never stale checked-in binaries)

Push `main`, then push the tag. That workflow is the only release creator. Leave the attestation step and the terminal-binary upload in place.

`lint.yml` annotates warnings. It does not fail on them.

After a release, do not amend or force-push that commit.

## Commit shape

Match the log: one short imperative sentence, then a blank line and a short body when the reason is not obvious.

- Structure-only moves stay in their own commit.
- A feature commit may include the version bump when the task is to ship it.
- Do not commit `node_modules/.tmp` or local editor files.

## Pre-release checklist

- [ ] `manifest.json`, `package.json`, and `versions.json` agree
- [ ] `CHANGELOG.md` describes the user-visible change
- [ ] `pnpm run build` and `pnpm run lint` succeed
- [ ] The verify script for the area you touched succeeds
- [ ] `main.js` is in the commit
- [ ] The tag equals `manifest.version`
- [ ] `release.yml` is left to create the GitHub release
- [ ] The terminal binary upload step is still in the workflow if you edited it

## Browser checks

`browser-dashboard.mjs` uses the same opt-in and Vault marker to create an isolated board fixture, exercise the native shortcut form, verify Markdown persistence, open the default modal and change/reload the target as a native tab. It restores the previous workspace registry and retains its generated fixture for inspection.

`browser-restart.mjs` uses the same explicit opt-in and marker, additionally pinning this repository's isolated profile path before quitting/relaunching the test app. It verifies native workspace, persistent Cookie, zoom and scroll after restart; it must not run alongside any other GUI acceptance.

`pnpm run test:browser` covers URL rules, local history bounds, shortcut Markdown round trips, serialized cancellation, snapshot/iframe refs, debugger ownership, markup geometry, safe unsent material and authenticated CLI isolation. Run build/lint, architecture, panel composition, dashboard isolation, card panels/move, web sections, settings navigation, mobile stability and terminal-agent regression when changing browser integration.

`scripts/obsidian-acceptance/browser.mjs` uses a controlled local website in an explicitly marked isolated Vault. It requires `NAND_ALLOW_BROWSER_E2E=1`, `NAND_WINDOWS_E2E_NONCE` matching `.nand-e2e-isolated.json` and absolute `NAND_ACCEPTANCE_DIR`. Run serially with other GUI acceptance. It checks real webview/CDP operations, cross-origin frames, native login opener/Cookies, modal-to-tab, screenshots/Design Mode, local CLI, download progress, DevTools, split/duplicate/popout/restore and guest cleanup. The download test supplies its own save destination; it does not automate the operating-system save dialog. Compiled tests do not establish minimum-version, macOS/Linux or physical phone/IME compatibility.

## Archives checks

`pnpm run test:contacts` bundles `scripts/verify-contacts.ts` into ignored `scripts/tmp/` and runs Node's tests. It covers Markdown round trips, unknown content preservation, write conflicts, malformed documents, stable IDs, relationships, company counts, 5,000-record filtering, and mocked-vault create/save/delete/rebuild/folder switching. It also checks native-editor draft protection, inverse relationship deduplication, generated versus customized headings, strict folder-entry recognition, safe/colliding directory names, recursive resources and 60-item pagination, partial binary imports, metadata-only events, stable-ID folder renames and whole-folder deletion scope/queue protection. Opt-in desktop acceptance is in `scripts/obsidian-acceptance/contacts-folders.mjs` and `contacts-lifecycle.mjs`; both require the isolated Vault marker and explicit environment flags. Run `test:settings-nav` and `test:mobile-stability` for archive shell changes too; the latter is shared/dashboard regression coverage, not archive phone UI verification. Current Obsidian checks and their explicit limits are listed in [current verification baseline](../../../../speculo/.speculo/specdev/archive/2026-10/2026-10-01-current-baseline/README.md).

The archives leaf introduces Preact: `tsconfig` includes `.tsx`, JSX uses `preact`, and esbuild aliases React compatibility imports to Preact. The existing typed eslint configuration covers both `.ts` and `.tsx`. `src/core/contacts/persist/format-guide.md` is a runtime text asset: rebuild `main.js` when it changes.

## Icons checks

`test:iconic-port` bundles with `scripts/iconic-obsidian-stub.ts` and runs in UTC. Its fixed 1.1.10 fixture contains outputs produced by the original RuleManager, defaults, commands, locale values and resource hashes. Text-resource hash checks normalize only CRLF to LF, verify both checkout forms, and retain the immutable upstream hashes. It also checks isolated persistence, backup recovery, external reload and patch restoration. The oracle lives in `scripts/fixtures/iconic/upstream-1.1.10.json`; its README records provenance. Do not generate expected rule outputs from the migrated implementation. See [current verification baseline](../../../../speculo/.speculo/specdev/archive/2026-10/2026-10-01-current-baseline/README.md) for desktop checks and platform limits.

For changes to icon settings, verify that every declaration routes persistence through the icon controller rather than a shell `control.key`. For lifecycle/CSS changes, check disabled-state cleanup and both main and floating windows; body state classes must remain on the same element as the module gate. Automated stubs do not replace those desktop checks.


## Native history checks

History protocol/parser changes require `cargo test --locked --manifest-path processes/rust-terminal-servers/Cargo.toml`, a matching local release binary, and `node scripts/verify-pty-automation.mjs`. The Linux integration script covers concurrent history scan and PTY initialization, paged query, cancellation, real exit status and process-tree shutdown. Rust fixtures cover full transcripts, scope, account identity, OpenCode SQLite, Gemini JSONL ownership, Grok companion-file changes, metadata filters and usage deduplication. `test:terminal-agent` executes the generated Pi/OpenCode extensions against an isolated event spool.

Native history query/refresh/cache changes also use the `native-history.test.ts` and `usage-cache.test.ts` fixtures discovered by `test:terminal-agent`. Rust tests cover legacy-index migration rollback, summary-only SQL pagination/aggregation, independent WAL readers during a write batch and cancellation before queued scans execute. `node scripts/benchmark-native-history.mjs <local-release-binary> <ignored-evidence-directory>` creates isolated legacy indexes containing 500, 5000 and 20000 generated 10KB transcripts; it records cold migration and 20 warm query samples (p50/p95), request/response JSON bytes and native selected-data parse bytes. It never reads provider credentials or existing sessions. Generated data is retained in the supplied evidence directory, and the benchmark closes its owned server.

The Rust service now bundles SQLite through rusqlite; rebuild platform binaries from the same commit as main.js. Do not ship an earlier service with the new agent_data protocol. The release workflow builds five target binaries; local Linux success does not verify macOS/Windows execution or authenticated provider quota APIs.

On Windows, use the installed MSVC toolchain to run locked Rust tests and a matching release build, then run `node scripts/verify-pty-windows.mjs <release-binary.exe>` with Node 24. The native build workflow runs this integration on its Windows target without changing the five release artifact paths. It checks ConPTY device replies, complete output before one real exit event, UTF-8/cwd/env, rapid launch admission, Ctrl+C shell continuity, per-session Job ownership, repeated destroy, startup failure, client disconnect, server termination/restart, and concurrent native history/read/cancellation. Set `NAND_PTY_WINDOWS_ARTIFACT_DIR` to retain isolated fixtures and summarized evidence; otherwise successful runs clean their own temporary fixture. Only fixture-owned process identities are eligible for cleanup.

Obsidian 的外置 Node 模块必须在 desktop guard 后使用 `window.require`；esbuild external 的 `import('node:…')` 在渲染进程中可能无法解析。Node 单测与 tsc 不会捕获这一点，历史／hook 加载改动要在真实 Obsidian 中打开工作台验证。

Manual Obsidian issue acceptance: `node scripts/obsidian-acceptance/run.mjs` requires an isolated vault and CDP. See [current verification baseline](../../../../speculo/.speculo/specdev/archive/2026-10/2026-10-01-current-baseline/README.md) for setup, mutations and platform coverage.

The October issue follow-ups use `issue-ui.mjs` (native widget dialogs, keyboard/date/save/cancel, 84-day heatmaps, both settings renderers, automation spacing), `issue-terminal.mjs` (same-name identity/search and real clipboard success plus injected failure), and `issue-titles.mjs` (six deferred view types in two windows). These require the isolated Windows marker and explicit opt-in; UI/terminal checks additionally require the expected deployed main hash. Titles writes `restart-state.json`; run it again with `--verify-restart` after restarting only the owned isolated app. It temporarily disables the terminal module and retains prepared leaves for that restart check. Restore the fixture module flag after verification. `colors.mjs` checks all 13 presets in both modes, four timer states and four custom accents. Run GUI scripts serially and keep their screenshots/JSON in separate `NAND_ACCEPTANCE_DIR` directories. Minimum-version fallback rendering in 1.13 is not an actual Obsidian 1.12 execution claim.

Windows real-app terminal acceptance uses `node scripts/obsidian-acceptance/windows.mjs`. It requires `NAND_ALLOW_WINDOWS_E2E=1`, `NAND_WINDOWS_E2E_NONCE` matching the actual vault's `.nand-e2e-isolated.json` marker (`kind: nand-windows-e2e`, nonce and absolute vaultPath), and an absolute `NAND_ACCEPTANCE_DIR`. Deploy matching local binaries in offline mode, disable authenticated agents, and start with no existing terminal sessions. The script checks real shell exit, visible close/reopen, xterm Ctrl+C, and owned-child cleanup; it never creates a marker in a daily vault. The shared terminal layout acceptance scopes text checks to its workbench, and lifecycle acceptance waits up to 15 seconds for actual reconnection while retaining process/session/output assertions.

`node scripts/obsidian-acceptance/language.mjs` uses the same marker, opt-in flags and absolute evidence directory. Set `NAND_EXPECT_MAIN_SHA` to the deployed bundle hash. Its 12 cases cover both Home renderers, failed saves, drafts and focus, mounted dashboard inputs, native modal labels, PTY/guest identity, popouts and reload. It reads the runtime version from the user agent, uses an owned PowerShell and localhost page, restores fixture preferences and closes its own leaves. The all-modules case hides the settings gates; it does not claim a full native shutdown matrix. Screenshots and JSON belong in the current baseline, never in a daily Vault.

The workbench acceptance scripts share `terminal-fixture.mjs` and must run serially under one GUI owner, with separate evidence directories and `NAND_EXPECT_MAIN_SHA` matching the deployed build. `terminal.mjs` checks the filled 16-case width/theme/language matrix and drawer keyboard behavior; `terminal-history-flows.mjs` checks pagination, explicit refresh, two native windows, metadata, export, theme propagation and duplicate Resume using a generated CLI substitute. `terminal-session-flows.mjs` exercises real shell input, UI routing, hidden long output, scrolling and client-WebSocket recovery. The current disconnect policy creates a new native PTY while retaining the logical page; do not describe this as preserving the original process. `terminal-performance.mjs` measures 1/10/30 real idle shells plus synthetic headless VT traffic, with a visible-window guard; `NAND_PERF_EXPECT_OPTIMIZED=1` enforces the switch/subscription/WebGL limits. These scripts never invoke authenticated providers and do not replace the locked native regression suites.

`terminal-restart.mjs` additionally pins this task's profile/vault, validates the main PID/executable/creation time and isolated environment, and quits the owned app normally. It relaunches using PowerShell `Start-Process -WindowStyle Hidden` with child-only environment values. Its first invocation reports `checksPassed`; only a later, independent command using `--verify-after-return` can set complete `passed` after verifying that the restarted app, artifact hashes and daily configuration remain valid. See the [current verification baseline](../../../../speculo/.speculo/specdev/archive/2026-10/2026-10-01-current-baseline/README.md) for evidence and limitations. Committed-text/paste events do not verify the OS IME candidate window or system clipboard.
