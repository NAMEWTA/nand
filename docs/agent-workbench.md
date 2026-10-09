English | [简体中文](agent-workbench.ZH.md)

# Agent workbench

The **AI Agent** page of the workbench puts terminals, the native history of coding agents and their usage in one place. It runs plain shells and these CLI agents: Claude Code, Codex, Gemini CLI, OpenCode, Pi (`@mariozechner/pi-coding-agent`) and Grok (`xai-org/grok-build`). It is available on desktop only. Install each CLI, sign in and accept its directory trust on this computer first; NAND starts the CLI but does not install or sign in for you.

All six agents are enabled by default. You can turn each one off, and set its program path, under **Settings → Agents**.

## Sessions and layout

The **New session** menu at the top of the side panel lists the available shells, the enabled agents and your launch presets. The panel lists the open sessions (the status is at the right of the name), the recent history of this vault and **Usage**. Only sessions you started yourself are listed; sessions started by automations are opened from the run history. Browsing the page, the history or the usage never starts a terminal.

The main area has a tab strip. Each tab can be split to the right or down, up to four terminals per tab. Drag a divider to change the proportions and drag a tab to reorder. Each terminal shows its name, status and folder above it, with find, split and more actions. The right-click menu offers copy (also copy without trailing spaces), paste, select all, select the current line, find, previous and next prompt, last failed command, clear screen, clear scrollback, text size, copy the current folder path, show the folder in the file manager, rename, copy session ID and end session. Agent sessions also have **Attach note or archive…**.

- **Keyboard.** When the application enables the kitty keyboard protocol, or Windows' win32-input-mode, keys are sent in that protocol. With neither, Shift+Enter sends `ESC CR`, which Claude Code, Codex and similar CLIs read as a newline. While an input method is composing, no keys are sent; only the committed text is.
- **Paste.** Text is wrapped as a bracketed paste when the application asks for it. Escape and other control characters in pasted text are removed and line breaks become carriage returns. Ctrl/Cmd+C copies when there is a selection and interrupts when there is none.
- **Links.** Web addresses open in the system browser. A reference like `path:line:column` that points inside the vault opens in Obsidian at that line; files outside the vault go to the system. Dropping a file inserts its absolute path (quoted if it contains spaces); dropping text is handled like a paste.
- **Shell integration.** Shells that emit the public OSC 133, OSC 633 and OSC 7 marks enable prompt navigation, jumping to the last failed command and tracking of the current folder.

Closing the workbench page or leaf only hides the interface. The sessions keep running and are replayed from the session's authoritative screen when you return. Ending a session asks for confirmation and stops its process; the CLI keeps its own history. Turning the Agents module off, or uninstalling the plugin, ends all sessions. After Obsidian restarts, earlier sessions no longer exist: a link to one only opens the AI Agent page and never starts a session or submits a prompt again.

A session has two kinds of status. The connection is *Starting*, *Connected*, *Disconnected*, *Exited* or *Failed to start*. The agent's activity (*Working*, *Needs input*, *Idle*) comes only from the CLI's own lifecycle events; without a reliable event the status is *Status unknown*, and a pause in the output is never taken as completion. A plain shell shows only its connection status and is not counted as running work.

## Starting an agent

By default the new session starts in the vault folder (**Start in the vault folder**). The default **Approval prompts** setting is **YOLO**: the first time you launch an agent that has such flags, NAND asks *Let agents skip approval prompts?* and explains that the agent may change files in the vault without asking. Choose **Manual** under **Settings → Agents** to keep the CLI's own prompts.

| CLI | Program | Flags added by YOLO |
|---|---|---|
| Claude Code | `claude` | `--dangerously-skip-permissions` |
| Codex | `codex` | `--dangerously-bypass-approvals-and-sandbox` |
| Gemini CLI | `gemini` | none |
| OpenCode | `opencode` | none |
| Pi | `pi` | none |
| Grok | `grok` | `--permission-mode bypassPermissions` |

If the program is not found, NAND reports it with the install link; set the path under **Settings → Agents** if it is installed in an unusual place. For Claude Code and Codex, **Account** can hold an ID: the session then uses a separate login that NAND keeps in the plugin folder under `accounts/<claude or codex>/<id>/home`. That folder is inside the vault's `.obsidian` folder, so keep it out of Git and shared sync.

## Native history

History lists only conversations whose working directory, after resolving real paths, is inside this vault or one of its subfolders. A similar folder name, a symbolic link that leaves the vault or missing information about the working directory never widens the scope. Switching vaults never shows global chat history.

The panel lists the latest 50 conversations. **All history…** opens a searchable list with filters (Active, Favorites, Archived) at 100 entries per page. Select a conversation to see its full text. You can **Resume** it (NAND starts the CLI with its native resume arguments after checking the working directory and the native record again; a missing record is reported and never replaced by a new session), set a title and tags, favorite, archive, or **Export to note**. The history is not refreshed live; use **Refresh** for the latest.

| CLI | Where NAND reads |
|---|---|
| Claude Code | `projects` JSONL files in the configuration folder (`CLAUDE_CONFIG_DIR` or `~/.claude`, or the account folder) |
| Codex | `sessions` JSONL files in `CODEX_HOME` (or `~/.codex`) |
| Gemini CLI | JSON and JSONL chats in `.gemini/tmp/*/chats` (`GEMINI_CLI_HOME` or the home folder); the working directory comes from the record, `.project_root` or `projects.json` |
| OpenCode | `opencode.db`, opened read-only; root sessions with messages and text parts |
| Pi | `sessions` JSONL files in `PI_CODING_AGENT_DIR` (or `~/.pi/agent`) |
| Grok | `session.json` and `chat_history.jsonl` in `GROK_HOME/sessions` (or `~/.grok`) |

