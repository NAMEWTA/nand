English | [简体中文](0009-agent-sessions-and-history.ZH.md)

# ADR-0009: Agent sessions and vault-scoped native history

Status: accepted. Checked against the code on 2026-10-08.

## Problem

Coding-agent CLIs keep their own logs, identities and resume protocols. NAND launches them in terminals, shows their history and lets other features hand them material. Doing so must not mix the user's global CLI history into one vault, change CLI state, or send text the user did not confirm.

## Decision

- **Sessions are owned by the session manager.** A session (a shell, a coding agent or a preset) and its authoritative buffer belong to the agent module, not to a leaf or a page. Navigating to a session, to the history or to usage never creates a session and never starts a process. Only an explicit action starts one.
- **A catalog drives launching.** `src/modules/agent/core/launch/catalog.ts` has one entry per CLI: Claude Code, Codex, Gemini CLI, OpenCode, Pi and Grok, with the detect and launch command, install and upgrade commands, permission-bypass flags, account kind, usage reader, whether the CLI accepts context and how an automation hands it a prompt. A click opens a terminal and sends that command.
- **History is read-only and vault-scoped.** The helper scans each CLI's own log roots and keeps only sessions whose working directory is the current vault or inside it. NAND never writes to a CLI's logs. What NAND adds is kept apart: titles and labels in `.nand/terminal-agent/<device-id>/`, and a SQLite index there that can be rebuilt at any time. Resuming uses the exact native session id and reports an error if it no longer exists. Credentials and account logs are not copied into the vault.
- **Export never overwrites.** Exporting a session writes Markdown into `NAND Exports/`; a name that already exists gets a numeric suffix.
- **Usage is read, not computed.** Usage comes from native logs and provider status. A missing value is shown as unknown.
- **Material is pasted, not sent.** Other modules reach sessions through the `agent.sessions` service: `list` and `attachMaterial`. Attaching pastes a block of text and files into the session's input without submitting it, and the target session is shown before the user attaches. If the input is not ready, the attach waits for a bounded time and then fails visibly.
- **Automations use a separate runtime port.** `agent.automation-runtime` starts agent and script runs for the automations module. Its sessions are recorded in `.nand/terminal-agent/<device-id>/automation-sessions.json`.
- **Unknown stays unknown.** Without a reliable native event or data, NAND shows an unknown state and does not infer success.

## Consequences

The vault's history view shows only what belongs to the vault. CLI upgrades that change log formats can break the scan; the scan fails visibly and the index is rebuilt.

## Evidence

[Agent api](../../../../src/modules/agent/api.ts), [catalog](../../../../src/modules/agent/core/launch/catalog.ts), [history service](../../../../src/modules/agent/platform/history/service.ts), [history scan](../../../../src/modules/agent/platform/desktop/history/scan.ts), [helper history requests](../../../../native/pty-server/src/agent_data.rs). The history, scan and session tests under `src/modules/agent/` and `cargo test --locked`.
