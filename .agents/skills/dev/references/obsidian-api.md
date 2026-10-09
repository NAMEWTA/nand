English | [简体中文](obsidian-api.ZH.md)

# Obsidian API rules, as applied here

Adapted from the skill named in SKILL.md `metadata.adapted-from` and from `eslint-plugin-obsidianmd` `recommended`, which this repo enables in `eslint.config.mts`.

Production `src/**/*.ts(x)` is linted with `--max-warnings 0`: a warning fails like an error. `scripts/**`, tests and config files are ignored (`eslint.config.mts`). Scoped overrides in that file carry their reason (TypeScript files turn off core `no-undef`; `desktop/` folders may use Node).

`minAppVersion` is 1.13.0 (SKILL.md identity table), so the Obsidian settings tab is declarative only (`getSettingDefinitions()`), with no `display()` fallback.

## Memory and lifecycle

| Do | Don't |
|---|---|
| `this.registerEvent(app.vault.on / workspace.on / …)` | Subscribe and forget, or only `off()` in `onunload` if `registerEvent` can do it |
| `registerDomEvent` on the plugin or the owning `Component` | `addEventListener` now and `removeEventListener` later on `activeDocument` — focus may have moved, so you remove it from a different document |
| `registerInterval` for periodic work | A bare interval that survives plugin unload |
| Return views from the `registerView` factory | Store `ItemView` instances on the plugin or in module globals; enumerate leaves when you need them |
| Let Obsidian detach leaves | `detachLeavesOfType()` in `onunload` |

`activeDocument` and `activeWindow` follow focus. Capture the document in a local if setup and cleanup must hit the same one.

Long-lived services belong to a module and end with it (`module-authoring.md`). Views and pages are not services.

Popovers and modals that create DOM outside a component must remove that DOM in `destroy` / `onClose`. The comment popover is appended to `view.dom.ownerDocument.body` and removed in the CodeMirror plugin `destroy()`.

## Types

```ts
// Files and folders — instanceof, never a cast
const file = app.vault.getAbstractFileByPath(path);
if (file instanceof TFile) {
  // ...
}

// DOM nodes and UI events — instanceOf, because popouts have a different realm
if (node.instanceOf(Text)) {
  // ...
}
```

`instanceof HTMLElement` across windows is the bug `.instanceOf` exists to prevent. `TFile` / `TFolder` stay on `instanceof` (same realm as the app).

No `any`. No `var`. `unknown` plus a narrowing function is the pattern used in the comment store (`asRecord`). Unpublished `app.commands` is typed in `src/host/obsidian/obsidian-internal.ts`. Use that interface.

## Files

| Situation | API |
|---|---|
| Edit the note the user is typing in | Editor API (`editor.replaceSelection`, CodeMirror). Not `Vault.modify` |
| Edit a note in the background | `Vault.process` |
| Delete | `FileManager.trashFile` |
| Look up a path | `Vault.getAbstractFileByPath` or `getFileByPath`. Not `getFiles().find` |
| Vault-relative paths | `normalizePath` |
| Desktop filesystem paths | Native `path.resolve` / `path.join`; retain absolute roots, UNC prefixes, spaces and literal `%20` |
| Network | `requestUrl`. Not `fetch` |
| OS / form factor | `Platform.isPhone`, `Platform.isDesktopApp`, `Platform.isDesktop`. Not `navigator.userAgent` |
| Language | The plugin's own i18n. Do not read `localStorage.language` |

Plugin-folder paths use `manifest.id`. Persisted names that must stay are the data table in `architecture.md`.

Regex lookbehind is illegal here (iOS < 16.4). The plugin is not desktop-only (`isDesktopOnly` in the SKILL.md identity table).

## UI text, commands, settings

