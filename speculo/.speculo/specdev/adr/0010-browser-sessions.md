English | [简体中文](0010-browser-sessions.ZH.md)

# ADR-0010: Browser partitions, permissions and page lifetime

Status: accepted. Checked against the code on 2026-10-08.

## Problem

The browser module embeds web pages (Electron `webview` guests) inside Obsidian. Tabs, popups and sign-in windows must share one login session, web pages must not reach Node or the vault, and a navigation that never answers must not leave a close or an agent call hanging. Agent CLIs can drive the browser, which must stay off unless the user turns it on.

## Decision

- **One partition per vault.** Pages of a vault use the Electron partition `persist:nand-browser-<vault id>`. Popups and sign-in windows use the same partition and the same policy. Cookies stay in the local Electron session; they are not written to settings or to the vault.
- **Guest policy.** A guest is accepted only if it is a `webview` with Node integration off and a NAND browser partition. Only allowed URLs are loaded. A window opened by a script is limited in rate and count: a plain link is passed to NAND to open as a page, and a window with explicit features becomes a child window in the same partition and policy.
- **Permissions are decisions per origin.** Camera and microphone, location, notifications, clipboard read and fullscreen are denied unless the user granted that permission to that origin, and a request from another origin or a frame does not inherit the top page's grant. Grants and the recent browsing history are stored in `.nand/browser/<device-id>/state.json`.
- **Page identity and operations.** A page has a stable identity and a snapshot revision. An element reference is valid only inside the snapshot that produced it, so a stale reference is rejected. Operations on a page run through a per-page queue. Closing the page closes the queue: queued work is rejected, running callers settle at once, and a late native result is dropped.
- **Retirement.** Replacing an in-flight load, or a page that cannot be stopped safely, retires the guest: it is released and a new one is created on demand, so late events never reach the new page.
- **The agent bridge is opt-in.** With the setting "allow agent sessions to use the browser" off, no connection is started. With it on, the module provides a local connection and a CLI source; only sessions that NAND starts as agents receive the connection variables (`NAND_BROWSER_CLI`, `NAND_BROWSER_CONTEXT`, `NAND_BROWSER_TOKEN`, `NAND_BROWSER_GUIDE`). The token is valid only while the connection runs, and stale connection files are cleaned up.
- **Material goes through sessions.** Pages, selected elements and screenshots reach an agent as pasted material through `agent.sessions` ([ADR-0009](0009-agent-sessions-and-history.md)); the browser does not own agent processes.
- **Opening pages.** Other modules open pages through the `browser.open` service. Browser pages are resource pages of the workbench: they can be copied into a focus-mode leaf, and a copy gets a new page id.

## Consequences

Web content is isolated from the plugin, at the cost of the Electron `webview` restrictions. The browser works on desktop only; on mobile the workbench marks it unsupported.

## Evidence

[Guest policy](../../../../src/modules/browser/platform/desktop/guest-policy.ts), [operation queue](../../../../src/modules/browser/core/operation-queue.ts), [page](../../../../src/modules/browser/platform/desktop/page.ts), [store](../../../../src/modules/browser/platform/store.ts), [module](../../../../src/modules/browser/module.ts). The browser tests (`src/modules/browser/browser.test.ts`) and the browser guest checks of the real-Obsidian probe.
