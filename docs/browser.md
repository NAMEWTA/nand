English | [简体中文](browser.ZH.md)

# Browser

The built-in browser opens web pages as pages of the workbench. Turn it on under **Settings → General → Modules → Browser**, then click the globe icon in the rail or run `NAND: Open web page`. The browser is independent of the dashboard and the terminal. On a phone there is no built-in browser: the command and board web shortcuts open the page in the system browser.

Open pages are tabs above the page (column 3) and entries in the side panel (column 2). **New page** opens a blank page. Closing a page switches to the neighboring one and does not close the workbench. Up to 50 pages can be open. Use **Open in a native tab** or **Open in a split** from the page header menu for a page of its own leaf. Turning the browser module off closes every page and the local connection.

## Address bar and toolbar

The address bar accepts full addresses (`https://example.com`), bare domains (`example.com`) and local addresses (`localhost:3000`). Local hosts (`localhost`, `127.x.x.x`, `0.0.0.0`, IPv6 literals) use HTTP; other domains and `host:port` use HTTPS. Anything else is searched with your search engine: Google (default), Bing or DuckDuckGo, set under **Settings → Browser**. Addresses with a user name or password, file paths and schemes other than http(s) are refused.

The toolbar has back, forward, reload or stop, find, zoom and select element. The **More actions** menu has hard reload, copy address, open in system browser, developer tools, screenshot, full-page screenshot and annotate screenshot. `Ctrl/Cmd+L` focuses the address bar; `Ctrl/Cmd+F` opens and focuses find; Esc closes find and returns to the page. A page that fails to load offers **Retry** and **Open in system browser**.

## Board shortcuts

