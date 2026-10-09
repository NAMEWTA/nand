English | [简体中文](editor-comments.ZH.md)

# Editor comments

Comments are a sidecar on the vault. The note file is never written by this feature. There is no PDF entry: extensions only run for Markdown. The code is `src/modules/comments/` (`core/` model, anchors and store; `platform/` vault filesystem and store handoff; `ui/` editor extension, popover, side panel, workbench page and settings page).

## On-disk layout

```
.nand/editor/comments/index.json
.nand/editor/comments/pending.json
.nand/editor/comments/files/<first 16 hex of sha256(path)>.json
```

- Hash the path string, not the file bytes, with `crypto.subtle` SHA-256, first 16 hex chars.
- `index.json` is `{ version: 1, files: { [path]: { hash, open, total, updatedAt } } }`.
- `pending.json` is a recoverable write intent containing the complete next index, sidecar bodies and obsolete file paths. Replay it before loading; remove it only after sidecars, index and cleanup succeed.
- Read, parse and shape errors propagate without caching an empty result. Dirty path revisions survive write failures and synchronous edits during an awaited write. The host reports background failures through `onError`.
- Each file doc is `{ version: 1, path, comments: CommentThread[] }`.
- An empty thread list deletes that sidecar file and the index entry.
- Writes are serialized on one promise chain and debounced (300 ms) with timers the host injects (`CommentStoreOptions.timers`; core reads no globals). The store is closed (sealed and flushed) when the module turns off or the plugin unloads. The host reports rejection; a forced process exit cannot guarantee persistence of data that never reached the journal.
- The `comments` settings namespace (`src/modules/comments/settings.ts`) stores only `highlightEnabled`, `popoverEnabled` and an optional `sidebarWidth`. Never a comment body.

## Model

`CommentStatus`: `open` | `resolved` | `orphaned`.

`TextQuoteAnchor`: `exact`, `prefix`, `suffix`. Prefix and suffix are 24 characters. The quote is the source of truth. Offsets are a cache.

Thread ids look like `c-…`, message ids like `m-…`.

## Locating a quote

`locateAnchor` in `src/modules/comments/core/anchor.ts`:

1. If `doc.slice(start, end) === exact`, keep the offsets.
2. Else search `prefix + exact + suffix` once.
3. Else search `exact` and take the hit nearest the old start.
4. Else the caller sets `orphaned`.

Do not guess a nearby paragraph. Do not auto-reopen an orphaned thread when some later text happens to match. `reopen()` refuses orphaned threads. `reanchor()` is the explicit user action that binds a new selection and sets `open`.

`selectionIsCommentable` rejects a selection that starts inside YAML frontmatter or sits inside a fenced code block. Reading-mode highlights also skip `pre`, `code`, `script`, `style`, and existing `.nand-editor-comment-hl` nodes.

## Store rules

- Store shutdown seals new operations synchronously and drains accepted operations before a replacement store may load. The App-scoped `Symbol.for('nand.editor.comment-store-handoff')` coordinator (`platform/store-handoff.ts`) survives plugin bundle reloads, retains failed drains for retry, and isolates vaults. Activation generations prevent late setup or cleanup from replacing a newer store. Editor activation is asynchronous; extensions still register once per plugin instance.
- `applyChanges` no-ops until `reconcile()` has run for that path. A keystroke during the initial load must not drag a stale offset.
- `reconcile` relocates open and resolved threads and marks misses `orphaned`. It does not rewrite quotes that only shifted.
- `applyChanges` maps offsets with `ChangeSet.mapPos`, refreshes the quote from the new document, and orphans a thread whose range collapses.
- Overlapping CodeMirror marks are dropped (advance the cursor to the end of the accepted mark). A mark is drawn only when `doc.slice` still equals `exact`.
- `renamePath` moves threads to the new path and rewrites the sidecar under the new hash.
- `deletePath` removes the index entry and the sidecar.
- Mutations go through the queue. `applyChanges` is synchronous on the cache and marks the path dirty.

## UI

- Source and live preview: CodeMirror `ViewPlugin` from `commentsCmExtension`. Highlights obey `highlightEnabled`. The selection popover obeys `popoverEnabled`. The add-comment command still works when the popover is off.
- Reading mode: `registerMarkdownPostProcessor`. If the file is not loaded yet, `loadFile` then rerender that preview once. Do not rerender again when the cache is already warm (that loops).
- Side panel: reply, resolve, reopen, delete, jump, reanchor. Jump switches preview to source, then `setSelection` and `scrollIntoView`.
- The runtime (`ui/runtime.ts`) is created on each activation. It adds the CodeMirror extension and the reading post-processor through `context.editor`, so turning the module off removes them from every open editor; closing the side panel only unmounts panel DOM.
- Clicking a highlight focuses that thread (`store.focus`). It does not edit the note.
- The runtime owns `CommentPopoverCoordinator` and disables it on dispose. Workspace activation and layout changes hide overlays independently of CodeMirror transactions. There is at most one visible selection popover per document and window.
- `SelectionPopover` keeps a transient draft for the same valid selection. It measures the actual selection against the source pane, suspends its composer and key scope while hidden, and validates the source again before writing. Module and leaf teardown dispose drafts, observers and listeners. Restarting the module rebinds store subscriptions on existing CodeMirror views.
- Composer textareas use an associated label and `aria-describedby` for shortcut help; do not add an `aria-label` tooltip that covers the help. Small panes constrain the input and wrap the action row so submission controls remain visible.

Other modules see comments only through `src/modules/comments/api.ts`: the side panel (`COMMENTS_PANEL`, mounted by `app/workbench/comments-leaf.ts`) and the index of commented notes (`COMMENTS_INDEX`, used by the workbench panel). `src/shared/events.ts` reserves two event names nothing emits; do not start emitting them unless the task says so.

## Tests

`src/modules/comments/comments.test.ts` (vitest, part of `pnpm test`) runs the suite with the Obsidian stub; storage and handoff cases live in `scripts/verify-comment-storage.ts` and `scripts/verify-comment-handoff.ts`, which it imports.

The storage cases cover read failure, journal replay, partial commit, rename cleanup and concurrent-edit recovery, all checked through a fresh store. The suite also checks anchors, the in-memory filesystem (the note string is unchanged), index hash length 16, reply, resolve, rename, delete, orphan reconcile and the view type constants from the identity table. It gates journal, sidecar, index and cleanup operations across store generations, including failed shutdown retries, closed-store mutation rejection and App isolation.

It exercises the real CodeMirror extension with controlled DOM geometry and workspace events: hiding without a CodeMirror transaction, scroll clipping, draft restoration, stale submission rejection, and module restart. `test:issue-regressions` covers composer scopes and accessibility, placement boundaries, and routing terminal title refreshes to the correct host window. These Node fixtures do not replace real Obsidian tooltip and window tests; check a real plugin disable and enable in Obsidian.

- Resolve repo files with `process.cwd()`.
- Tests pass Node timers to `CommentStore` (`{ set: setTimeout, clear: clearTimeout }`); UI fixtures polyfill `window` on `globalThis`.

Add a case to the suite when you change locate, serialization, or the boundary. Do not point a test at a real vault.