- Sentence case in English UI and in `t()` values. Proper nouns stay capitalized. Where strings live is `settings-and-i18n.md`.
- Command ids and names follow the Commands section of `architecture.md`. Register with `addCommand`, or `context.commands.add` inside a module.
- Settings headings use `Setting.setHeading()`, not a hand-built `<h2>`, and are not named "General", "Settings", or the display name.
- Settings go into a namespace of the settings store (`settings-and-i18n.md`); never `saveData`. Domain stores such as comments and icons own their documented files.
- Put a new setting on its module's workbench settings page (or General / Appearance). Obsidian's tab (`src/app/settings/entry-tab.ts`, declarative `getSettingDefinitions()` only) carries the entry rows: open workbench settings, language, status, theme preset, module switches.
- Redraw the Obsidian tab with its `refresh()`; redraw a workbench settings page with `host.refresh()`. Do not call `display()`.
- From a settings callback, `activeDocument` is the settings window. To touch the main workspace, use `this.app.workspace.containerEl.ownerDocument`.

## DOM and CSS

- Build UI with `createEl` / `createDiv` / `createSpan` / `createSvg` on a parent `HTMLElement`. Do not `document.createElement`.
- Put styles in the one stylesheet named in the SKILL.md identity table. Do not inject `<style>` or `<link>`. Do not assign large style blobs from TypeScript when a class will do. Coordinates (comment popover `left` / `top`) are the exception.
- Use the NAND tokens and Obsidian variables; colors live only in `src/theme/` and the token layer (`../../ui/references/design-system.md`). `pnpm run lint:css` rejects literal colors, `!important`, `:has`, raw z-index values and duplicate selectors outside the baseline.
- Scope selectors to the module's classes (`.nand-editor-…`, `.nand-contacts-…`, `.dashboard-…`). No bare `button { }` rules. Rules that style Obsidian's own DOM hang off a body class the module adds while active.
- Edit the module's author file under its `styles/` folder in place rather than appending overrides elsewhere.
- Toggle a class from TypeScript instead of reaching for `!important` or `:has`.
- Icon-only buttons need an accessible name (`aria-label` or `setTooltip`). Interactive targets should be at least 44×44px on touch. Don't remove `:focus-visible` outlines.
- Keyboard: a control that clicks must also work with Enter / Space if it is not a native `button`.

## Timers and promises

`eslint-plugin-obsidianmd` wants `window.setTimeout` / `window.clearTimeout` (better: the owning element's `win`) rather than bare timers or `globalThis`. Core code that needs timers takes them as an injected `{ set, clear }` pair (settings store, comment store) so tests can pass Node timers and the host picks the window.

Every `Promise` is awaited, returned, or explicitly `void`ed. `workspace.revealLeaf` is a promise.

## Logging and platform modules

No `console.log` in `onload` / `onunload`; report errors with `console.error('[NAND <area>]', error)` and a Notice when the user must act.

`electron`, Node built-ins and `window.require` live only in `desktop/` folders (architecture rule), reached from modules whose manifest has `platforms.mobile: false` or behind `Platform.isDesktopApp`, so the phone never evaluates them.

## Manifest naming

The plugin id does not contain `obsidian` and does not end with `plugin`. The display name does not contain `Obsidian` or end with `Plugin`. The description does not say "This plugin" or "Obsidian", and it ends with punctuation. Keep it that way.

## Accessibility bar

Match surrounding UI. New buttons and icon buttons are keyboard reachable, named, and visible on `:focus-visible`. Do not ship a click-only `div` when `button` works.

## Release hygiene

- Lint is clean with zero warnings (CI runs `pnpm run lint`).
- Releases attest the zip, `main.js` and `styles.css` (`actions/attest-build-provenance`); leave that step in `release.yml`.

The Iconic port keeps upstream CSS declarations and `.iconic-*` names for behavioral parity. Every imported selector is gated by `body.nand-iconic-enabled` (using `:where` to preserve specificity); disable removes that body marker in main and floating windows. Treat this as a scoped port exception, not a template for new global CSS. Private Obsidian members used by this port are described locally in `src/modules/icons/platform/utils/obsidian-internal.ts`; do not add ambient declarations or blanket lint suppressions.
