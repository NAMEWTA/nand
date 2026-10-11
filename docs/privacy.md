English | [简体中文](privacy.ZH.md)

# Privacy and data boundaries

This page describes the boundaries in the current code. It is not a promise that nothing is uploaded or that everything is encrypted. What you do later in a CLI, the browser or the operating system is decided by those programs and by you. NAND has no telemetry or analytics.

## What is recorded

Archive text is in the archive folder you choose, one `基本信息.md` per person or company. NAND's own configuration and runtime data are in `.nand/` of the vault. Treat `.nand/recovery/` as sensitive: it holds recovery copies of what you were editing. Browser history and site permissions are in `.nand/browser/`, and the history labels of terminal agents are in `.nand/terminal-agent/`. Which folder holds what is listed in [Data and recovery](data.md).

Settings are plain JSON. If you enter a WeRead API key for the dashboard, it is stored as text in `.nand/config/settings.json`.

Board skill templates are visible YAML in board notes. Dispatch history under `.nand/automation/<device-id>/runtime.json` retains the final prompt and selected file references as plain text, together with the source and delivery receipt. A new session passes this material to the selected CLI and its configured provider; pasting into an existing session leaves submission to you. These snapshots are not diagnostic logs and are not redacted.

The skill picker reads local `SKILL.md` files to extract names; it does not execute them or send their contents to a provider. It scans the three documented vault directories only on opening or refresh. Additional directories are an explicit device setting, read on desktop only; leaving the setting empty makes no additional scan. Remembered names and directory paths are stored in device settings and can be cleared under Agents. Discovery does not change skill files.

News stores collected text, analysis and raw CLI replies in `.nand/news/<device-id>/`, with a 30-day collected/run-history window. Favorites, briefs and optional daily notes are visible Markdown under `NAND/新闻/`. Clearing collected cache keeps those notes and current quota. Source/view/interest settings are shared with the vault; the selected CLI and working directory are device-specific. See [News](news.md).

On desktop macOS and Linux, private `.nand/` directories use `0700` and files use `0600`; existing managed files are tightened at startup, including after a Git clone. NAND refuses symlinked private paths and does not change ordinary note permissions. This is local access control, not encryption or a Git upload restriction. Windows and mobile retain their native permission behavior. See [Data and recovery](data.md#private-file-permissions) for repair behavior.

Diagnostic logs are redacted before they are printed: the vault path and home folder are replaced, credentials in URLs and common token, password and key query parameters are masked, bearer tokens and `token=…`-style assignments are masked, and long text is cut. Terminal screens, your Markdown and text you copy yourself do not pass through this redaction, and a debug switch cannot bypass it.

## Network

Archive search and the list/card switch read only an in-memory index and make no network request. The features below talk to the network only when they are on and used. NAND opens no listening port: the browser connection for agents and the terminal helper use a local named pipe or socket and standard input and output.

| Feature | When | What is sent, and to whom |
|---|---|---|
| Browser | You open a page, search, download | Whatever the sites you visit receive. Text that is not an address goes to your chosen search engine (Google, Bing or DuckDuckGo) |
| News collection (off by default) | You preview or refresh sources, or enable a background refresh policy | HTTP requests to the configured feed/static-page addresses; static source scripts are not executed |
| News analysis and briefs (off by default) | You request analysis or a brief | Bounded report excerpts, configured interests and templates go to the selected CLI/account; its provider handles the model request. NAND stores no model API key and does not call a model API directly |
| Web section on a board | The section is shown | The configured address is requested once to read its framing headers, and the page is then loaded in the board. Web shortcut cards load nothing until you open them |
| Terminal helper | The first time you open a terminal | A download of `nand-pty-<platform>-<arch>` and its checksum from the GitHub release of the plugin's version. No vault data is sent. Offline mode never connects |
| Agent quota | The Usage page is open, or quota is shown in the status bar | For each enabled agent, NAND reads the sign-in that the CLI saved on this computer and calls the provider's quota endpoint (Anthropic, OpenAI/ChatGPT, Google, xAI/Grok, OpenCode and others) |
| Weather widget (off by default) | The widget is on | The coordinates of the city you picked go to Met.no, wttr.in and Open-Meteo; a city search goes to Open-Meteo |
| Lunar calendar widget (on by default) | The widget is shown | The year, to get public holiday data from `timor.tech`; the answer is cached for a day |
| Reading widget | You search for a book | The text you typed, to `book.douban.com`; book cover addresses are fetched |
| WeRead section | You entered an API key | Requests with your key to the WeRead gateway at `weread.qq.com` |
| Music player (off by default; not on phones) | You search or play | Requests to `music.163.com`; the optional sign-in uses a window of that site |
| Git sync (off by default) | Fetch, pull and push, by hand or on a timer | Git connects to the remote you configured. Commits stay on this computer until you push |
| Agents and scripts | You run them | Whatever the CLI or your script does. NAND does not control it |

## Git sync

Git sync is off by default. When it is on, NAND starts the `git` of your computer in the vault folder. Git connects to your remote only when you pull, push or fetch, by hand or on a schedule; committing happens locally. NAND neither asks for nor stores account names and passwords: sign-in is handled by Git's credential helper or your SSH agent, and the Git error text shown to you has the account and token in addresses masked.

What gets committed is the files of the vault. Notes, attachments and the settings in `.nand/` that are not excluded by `.gitignore` all go into the repository, including recovery drafts, browser history and the settings file with any API key. Check who can read the remote before you push, and add the paths you do not want to publish to `.gitignore`. The clock and pause state of automatic sync are written only to `.git/nand-sync.json`, which is not committed. See [Git sync](sync.md).

## Material handed to agents

Web page text and screenshots are untrusted material. When you attach them to a running agent session, NAND pastes them into the input as a bracketed paste and does not add Enter at the end. Escape and other control characters in the material are removed so that a piece of page text cannot end the paste by itself and turn into a keystroke. Shell sessions do not inherit the browser variables meant for agents. The browser token stays in the memory of the current run; the `connection.json` file written for the CLI holds only the endpoint, no token. Turning the browser off removes the known temporary files of that run. It does not recursively delete `.nand/recovery/` and does not take away attachments already handed to an agent.

The native CLI history is read-only. Ownership is decided by the real path of the vault, so a similar folder prefix does not bring sessions from outside the vault into view. NAND does not change the CLIs' own log files.

## Files outside the vault

Some features write outside the vault; all of them are described in the guides:

- **Status hooks.** NAND adds a small status hook to the user configuration of Claude Code, Codex, Gemini, Grok, Pi and OpenCode, and keeps a `.nand-backup` copy of merged files. The hook only acts for processes that NAND started. See [Agent workbench](agent-workbench.md#status-hooks).
- **Separate agent logins.** If you give Claude Code or Codex an account ID, the login is kept in the plugin folder, which is inside the vault's `.obsidian` folder. Keep it out of Git and shared sync.
- **Browser files.** Temporary connection files and delivered attachments are in Obsidian's application data folder, see [Browser](browser.md#local-run-files-and-attachments).
