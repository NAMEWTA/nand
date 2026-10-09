English | [简体中文](orca-terminal-workbench.ZH.md)

# Orca sources and adapted parts

NAND adapts parts of [Orca](https://github.com/stablyai/orca) (stablyai/orca), a project under the MIT License, Copyright (c) 2026 Lovecast Inc. The full [MIT license](orca-LICENSE.txt) is kept verbatim and is embedded in the license banner of the built `main.js`. The attribution summary is in [NOTICE](../../NOTICE).

Each adapted source file names its upstream in a header comment. The upstream commits below identify where the code was taken from; they do not mean NAND follows the latest Orca.

| Upstream | Commit |
|---|---|
| Agent runtime, automation scheduling | [27b823f934f739bc85914dd717b776835f60bcf7](https://github.com/stablyai/orca/tree/27b823f934f739bc85914dd717b776835f60bcf7) |
| Terminal workbench (Orca v1.4.217) | [11d97896628d90c4990365127812667b00e28c82](https://github.com/stablyai/orca/tree/11d97896628d90c4990365127812667b00e28c82) |
| Browser | [d74388f8a2dad2bd4bbfe3b937aba66e6648258b](https://github.com/stablyai/orca/tree/d74388f8a2dad2bd4bbfe3b937aba66e6648258b) |

## Terminal workbench (11d97896)

| Orca part | In NAND |
|---|---|
| `recent-tab-switching` | `src/modules/agent/core/terminal/recent-sessions.ts`: stable most-recently-used order, de-duplication, removal of stale identities, active session first. The picker is an Obsidian suggest modal. |
| `pane-fit-resize-observer`, `pane-fit-client-size` | `src/modules/agent/ui/terminal/stable-terminal-fit.ts`: one merged size check, waits for a stable character size, avoids repeated PTY resizes. Uses the owning window and the public `FitAddon` interface. |
| `terminal-webgl-hidden-retention` | `src/modules/agent/ui/terminal/hidden-renderer-retention.ts`: a per-instance LRU that keeps at most two hidden graphics contexts. A visible renderer does not own the PTY lifetime. |
| `terminal-structural-replay-coordinator`, scroll buffer snapshot, scroll intent | `src/modules/agent/ui/terminal/terminal-presentation.ts`: replay from the authoritative headless snapshot, serialized with live output, with scroll intent restored. |

## Agent runtime and automation scheduling (27b823f)

| Orca part | In NAND |
|---|---|
| Shared agent config: launch commands, permission flags, install and upgrade commands, usage kinds | `src/modules/agent/core/launch/catalog.ts` (also the automation prompt transport) |
| Native resume capability set | `src/modules/agent/services/agent-runtime.ts` |
| Native session layouts, Claude project path encoding, history scope | `src/modules/agent/platform/desktop/history/scope.ts`; the history formats in `native/pty-server/src/agent_data.rs` |
| Native lifecycle hooks and extensions | `src/modules/agent/platform/desktop/hooks/native-extensions.ts` |
| Schedule and cron parsing, next-occurrence calculation | `src/modules/automations/core/schedule/` (`automation-cron-field-parsing.ts`, `automation-cron-occurrence.ts`, `automation-schedule-occurrences.ts`, `automation-schedule-parsing.ts`) |

## Browser (d74388f)

| Orca part | In NAND |
|---|---|
| Accessibility snapshot traversal | `src/modules/browser/core/snapshot-ax-tree-walk.ts`, `src/modules/browser/platform/desktop/snapshot-engine.ts` |
| Interactive element discovery | `src/modules/browser/platform/desktop/snapshot-cursor-interactive-elements.ts` |
| Screenshot markup model | `src/modules/browser/core/markup-model.ts` |
| Element grab context | `src/modules/browser/platform/desktop/grab-script.ts` |
| Debugger lease ownership | `src/modules/browser/platform/desktop/debugger-lease.ts` |
| Popup classification | `src/modules/browser/platform/desktop/guest-policy.ts` |
| URL classification | `src/shared/web-url.ts` |

## What NAND does not take

NAND uses its own Preact panels, Obsidian leaves, theme tokens and a stdio helper process (protocol 3). It does not use Orca's application state tree, pane tree, Electron main process or private xterm renderer patches. Regression tests cover the adapted behavior; they are not a compatibility guarantee with the Orca application.
