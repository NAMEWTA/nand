English | [简体中文](validation.ZH.md)

# Validation

This document separates what is verified from what is only declared. An item is verified only when a command or a recorded run says so. The gates themselves are listed in the [current baseline](current-baseline.md).

## Verified by automated checks

These run in CI on every push and pull request (Linux with Node 22 and 24, plus Windows for build, lint and tests) and locally with the same commands:

- Type check, ESLint with zero warnings, stylelint with a shrink-only baseline.
- The architecture check, with no baseline.
- Startup, per-module and total size budgets.
- Vitest: unit and DOM tests, the user-format golden samples, the module registry with failure injection, the settings store, git sync against real git (a bare remote and two clones) and the terminal session model against a real helper process.
- Every `test:*` script, including i18n key parity, documentation links and the status index.
- `cargo test --locked` for the terminal helper, and `scripts/verify-pty-helper.mjs` against the built helper on linux-x64, linux-arm64, darwin-x64, darwin-arm64 and win32-x64.
- The third-party notice file against the bundle and the crate graph.

Measured when this document was written:

| Measure | Result | Ceiling |
|---|---:|---:|
| Code evaluated at startup | 93.9 KiB | 120 KiB |
| `main.js` | 3,756.6 KiB | 3,840 KiB |
| `styles.css` | 705.6 KiB | 720 KiB |
| Activation of `agent` | 343.0 KiB | 1,126 KiB |
| Activation of `home` | 420.4 KiB | 450 KiB |
| Activation of `icons` | 210.6 KiB | 220 KiB |
| Activation of `archives` | 178.6 KiB | 220 KiB |
| Activation of `automations` | 157.0 KiB | 220 KiB |
| Activation of `browser` | 92.3 KiB | 250 KiB |
| Activation of `sync` | 85.3 KiB | 150 KiB |
| Activation of `comments` | 53.8 KiB | 120 KiB |
| Activation of `notifications` | 23.4 KiB | 40 KiB |

`pnpm run check:bundle` prints these numbers.

## Verified on a real host

- **Linux, Obsidian desktop.** `scripts/obsidian-acceptance/workbench-fresh-runtime.mjs` creates a disposable vault and profile, starts Obsidian with remote debugging, installs the built plugin and runs `workbench-probe.mjs`. The probe passes. It covers the workbench layout at several widths, every rail page, the settings pages, module switches, archives editing, browser guests, the records pages, the terminal through a real `nand-pty` (connect, echo, replay, split), a restart that restores the route and panel width, and git sync against a local remote (set-up, first publish, a real conflict, abort, turning the module off). Evidence is written to the probe's `evidence/` folder.

## Not verified

Each item below is declared or implemented but has no real-host result. None of them is written as passed anywhere else.

### Platforms and hosts

- **Windows and macOS.** The terminal helper is built and its protocol tested there by CI, and the Windows job builds and runs the tests. No real Obsidian session has exercised ConPTY, the macOS terminal, Chinese input methods, the keyboard modes of agent TUIs or the git lookup paths on these systems.
- **Obsidian 1.13.0.** `minAppVersion` is `1.13.0` and the code uses no API marked for a later version, but no run on exactly 1.13.0 exists. The probe runs on whichever 1.13.x desktop build is installed.
- **Mobile.** No phone or tablet has run the plugin. The mobile-relevant work is a small startup set, desktop-only modules that do not load on mobile, and a narrow-width drawer layout whose width classification is covered by unit tests. Performance, input methods and touch behavior are unmeasured.
- **Third-party themes.** The theme presets have a screenshot matrix script (reading, live preview and source modes) that runs on Obsidian's default theme; interaction with community themes and snippets is not verified.

### Accounts and services

- **Git sync authentication with real hosting.** Tests use local bare remotes. HTTPS credential managers, SSH agents and a hosting provider's rejection messages are not exercised, nor is a large first push over a real network.
- **Agent CLIs with real accounts.** Sign-in, launch, resume and quota display for Claude Code, Codex, Gemini CLI, OpenCode, Pi and Grok are not re-run with real accounts. History parsing and resume boundaries are covered by local tests, which are not a check of a signed-in CLI.
- **Third-party widgets.** The WeRead, music and weather widgets are covered by stubbed tests, not by real accounts or live services.
- **Installation from release assets.** No real-host run has installed the plugin and downloaded its helper from GitHub release assets. The Obsidian probe uses a local build and a local helper; CI checks the packaged files separately.

### Behavior over time

- **Long-running use.** Long-lived terminal sessions, many concurrent sessions, and automations that run over days and across sleep and resume are not measured.

## Archives scale

`pnpm run accept:contacts-scale` is not part of `test:all`. It writes temporary Markdown, builds the index, deletes the files and then queries the in-memory index 20 times. Each query must hit exactly one entry. The target is a hot-query P95 of at most 100 ms; the table is a measurement on one machine, not a product guarantee.

Machine: Linux x64, Node v26.11.1, 8 logical CPUs (12th Gen Intel Core i7-12700), about 23 GB of memory.

| Entries | Bytes written | Index build (ms) | Hot query P95 (ms) |
|---|---:|---:|---:|
| 100 | 669,279 | 57 | 0.03 |
| 1,000 | 6,695,679 | 330 | 0.01 |
| 5,000 | 33,491,679 | 1,309 | 0.01 |

The query target is met on this machine. The index build time is not a query target.

## Recording a result

A new real-host run records the commit it ran on, the `sha256` of the `main.js` it installed, the host and Obsidian version, the commands and their outcome. A result applies to that build only. When an item above is verified, move it to the verified section with that record.
