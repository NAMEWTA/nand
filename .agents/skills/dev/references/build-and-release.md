English | [简体中文](build-and-release.ZH.md)

# Build and release

## Scripts

| Script | What it does |
|---|---|
| `dev` | esbuild watch, inline sourcemap, no minify |
| `build` | `tsc` (source), `tsc -p tsconfig.test.json` (tests), `build-styles.mjs --check`, esbuild production → repo-root `main.js` |
| `lint` | ESLint with `--max-warnings 0` |
| `lint:css` | stylelint over `src/**/*.css` with a shrink-only file baseline (`scripts/stylelint-baseline.json`); new violations fail |
| `check:bundle` | startup set and per-module activation closures from the esbuild metafile, compared with `scripts/bundle-budget.json`; fails over budget (`--files` lists startup inputs) |
| `check:styles` | size, `!important`, literal colors, z-index and duplicate selectors report |
| `check:native` | `cargo test --locked` for `native/pty-server` |
| `check:notices` | `THIRD-PARTY-NOTICES.md` matches the bundle and crate graph (`pnpm run notices` rewrites it) |
| `check:similarity` | k-gram similarity of the tree against reference projects (`licensing.md`) |
| `format`, `format:check` | prettier over `src/**/*.{ts,tsx}` and `scripts/**/*.ts`; not part of CI |
| `test`, `test:*`, `test:all` | `testing.md` |

`main.js` and `styles.css` are committed. Rebuild and commit them with the source; CI fails when the rebuilt `main.js` differs.

## Styles

Edit the author file in its owner's `styles/` folder (`src/ui`, `src/theme`, `src/shell`, `src/app`, `src/modules/<id>`), keep its place in `src/styles.json`, then `node scripts/build-styles.mjs --write`. The order in `src/styles.json` is the cascade; do not sort by filename. CSS cannot load lazily (Obsidian allows one stylesheet), so module CSS is scoped to the module's classes or to body classes the module adds while active.

The styles builder normalizes CRLF to LF in every source, including package stylesheets. `--write` emits LF; `--check` also normalizes the checked-out `styles.css`, so Windows checkout settings do not affect the result.

## esbuild

`esbuild.config.mjs` uses `scripts/esbuild-options.mjs` (shared with `check:bundle` and `notices`): one entry (`src/app/main.ts`), CommonJS, ES2021, minified in production, `.md`/`.svg` as text, Preact aliased for `react`. Externals: `obsidian`, `electron`, `@codemirror/*`, `@lezer/*`, Node built-ins. The banner embeds `LICENSE`, `NOTICE`, the icon resource notices, the Orca license and the licenses of bundled packages. Do not add a second entry and do not bundle CodeMirror.

## Budgets

`scripts/bundle-budget.json`:

- `eagerBytes`: what runs at plugin load (120 KiB).
- `moduleActivationBytes`: what each module evaluates when it turns on (pages, settings pages and second-level `import()`s are excluded).
- `forbiddenEagerAreas`: libraries that must never be in the startup set.
- `outputBytes`, `stylesBytes`: ceilings on total `main.js` and `styles.css`. Lower them when code shrinks; never raise a budget without recording why.

## CI

`.github/workflows/lint.yml` on every push and PR: Linux (Node 22 and 24) runs install, build, `check:bundle`, `git diff --exit-code -- main.js`, lint, `lint:css`, `test:all`, `check:notices`, `check:native`; Windows (Node 24) runs build, the `main.js` diff, lint, `lint:css` and `test:all`. `.github/workflows/terminal-build.yml` builds and tests the helper for linux-x64, linux-arm64, darwin-x64, darwin-arm64 and win32-x64 and runs `scripts/verify-pty-helper.mjs` on each.

pnpm is pinned in `package.json`; CI uses `pnpm install --frozen-lockfile`.

## Version bump

Bump together, in one commit, or do not release:

| File | Change |
|---|---|
| `manifest.json` `version` | the new version, no `v` prefix |
| `package.json` `version` | the same |
| `versions.json` | `"<version>": "<minAppVersion>"` |
| `CHANGELOG.md`, `CHANGELOG.ZH.md` | a `## <version>` section in each, and no Unreleased section |
| `main.js` | rebuilt from that commit |

`scripts/verify-release-artifacts.mjs <version>` checks the first four against the tag, and fails when `CHANGELOG.md` has an `## Unreleased` section. Raising `minAppVersion` drops users; only do it with a recorded reason.

The current version is `0.0.1-alpha.1`, a pre-release. A tag with a suffix after `-` becomes a GitHub pre-release and is not marked latest.

## Release

Push `main`, then push the tag (`git tag <version> && git push origin <version>`). `.github/workflows/release.yml` is the only release creator:

1. Builds the helper for five targets (`terminal-build.yml`).
2. Verifies the tag against `manifest.json`, `package.json`, `versions.json` and `CHANGELOG.md`, builds, and fails if the built `main.js` or `styles.css` differs from the committed one.
3. Collects `main.js`, `manifest.json`, `styles.css` and `nand-<version>.zip`, checks them with `scripts/verify-release-artifacts.mjs --plugin`, and attests the zip, `main.js` and `styles.css`.
4. Verifies the five `nand-pty-<platform>-<arch>[.exe]` binaries against their `.sha256` files and runs the Linux one through `scripts/verify-pty-helper.mjs`.
5. Writes `SHA256SUMS.txt` for every asset and creates the GitHub release with the plugin files, zip, helpers, checksums, `LICENSE`, `NOTICE` and `THIRD-PARTY-NOTICES.md`.

Obsidian installs `main.js`, `manifest.json` and `styles.css` from the release. The plugin downloads the helper for the current platform from the release of its own version on first terminal use, checks its SHA-256 and stores it in the plugin folder (`NAND_PTY_BINARY` overrides it in development). Never commit helper binaries.