NAND's own titles, tags, favorites and archive state are stored in `.nand/terminal-agent/<device>/history.json`; the CLI's logs are never modified. An index that can be rebuilt is next to it as `index.sqlite`. An export is written to the visible folder `NAND Exports/` and opened; a name that already exists gets a numeric suffix and nothing is overwritten.

## Quota and usage

Subscription quota is account state returned by the provider and is shown apart from token use. The usage page shows, for each provider, the window or model, the remaining share, the reset time and the time of the check. If a refresh fails, the last valid result stays and is marked as stale. Gemini keeps a quota per model. A provider without a quota interface shows no remaining share and none is made up. Turn on **Show quota in the status bar** under **Settings → Agents** to see quota in the bottom status.

Tokens come from the native logs. Input includes cache reads and writes; the cache figures are a breakdown of the input. Codex uses the session total and Claude deduplicates repeated usage of the same message. Cost is only the value the CLI recorded. When sessions are missing from a total it is marked *sessions with known use only*, and if any session has no cost the total cost shows *cost unknown*. Automations use the difference of the native totals before and after a run.

## Context material

Choose **Attach note or archive…** in the right-click menu of an agent session. The selected note (the editor's content when the note is open) is pasted into the input as one bracketed paste once the agent's input is ready; no Enter is added. Text, elements and screenshots captured in the [browser](browser.md) are attached through the same interface. If the session ends, or the input is not ready within 10 seconds, NAND reports an error.

## Settings

Under **Settings → Agents** (stored per device):

| Group | Settings |
|---|---|
| Shell | Default shell (system default, bash, zsh, pwsh, PowerShell, cmd, Git Bash, WSL or a custom program), arguments, start in the vault folder |
| Appearance | Font, text size (8 to 32), line height (1 to 2), cursor style and blinking, scrollback lines (100 to 10,000), renderer (WebGL or DOM), Obsidian colors or your own |
| Launch presets | Name, icon, shell or program, arguments, folder and a line to run after start; shown in the New session menu |
| Coding agents | Approval prompts (YOLO or Manual), quota in the status bar, and for each agent: on or off, program path, approval override, extra arguments (they replace the default flags), account and usage |
| Terminal helper | Offline mode and a check button |

## Status hooks

To learn when an agent is working, waiting or idle, NAND installs a small status hook in the CLI's own user configuration when it starts a Claude Code, Codex, Gemini, Grok, Pi or OpenCode session, interactively or from an automation:

| CLI | File NAND writes |
|---|---|
| Claude Code | `settings.json` in the Claude configuration folder (merged) |
| Codex | `hooks.json` in `CODEX_HOME` (merged) |
| Gemini CLI | `~/.gemini/settings.json` (merged) |
| Grok | `hooks/nand-status.json` in `GROK_HOME` |
| Pi | `extensions/nand-status.ts` in the Pi agent folder |
| OpenCode | `plugins/nand-status.mjs` in `~/.config/opencode` |

Merged files keep your settings and other hooks, and the original is copied to a `.nand-backup` file next to it. The hook script itself is the file `nand-automation-hook.cjs` in a `hooks` folder inside a `.nand` folder in your home folder (outside the vault). The hook does nothing unless the process was started by NAND with its private event folder; it has no network access and does not log prompts. Pi waits for the real idle state, and OpenCode ignores child sessions and recoverable errors.

The directory trust, login and hook permissions of each CLI stay under the CLI's control. For a CLI without a native completion event, a run shows *Submitted; completion unverified* until the process exits or you stop it.

## Terminal helper

Terminals run in a small native program, `nand-pty` (MIT, source in `native/pty-server`). The plugin talks to it only over its standard input and output; it opens no port and needs no token. NAND checks the protocol version (3) at start and fails clearly on a mismatch. The helper ends all terminals when the plugin stops. On Windows it uses ConPTY and a job object so child processes end with it.

The helper is published for Windows x64, macOS x64 and arm64, and Linux x64 and arm64. On first use, NAND downloads `nand-pty-<platform>-<arch>` (`.exe` on Windows) and its `.sha256` file from the release of the same plugin version, never from another version, and keeps them in the plugin's `binaries/` folder. If the checksum is missing, damaged or different, installation stops and the existing file stays. You can place the matching files of that release in `binaries/` yourself: with a network NAND checks them against the official digest and accepts them; with **Offline mode** on it never connects and only uses what is installed. After a failed download, open a terminal again to retry; no reload is needed. Developers can point the environment variable `NAND_PTY_BINARY` at a local build.

## Commands

| Command | Result |
|---|---|
| New terminal | Starts a shell session |
| New Claude Code session, New Codex session, New Gemini CLI session, New OpenCode session, New Pi session, New Grok session | Starts that agent (only while it is enabled) |
| Switch terminal session | Opens a picker for the open sessions |
| Send selection to terminal, Send current note to terminal, Send current file path to terminal | Pastes the text into the current terminal without Enter |
| Insert absolute reference into terminal | Inserts the absolute reference of the current note |
| Show agent usage | Opens the usage page |
| Agent settings | Opens Settings → Agents |

## Limits

Install and sign in to each CLI on this computer first, and complete its own directory trust and permission prompts. Terminals and automations stop when Obsidian quits. CLIs differ in the history, completion events and quota they provide; missing information is shown as unknown or unavailable. Real sign-in, resume and quota flows of the CLIs, and the terminal on Windows and macOS, are not verified on a real host; see [Validation](../speculo/.speculo/specdev/context/validation.md).
