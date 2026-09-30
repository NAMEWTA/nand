# Orca terminal workbench adaptations

Reference: [Orca v1.4.217](https://github.com/stablyai/orca/tree/11d97896628d90c4990365127812667b00e28c82), commit `11d97896628d90c4990365127812667b00e28c82`.

Copyright (c) 2026 Lovecast Inc. [MIT license](./orca-LICENSE.txt). The complete license is also included in the generated `main.js` banner.

| Upstream source | NAND adaptation |
| --- | --- |
| `src/renderer/src/components/tab-bar/recent-tab-switching.ts` | `src/core/pty/recent-sessions.ts`: stable MRU ordering, stale-ID removal, duplicate suppression and active-session priority. Native Obsidian suggestions supply the UI. |
| `src/renderer/src/lib/pane-manager/pane-fit-resize-observer.ts` and `pane-fit-client-size.ts` | Terminal presentation fit scheduling: coalesce frames, wait for stable cell dimensions and avoid redundant PTY resizes. Use the container's Window and public FitAddon interfaces. |
| `src/renderer/src/lib/pane-manager/terminal-webgl-hidden-retention.ts` | Instance-owned LRU retention with an initial budget of two hidden graphics contexts. PTY lifetime remains independent of presentation lifetime. |
| `src/renderer/src/lib/pane-manager/terminal-structural-replay-coordinator.ts`, `terminal-scroll-buffer-snapshot.ts` and `terminal-scroll-intent.ts` | Ordered headless snapshot replay, live-output handoff and scroll-intent preservation across hiding and restoring a terminal. |

NAND retains its Preact components, Obsidian leaves, theme tokens and existing native PTY protocol. These adaptations do not import Orca's application store, pane tree, Electron host, or private xterm render-service patches. Behavioral regression tests cover the adapted contracts; upstream compatibility is not implied.
