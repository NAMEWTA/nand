English | [简体中文](0004-data-placement.ZH.md)

# ADR-0004: Data placement and safe document writes

Status: accepted. Checked against the code on 2026-10-08.

## Problem

NAND stores boards, records, archives, comments, icon rules, run records and settings in the user's vault. Users edit the Markdown themselves, sync vaults across devices and back them up. A write that replaces a whole document, restores a deleted row or treats a failed read as an empty file destroys user data.

## Decision

**Where data lives.**

- User content is Markdown in visible folders: boards (notes the user selects), archives (the configured folder, `个人档案/<name>/基本信息.md` and `企业档案/<name>/基本信息.md`), records (`NAND/习惯/`, `NAND/记账/`, `NAND/番茄钟/`, `NAND/阅读/`), automation definitions (`NAND/自动化/`) and agent session exports (`NAND Exports/`).
- NAND configuration and runtime JSON live under the vault's `.nand/`, by domain and, when the state belongs to one machine, by device id: `config/`, `editor/comments/`, `icons/`, `automation/<device-id>/`, `notifications/<device-id>/`, `terminal-agent/<device-id>/`, `browser/<device-id>/`, `recovery/` and `cache/`.
- The plugin folder holds the built plugin files and the downloaded terminal helper. No user data or settings are kept there.
- Git sync keeps its automatic-sync clock and pause flag inside the repository's git directory, so they are never committed.
- Obsidian Sync does not sync dot-folders. User guides tell users that `.nand/` needs Git, iCloud, Syncthing or a similar tool.

**Comments are sidecars.** Comment bodies, threads and anchors live in `.nand/editor/comments/`: an index, a pending journal and one file per note, named by a hash of the note path. The note is never rewritten. An anchor is a text quote with a prefix and a suffix, with cached offsets. Locating tries the offsets, then the quote with its context, then the nearest occurrence of the quote. If none fits, the thread is marked orphaned and is not reopened or re-attached without an explicit user action. A write intent is journaled before the files change and replayed on the next load.

**Icons have their own store.** Icon rules and preferences live in `.nand/icons/iconic.json` with rotating backups, in the schema of the upstream project the module adapts. The global settings keep only the module switch.

**Writing Markdown.** `DocumentRepository` reads a snapshot and changes only what NAND owns: YAML properties, table rows with stable row ids, and sections between `<!-- nand:... -->` markers. It writes through the vault's atomic process call after checking the latest text, protects an editor's unsaved text, and merges three ways against the baseline observed when editing started. Unknown YAML, comments and free text are kept. A read or parse failure is never treated as an empty document, and invalid section markers raise an error. Deleting a record sets `nand-deleted` and keeps the document. Writes to one store are serialized per path.

**Saving is visible.** `DurableState` exposes `saved`, `saving`, `unsaved` and `conflict`. A failed save keeps the input as a draft in `.nand/recovery/drafts/`, and a board conflict keeps a copy in `.nand/recovery/dashboard/conflicts/`. A saved-copy message never means the original file changed.

**Formats are locked.** Boards, archives, automation definitions, comment sidecars, records and `iconic.json` are written through production code and compared byte for byte with the snapshots in `test/golden/`. A format change is deliberate and updates the snapshot in the same change.

## Consequences

Users can read, edit and back up their data with ordinary tools. Writes take more code than replacing a file, and a conflict stops the save instead of overwriting. Backups must include hidden folders.

## Evidence

[Document repository](../../../../src/shared/storage/document-repository.ts), [durable state](../../../../src/shared/storage/durable-state.ts), [three-way merge](../../../../src/shared/storage/three-way-merge.ts), [Obsidian document port](../../../../src/host/obsidian/storage/document-collection.ts), [comment store](../../../../src/modules/comments/core/store.ts), [golden tests](../../../../test/golden/user-formats.test.ts). `pnpm test` covers the storage, comment and golden suites.
