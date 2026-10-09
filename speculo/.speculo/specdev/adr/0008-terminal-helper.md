English | [简体中文](0008-terminal-helper.ZH.md)

# ADR-0008: Terminal helper and stdio frame protocol

Status: accepted. Checked against the code on 2026-10-08.

## Problem

The terminal needs native pseudo-terminals (ConPTY on Windows), but the Obsidian renderer process cannot hold one. A network service on a local port would add port conflicts, authentication and reconnection state. The helper must also be distributable under the MIT license.

## Decision

- **One helper process.** `nand-pty` (`native/pty-server`, Rust, built on `portable-pty`) is started at most once per plugin load. The plugin talks to it only through its standard input and output. It opens no port and needs no token.
- **Frames.** A frame is a 4-byte big-endian length, a 1-byte kind (control, session input, session output) and the body. Control bodies are UTF-8 JSON (`hello`, `spawn`, `resize`, `ack`, `end` and `history`). Session frames start with a 4-byte session number. A frame body is at most 16 MiB. The handshake `hello` carries the protocol version (3); a helper that does not accept it fails with a clear error.
- **Lifetime.** When its standard input closes, the helper ends every session and exits. On Windows it joins a job object that kills its children when it exits. On Unix-like systems, ending a session hangs up the process group, waits 2 seconds and then forces it down.
- **One authoritative model per session.** Output first goes into a headless xterm model in the plugin, which acknowledges bytes after parsing them. The helper pauses reading a session when more than 1 MiB is unacknowledged and resumes below 256 KiB. Device queries (DA, CPR, DSR, DECRQM, colors, size, kitty flags) are answered only by the model; visible views swallow them, so hidden sessions and automation sessions never stall and answers are never duplicated.
- **Views are disposable.** A visible view replays a serialized snapshot of the model, then follows live output. Closing a page or a leaf releases the view and the session continues. Turning the module off or unloading the plugin ends every session.
- **History in the same process.** Native history scanning, querying, reading and cancelling are requests (`history`) to the same helper, with one scan writing the index at a time. See [ADR-0009](0009-agent-sessions-and-history.md).
- **Distribution.** The helper is built only by CI, for linux-x64, linux-arm64, darwin-x64, darwin-arm64 and win32-x64, and published as release assets `nand-pty-<platform>-<arch>[.exe]` with a `.sha256` file. On first use the plugin downloads the asset of the release with its own version into `<plugin folder>/binaries/`, checks the SHA-256 and runs it. Offline mode uses only a helper that is already installed. `NAND_PTY_BINARY` points development runs at a local build. No binary is committed.
- **Provenance.** The helper and the terminal code are written for NAND and released under the MIT license. They are built from public specifications and documentation: xterm control sequences, the kitty keyboard protocol, win32-input-mode, ConPTY, OSC 7 and shell integration sequences, and the documentation of xterm.js and `portable-pty`. Orca (MIT) is credited in `NOTICE`. See [ADR-0013](0013-license-and-attribution.md).

## Consequences

One process hosts all sessions, so a helper crash disconnects all of them. The plugin shows the reason and restarts the helper the next time a terminal is needed. In exchange there is no port, token or reconnect state.

## Evidence

[Frames](../../../../native/pty-server/src/frame.rs), [helper main](../../../../native/pty-server/src/main.rs), [sessions](../../../../native/pty-server/src/session.rs), [session model](../../../../src/modules/agent/services/terminal/session.ts), [session manager](../../../../src/modules/agent/services/terminal/sessions.ts), [binary installer](../../../../src/modules/agent/platform/desktop/pty/binary.ts). `cargo test --locked` (frames, sessions, flow control, hangup, stdio end to end); Vitest suites for the session model and for a real helper process; `scripts/verify-pty-helper.mjs` on five targets in CI; the terminal pages of the real-Obsidian probe.
