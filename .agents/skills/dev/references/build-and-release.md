# Build, test, and release

The commands to run before finishing an edit are in SKILL.md. This file is what those scripts do, which test to pick, and how a version becomes a GitHub release.

## Scripts

| Script | What it does |
|---|---|
| `dev` | esbuild watch, inline sourcemap, no minify |
| `build` | `tsc -noEmit -skipLibCheck`, then esbuild production. Writes the repo-root `main.js` |
| `lint` | `eslint .` |

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

There is no aggregate test script. CI (`.github/workflows/lint.yml`) runs `build` and `lint` on Linux Node 22/24 and Windows Node 24 for every branch push. pnpm 11 needs Node 22.13 or newer, so the release workflow uses Node 22 as well. Linux also runs architecture, automation, terminal, contacts, icon, editor-comment and panel-composition/dashboard-isolation/card-panels tests. The Windows job checks automation, safety regressions, contacts and icons with CRLF checkout enabled for that job, without changing the machine's Git configuration. Other dashboard regression scripts remain local. There is no Obsidian runtime in CI. Name the script you ran; a passing `build` does not verify UI.

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
| Automation scheduler, notification delivery, native hooks or reminder metadata | `pnpm run test:automation`; for Rust/PTTY changes also `cargo test --manifest-path processes/rust-terminal-servers/Cargo.toml` and `node scripts/verify-pty-automation.mjs` against a local release build (Linux) |
| Promise callback handling of Obsidian controls | `pnpm run test:promise-callbacks` (run separately from lint: it creates then removes a temporary typed fixture under src) |
| Terminal agent behavior covered by its `*.test.ts` files | `pnpm run test:terminal-agent` |
| Module lifecycle (`src/plugin/module-lifecycle.test.ts`), settings navigation, or settings CSS | `pnpm run test:settings-nav` |
| Archive model, Markdown format, index or controller | `pnpm run test:contacts`; see Archives checks below |
| Icon rules, lifecycle, settings or persistence | `pnpm run test:iconic-port`, plus `test:settings-nav` for shell changes |
| Source moves, ports, dependency direction or composition | `pnpm test:architecture`, `pnpm test:panel-composition`, `pnpm test:dashboard-isolation` |
| Dashboard Preact cards, media decoder lifetime, ledger state or query refresh | `pnpm test:card-panels` (real Preact DOM: nesting/edit cancellation, drag rollback, Markdown races, shared subscriptions, video cleanup, ledger state, query refresh) |
| A dashboard behavior that already has a verify script | the matching `test:*` in `package.json` |

`test:terminal-agent` and `test:settings-nav` use:

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

## Archives checks

`pnpm run test:contacts` bundles `scripts/verify-contacts.ts` into ignored `scripts/tmp/` and runs Node's tests. It covers Markdown round trips, unknown content preservation, write conflicts, malformed documents, stable IDs, relationships, company counts, 5,000-record filtering, and mocked-vault create/save/delete/rebuild/folder switching. It also checks native-editor draft protection, inverse relationship deduplication, and generated versus customized headings. Run `test:settings-nav` and `test:mobile-stability` for archive shell changes too; the latter is shared/dashboard regression coverage, not archive phone UI verification. Dated Obsidian checks (not a current pass claim) are listed in [the archived contacts checklist](../../../../speculo/.speculo/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/contacts-development.md).

The archives leaf introduces Preact: `tsconfig` includes `.tsx`, JSX uses `preact`, and esbuild aliases React compatibility imports to Preact. The existing typed eslint configuration covers both `.ts` and `.tsx`. `src/core/contacts/persist/format-guide.md` is a runtime text asset: rebuild `main.js` when it changes.

## Icons checks

`test:iconic-port` bundles with `scripts/iconic-obsidian-stub.ts` and runs in UTC. Its fixed 1.1.10 fixture contains outputs produced by the original RuleManager, defaults, commands, locale values and resource hashes. Text-resource hash checks normalize only CRLF to LF, verify both checkout forms, and retain the immutable upstream hashes. It also checks isolated persistence, backup recovery, external reload and patch restoration. The oracle lives in `scripts/fixtures/iconic/upstream-1.1.10.json`; its README records provenance. Do not generate expected rule outputs from the migrated implementation. See [the archived port record](../../../../speculo/.speculo/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/iconic-port.md) for desktop checks and platform limits.

For changes to icon settings, verify that every declaration routes persistence through the icon controller rather than a shell `control.key`. For lifecycle/CSS changes, check disabled-state cleanup and both main and floating windows; body state classes must remain on the same element as the module gate. Automated stubs do not replace those desktop checks.


## Native history checks

History protocol/parser changes require `cargo test --locked --manifest-path processes/rust-terminal-servers/Cargo.toml`, a matching local release binary, and `node scripts/verify-pty-automation.mjs`. The Linux integration script covers concurrent history scan and PTY initialization, paged query, cancellation, real exit status and process-tree shutdown. Rust fixtures cover full transcripts, scope, account identity, OpenCode SQLite, Gemini JSONL ownership, Grok companion-file changes, metadata filters and usage deduplication. `test:terminal-agent` executes the generated Pi/OpenCode extensions against an isolated event spool.

The Rust service now bundles SQLite through rusqlite; rebuild platform binaries from the same commit as main.js. Do not ship an earlier service with the new agent_data protocol. The release workflow builds five target binaries; local Linux success does not verify macOS/Windows execution or authenticated provider quota APIs.

On Windows, use the installed MSVC toolchain to run locked Rust tests and a matching release build, then run `node scripts/verify-pty-windows.mjs <release-binary.exe>` with Node 24. The native build workflow runs this integration on its Windows target without changing the five release artifact paths. It checks ConPTY device replies, complete output before one real exit event, UTF-8/cwd/env, rapid launch admission, Ctrl+C shell continuity, per-session Job ownership, repeated destroy, startup failure, client disconnect, server termination/restart, and concurrent native history/read/cancellation. Set `NAND_PTY_WINDOWS_ARTIFACT_DIR` to retain isolated fixtures and summarized evidence; otherwise successful runs clean their own temporary fixture. Only fixture-owned process identities are eligible for cleanup.

Obsidian 的外置 Node 模块必须在 desktop guard 后使用 `window.require`；esbuild external 的 `import('node:…')` 在渲染进程中可能无法解析。Node 单测与 tsc 不会捕获这一点，历史／hook 加载改动要在真实 Obsidian 中打开工作台验证。

Manual Obsidian issue acceptance: `node scripts/obsidian-acceptance/run.mjs` requires an isolated vault and CDP. See [the repair record](../../../../docs/issue-fixes-2026-09-30.md) for setup, mutations and platform coverage.
