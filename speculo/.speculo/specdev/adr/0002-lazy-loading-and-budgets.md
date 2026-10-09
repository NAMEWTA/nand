English | [简体中文](0002-lazy-loading-and-budgets.ZH.md)

# ADR-0002: Lazy loading and bundle budgets

Status: accepted. Checked against the code on 2026-10-08.

## Problem

Obsidian loads one `main.js`. In a single CommonJS file, any static import from startup code makes the imported code run at startup, whether or not the user uses the feature. The plugin carries large libraries (terminal emulator, charts, calendars, icon data), so unmanaged imports would make every Obsidian start pay for all of them.

## Decision

- **One bundle, lazy initializers.** esbuild builds `src/app/main.ts` into one CommonJS `main.js` without code splitting. A file reachable only through `import()` is wrapped in a lazy initializer and runs on first import. One static edge from startup code pulls the whole closure of its target into the startup set.
- **What is startup code.** `src/app/main.ts` and what it imports statically: the registry, the settings runtime, the manifests, every `api.ts`, the settings schemas, the workbench and comments leaf classes, the theme runtime and the startup dictionaries.
- **What is lazy.** The shell loads when a workbench leaf opens. Module code loads through `manifest.load()`. Pages and settings pages load on first use from the `pages` and `settingsPage` loaders of the module instance. Heavy libraries (`chart.js`, `lunar-typescript`, xterm, icon data) load behind a second `import()` inside the module. `module.ts` never imports its own `ui/` statically. Import specifiers are literals, and nothing registers itself through an import side effect.
- **Budgets.** `scripts/check-bundle.mjs` builds in memory with an esbuild metafile and computes the startup-evaluated set and each module's activation closure. `scripts/bundle-budget.json` holds the ceilings: 120 KiB at startup, an activation ceiling per module, a list of libraries that may not enter the startup set, and ceilings for the total `main.js` (3.75 MiB) and `styles.css` (720 KiB). `pnpm run check:bundle` fails when a ceiling is exceeded, and CI runs it. The current values are in the [current baseline](../context/current-baseline.md).
- **Totals only go down.** The total ceilings limit growth. Raising one needs a written reason in the change that raises it.
- **Styles.** Obsidian allows one stylesheet, so CSS cannot load lazily. `styles.css` is one committed file joined from the author files listed in `src/styles.json`, in that cascade order. Module rules that affect Obsidian's own interface are scoped under a body class that the module adds only while it is active.

## Consequences

Lazy files are still read and pre-parsed as part of the one file, which is why the totals have ceilings of their own. Startup code cannot use a module's internals; it reads manifests and `api.ts` files only.

## Evidence

[Bundle check](../../../../scripts/check-bundle.mjs), [budgets](../../../../scripts/bundle-budget.json), [esbuild options](../../../../scripts/esbuild-options.mjs). `pnpm run check:bundle` in CI; `pnpm test:architecture` rejects static edges from `app` to module internals and from `module.ts` to its `ui/`.