In a Sticky Notes section of a [board](dashboard.md#web-shortcuts), add a card and choose **Web shortcut**. Fill in a name, a URL and **Open in**. A dialog is the default; a tab is the other choice. The card menu can switch the choice for one visit or open the page in the system browser. The dialog has a button that moves the page into a native tab.

A shortcut is stored in the board Markdown, for example:

```markdown
### Dev server
type: web
link: http://localhost:3000/
openIn: modal
```

`openIn` is `modal` or `tab`; when it is missing, `modal` is used. A separate **Web** section type embeds a page in the board itself (configure it with the gear icon: URL and display zoom); its title bar can open the page in a dialog or a tab.

## Sign-in, downloads and restoring pages

New tabs, dialogs and sign-in windows of the same vault share one sign-in state. Different vaults use separate sessions. A sign-in pop-up with a name or window features keeps its link to the page that opened it; an ordinary link to a new window opens as a NAND tab.

Downloads use the system save flow. The browser shows progress, cancel, open file and show in folder. Closing the page cancels downloads that are still running.

The Obsidian workspace stores each page's address, title, zoom and a restorable scroll position; pages that are not active load later. Switching between tabs keeps the page alive. Moving a page to a new window, or from a dialog to a tab, rebuilds it, so an unsubmitted form can be lost. Turning the module off releases pages and the local connection but keeps sign-in data and settings; native tabs then show that the module is off, and turning it on again restores them.

The latest 500 history entries and the site permissions are stored in `.nand/browser/<device-id>/state.json` and feed address suggestions. Cookies live in Obsidian's local Electron session on this computer, not in the plugin settings or the vault sync files. A page address can still be synced through the Obsidian workspace file.

## Let agents use the same pages

This is off by default. Turn on **Let agent sessions use the browser** under **Settings → Browser**; only then does NAND start a local connection. With it off, no terminal starts one. It needs Node.js on this computer; nothing has to be installed globally.

Shell sessions and terminal scripts do not inherit the `NAND_BROWSER_*` variables. Only agent sessions that NAND starts get the current connection: `NAND_BROWSER_CLI`, `NAND_BROWSER_CONTEXT`, `NAND_BROWSER_TOKEN` and `NAND_BROWSER_GUIDE`. NAND's managed Obsidian context skill tells the agent to read the usage guide. An agent that is already running without these variables can use the explicit connection below.

**External agent.** With the setting on, click **Copy CLI connection command** under **Settings → Browser** and give the command to a local agent you trust. It lists the pages of this vault. The token is valid only for this run and travels in an environment variable; it is not written to the connection JSON. After turning the module off or restarting Obsidian, copy the command again.

PowerShell examples:

```powershell
node $env:NAND_BROWSER_CLI tab list
node $env:NAND_BROWSER_CLI tab create --url http://localhost:3000
node $env:NAND_BROWSER_CLI snapshot --page PAGE_ID
node $env:NAND_BROWSER_CLI click --page PAGE_ID --revision SNAPSHOT_REVISION --element '@e2'
node $env:NAND_BROWSER_CLI fill --page PAGE_ID --revision SNAPSHOT_REVISION --element '@e3' --value 'test text'
node $env:NAND_BROWSER_CLI screenshot --page PAGE_ID --full --output screenshot.png
```

Use the real `PAGE_ID` and `SNAPSHOT_REVISION` values. Every operation returns JSON. After navigation, a reload or a stale element, take a new snapshot; element references from another page or an old snapshot are rejected. The screenshot output path must not exist yet.

| Capability | Commands and main arguments |
|---|---|
| Pages | `tab list/create/switch/close`; `create --url`, the others take `--page` |
| Navigation | `goto --url`, `back`, `forward`, `reload [--hard]`, `stop` |
| Understanding | `snapshot`, `get --element`, `screenshot [--full] [--output]` |
| Interaction | `click`, `dblclick`, `hover`, `focus`, `fill --value`, `type --value`, `select --value`, `check --checked true/false` |
| Drag and keyboard | `drag --from @e1 --to @e2`; `keypress --key Enter` or `Control+a` |
| Page | `scroll --direction down --amount 600`; `viewport --width 1280 --height 800` (0 for both resets) |
| Waiting | `wait --text`, `--url`, `--selector`, `--load load/domcontentloaded/networkidle`, `--timeout` up to 60000 ms |
| Debugging | `console`, `network`: the latest 100 entries each, recorded from the first time control is attached |

Element operations also need `--revision`. A value that starts with `--` can be written as `--value=--example`. References carry the iframe they belong to; dragging across iframes is refused with an error. Developer tools can disconnect the control connection on some Electron versions; browsing keeps working, and closing developer tools and reopening the page restores control.

## Design mode and annotations

Click the select-element icon in the toolbar, hover to highlight, click to capture, Escape to leave. The preview shows the element's text, selector, an HTML excerpt, computed styles and a screenshot when one can be taken. A source location is shown only when the page itself provides development source information; NAND never guesses a file path.

From the preview you can copy the text or the screenshot, or choose a running NAND agent and attach it. The material reaches the agent input as local files and text and is **not sent automatically**: check it and press Enter. If the agent's input is not ready you get a notice to try later. Page material is reference content, not a new instruction to the agent.

**Annotate screenshot** in the more menu offers pen, highlight, arrow, rectangle, ellipse, text, undo and redo. An element screenshot can also be annotated, then copied and attached. The agent changes the project source; a site with hot reload updates itself, otherwise reload the page to check.

## Site permissions

Sensitive site permissions are denied by default. The shield menu in the toolbar grants camera and microphone, location, notifications, clipboard read and full screen per site. Sign-in pop-ups use the same session and policy. A cross-origin request does not inherit the permissions of the main page.

Navigation waits at most 30 seconds. Closing or cancelling ends the caller's wait at once. A page that cannot continue safely releases its native guest; click retry or enter a new address to create it again, and an old operation never writes into the new page.

## Local run files and attachments

The temporary connection, CLI and usage guide are kept in `nand-browser/<vault-id>/<run-id>/` inside Obsidian's application data folder. Turning the module off, uninstalling the plugin or a normal quit removes this run's files. A stale run left by a crash is cleaned the next time the bridge starts, without touching other vaults or running instances.

Images and descriptions already delivered to an agent are stored in `artifacts/` in the same vault folder and are not removed when the bridge stops. They are outside the vault, so back them up separately and clear them yourself once no session needs them. Do not delete a run folder recursively as if it were a plain cache while attachments are still referenced from it. The token is never written to these files.

## Supported range

Desktop Obsidian, HTTP(S) sites and local services. Some sign-in services refuse embedded browsers, and DRM or browser-extension features may be limited; use the system browser then. A very large page is refused as a full-page screenshot; capture the visible area instead. There are no multiple accounts, no import of external cookies, no SSH network forwarding, no remote browser and no MCP server.

Real-host verification of the browser covers Linux only, see [Validation](../speculo/.speculo/specdev/context/validation.md). Chinese text typed by automation is not the same as a verified operating system input-method composition.

Browser interaction and parts of the algorithms follow [Orca](https://github.com/stablyai/orca/tree/d74388f8a2dad2bd4bbfe3b937aba66e6648258b) under its MIT license; see [Orca sources and adapted parts](third-party/orca-terminal-workbench.md).
