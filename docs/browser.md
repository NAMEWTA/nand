English | [简体中文](browser.ZH.md)

# Browser

The built-in browser opens web pages as pages of the workbench. Turn it on under **Settings → General → Modules → Browser**, then click the globe icon in the rail or run `NAND: Open web page`. The browser is independent of the dashboard and the terminal. On a phone there is no built-in browser: the command and board web shortcuts open the page in the system browser.

Open pages are tabs above the page (column 3) and entries in the side panel (column 2). **New page** opens a blank page. Closing a page switches to the neighboring one and does not close the workbench. Up to 50 pages can be open. Use **Open in a native tab** or **Open in a split** from the page header menu for a page of its own leaf. Turning the browser module off closes every page and the local connection.

## AI workspace

**MAIW history migration** on the task list accepts v3 JSONL files up to 50 MiB. Review counts, source records and conflicts, then **Import reviewed history**. Invalid versions, unknown fields, duplicate identities, orphan records and nonofficial panel URLs are rejected before writing. Unchanged source records are skipped on repeat import, preserving local edits; changed content with the same source ID blocks the import. Local changes invalidate a pending preview. Keep the source file. A failed save retains the complete pending draft; use **Retry saving** or the recovery reader to inspect it and any records already saved. Retrying never sends website input.

Imported questions, combined prompts, applied template snapshots, original statuses and answer bodies remain readable and searchable. Plain text and Markdown are both preserved. **Imported MAIW history** is unverified: reported completion does not prove website identity or capture coverage. V3 has no verified conversation/message identities, full acquisition snapshots or independent template library. Applied templates have no source revision; NAND uses a local snapshot revision, not an inferred upstream version. Historical panel layout metadata is retained for v3 export. Targets start with no recipients selected or pages open. For future rounds, choose a local account and **Bind selected account**, then explicitly open and verify the website; historical snapshots remain unchanged.

**Export MAIW v3** selects tasks and previews all saved rounds, current answers and applied templates, then saves a new `.maiw.jsonl` file under `Exports/`. Account settings, journals, earlier capture revisions and the independent template library are excluded. V3 allows one current panel per website; extra same-site panels remain as historical answer records. Imported records retain supported source fields, including original statuses and official panel URLs. User-authored content is not redacted. Native URLs use validated official locations. Content exceeding v3 limits is rejected without truncation; use Markdown export for it.

Choose **AI workspace** in the browser side panel to create a task with a title, AI website and browser account. Opening a task reads its saved documents; it does not open a website or resume a submission. Drafts save as you type. Pinning a task keeps it at the top of the task list.

Open **Prompt library** on the task list or beside the question to create, edit, preview, reorder or remove Markdown templates. Select several templates in a task; they precede the question in library order. The selection and order survive restart. **Preview send** shows the exact combined prompt, including when only templates are selected. Saved rounds retain the template IDs, revisions, titles and bodies used at the time; expand **Templates and prompt sent in this round** to inspect them. Later edits or removals leave those copies intact. An outdated editor must reload a changed template before saving. Removing a template clears current selections and marks its local Markdown document deleted while retaining its text; it does not change a website conversation.

**Task history** searches task titles, question drafts, saved questions and answer revisions. Rename and pin tasks from this list; renaming keeps their stable identity. Open a task to read its rounds without reopening a website. **Delete local task** first lists the affected task, rounds and answer documents, including answers from targets removed earlier. Confirming marks those documents deleted locally and keeps their Markdown text. Other tasks, templates, exports and website conversations remain available. If the reviewed content changes, review it again before deleting.

Use **Export Markdown** to choose tasks, website targets and either all rounds or each task's latest round. The preview includes questions, frozen combined prompts, current answer versions, source and completeness. A latest partial or missing answer does not fall back to an older complete version. Copy the exact preview or save it as a new Markdown file under the workspace folder's `Exports/` directory. Export files are ordinary documents outside task deletion. Sending journals, account partitions, credentials and raw network payloads are excluded.

Choose DeepSeek, Kimi, ChatGPT, Claude, Qianwen, Doubao, Coze or MiniMax, then **Open official page**. Sign in on that page if needed, then explicitly **Use current conversation** or **New website conversation**. The latter must verify an empty website context before the target becomes ready. Each task page keeps its selected account. After reopening a page, verify its new instance before sending. Login or verification screens remain available for manual action and block task submission.

Use **Add target** to include another website and account in the task. Added targets start unselected. **Remove target** closes its current page and keeps saved rounds and answers. **Select all targets** and **Clear recipients** change the sending selection. **Show page** controls visibility separately and remains available while answers are being collected.

Each open website panel has **Move panel earlier/later**, a keyboard-accessible **Relative panel width** slider, and **Maximize panel / Restore panel layout**. These change presentation only: sending recipients, question drafts, website instances and frozen send previews remain intact. Panels share available width and wrap when needed; narrow windows show one focused panel with buttons to switch between visible sites. Layout preferences survive restart, while website pages remain closed until explicitly opened. The page toolbar's **Reload** refreshes that page without submitting a question; verify the website again if its conversation or state changes.

Enter a question and choose **Preview send**. Every selected page is checked again without typing or changing focus; each target shows its readiness or reason for stopping. The default preview requires every target to be ready with an empty website draft. **Preview ready targets only** reviews the ready subset without changing the task's saved selection. Review the exact prompt and recipients, then choose **Send this preview**. All selected drafts must pass readback before any submission. Each send creates a separate round, including repeated questions. Submission, answer completeness and saving have independent statuses. A confirmed answer whose write failed remains complete with **Save failed**; **Retry saving** only retries local storage.

**Pause task** stops further task operations. **Pause and use page** also reveals the selected page for manual work. An already accepted website submission may continue generating there. **Recheck targets** reads current readiness after manual work; it does not resume sending. While a task owns a page, the control API and local bridge can read it but cannot write, activate or close it. Restarting, closing a task or disabling the module never automatically resends a question. Restored documents and answers remain readable on mobile; website control requires desktop Obsidian.

**Collect this answer again** reads the answer linked to its confirmed submission on the same verified conversation. It preserves website drafts and creates no send attempt. Unknown submissions require review and cannot be matched by question text alone. Each collection saves a new revision: a new partial capture stays incomplete even if an earlier one was complete. Expand **Earlier saved captures** to read previous versions. **Retry saving** can persist a collected answer after a write failure without collecting or submitting again.

For an unsent, paused or unknown submission, **Review resend** checks that single target again and displays the original round's exact prompt and current account binding. An unknown earlier attempt carries a duplicate warning. **Resend to this target** creates one new attempt only after confirmation; successful targets and the round's original prompt remain intact. Editing the task or rebinding the page requires a new preview. A changed website draft blocks submission.

Choose 2–3 saved answers in a round and select **Compare answers**. Wide windows show the answers together; narrow windows provide target buttons to read one at a time. A comparison keeps its selected capture versions. If a new capture arrives, the old selection is labeled **Earlier version**; select it again to compare the latest capture. **Capture details** shows the source, adapter version and conversation/message IDs. Unverified model names stay unverified. **Copy answer Markdown** copies only the displayed capture. **Open original answer** uses that answer's account and official conversation, then locates the public answer by message and parent IDs. If the message is not loaded or its identity cannot be verified, it reports that limit without guessing from text.

**Ask this target** selects one existing conversation for the next question and focuses the question editor. It preserves the draft and page visibility; edit the question and review the displayed recipients before sending. A target rebound to another conversation cannot receive this follow-up. Empty captures, confirmed conversation-title-only content and website status text stay incomplete, even when generation ended.

When verified conversation data is unavailable, collection can use the current answer's website copy control. It accepts only content that matches the whole loaded answer, preserves the system clipboard and does not focus the webpage. Unsupported, ambiguous or delayed copy responses fall back to the scoped page content. Website-copy captures remain incomplete because full answer coverage has not been verified; their source and limitation appear beside the answer.

Task, round and answer Markdown lives under **NAND/AI Workspace** by default. Set a visible vault folder under **Settings → Browser → Workspace folder**; it applies after restarting the browser module, and existing files stay in their current folder. The device send journal contains submission identities and prompt hashes under the private browser folder.

Each website's answer saves as soon as its collection finishes. If a document cannot be written, later answers also enter a recovery snapshot under `.nand/recovery/drafts/`, scoped to this device and workspace folder. Separate snapshots preserve earlier runs if saving fails again after restart. Choose **Review local recovery**, select a snapshot by its time and answer count, inspect it, then **Restore reviewed draft**. Restoration merges with current documents and does not send questions. A changed preview requires another review; conflicting edits remain available for reading and copying instead of replacing current documents. This reader is also available when a damaged send journal prevents task loading. Repair unreadable files and choose **Reload tasks**; existing content is retained.

The production task interface and DeepSeek/Kimi/ChatGPT/Claude/Qianwen/Doubao adapters have been tested with local Electron fixtures. Real accounts and current website compatibility remain unverified. When identity or completion cannot be established, the task reports the failure or an incomplete answer, with an explanation beside it. Kimi and Doubao only use passively observed history pages. ChatGPT, Claude, Qianwen and Doubao require an identified current conversation branch, exclude private content and require explicit completion evidence. Message relationships are not inferred from timestamps or array order. Qianwen retains ambiguous text fragments as incomplete instead of selecting or merging them. Missing history or unfinished message states keep answers incomplete; an exhausted Doubao cursor alone does not prove a complete parent chain or finished answer.

Validation status, October 11, 2026:

| Provider | Local Windows Obsidian fixtures | Real account and current website |
| --- | --- | --- |
| DeepSeek | Passed: native input, current-answer identity, three rounds, long answers and restart | Unverified |
| Kimi | Passed: rich-text input, passive pagination and current-answer capture | Unverified |
| ChatGPT | Passed: native input, current branch, public answer and completion checks | Unverified |
| Claude | Passed: native input, current branch, repeated text and restart | Unverified |
| Qianwen | Passed: current branch and conservative handling of ambiguous fragments | Unverified |
| Doubao | Passed: cursor/parent checks and conservative completion handling | Unverified |
| Coze | Passed locally; limited to scoped page/copy capture, with incomplete coverage | Unverified |
| MiniMax | Passed locally; limited to scoped page/copy capture, with incomplete coverage | Unverified |

These checks use controlled pages in real Windows Obsidian. Recent runs used Obsidian 1.14.4 with installer 1.13.7 / Electron 43.3; they do not establish compatibility with authenticated websites. The DeepSeek/Kimi/ChatGPT live-account gate remains unverified, independently of the five later adapters. macOS/Linux browser behavior, phone hardware, operating-system IME composition and real CLI-account synthesis/assistant runs also remain unverified. The user chose to defer account acceptance; no credentials are needed for the local checks.

Coze uses scoped public page content and the website's answer-copy control, with no response acquisition hook. It requires explicit conversation, message and parent identities; unavailable identities block sending or capture. Coverage remains unverified, so saved answers stay incomplete. Both official Coze hosts can be selected through the page, but changing hosts requires rechecking the target. No conversation permalink format has been verified: **Open original answer** can locate the answer only while its original page instance remains available. Saved Markdown remains readable after that page closes. Local fixtures verify three rounds, long answers, repeated text, copy boundaries, host rechecking and restart; real-account compatibility remains unverified.

MiniMax follows the same scoped-page/copy policy, with its own message selectors. The allowed entries are `agent.minimax.io`, `chat.minimax.io` and `agent.minimax.cn`; a host change requires explicit rechecking even for an empty conversation. The `chat.minimax.io` entry redirected to `agent.minimax.cn` during the October 11, 2026 review. MiniMax results stay incomplete and original-answer navigation requires the captured page instance. Local fixtures verify three rounds, copy boundaries, both alternate hosts, closing and reopening the official homepage, and restart. Coze and MiniMax can reopen their homepage after a saved conversation's page closes; verify the displayed context again before sending. Real accounts, current private website markup and conversation permalinks remain unverified.

### Answer synthesis

**Enable answer synthesis** is off by default. Choose specific saved capture versions, a title, an instruction and a target, then **Review synthesis material and target**. The preview retains each selected source, question, provider, version and completeness, including explicitly selected partial answers. Imported MAIW transcripts have no verified capture versions and are not offered here. Ordinary website sending and recollection do not call an additional model.

**Run automatic synthesis** uses one additional call through the selected configured agent. **Authorize and run once** consumes that preview; it does not submit to any website. Running, needs-attention, completed, cancelled, interrupted and timeout states come from the agent owner. Use **Open running agent** when it needs attention, or **Cancel synthesis**. A completed text result and reported token usage are recorded independently. **Paste into an existing session** only pastes the reviewed material: submit it yourself there. A paste receipt is not model completion, and this mode does not collect a synthesis result from the terminal.

Records are visible Markdown under the workspace folder's `综合/` directory. Each stores the exact instruction, prompt, selected source copies and capture references separately from original answers. Read them in the task or **Synthesis records** on the task list; they remain available after deleting the original task. Source links open the official conversation where a supported URL exists. Agreement between answers is not evidence of truth.

An unavailable agent requires enabling the Agent module and configuring its CLI/account, then refreshing the list. Failed requests retain original answers. A failed result write keeps the completed text available for copying and recovery; **Retry saving** never repeats the model call. Concurrent edits to a saved request cannot silently change the sources associated with its result: the result remains in recovery for review and conflict resolution. A saved unfinished request becomes interrupted on restart and is never resumed automatically. Local owner-capability fixtures verify this integration; real CLI-account synthesis remains unverified.

### Selected excerpts

Use **Select element** on an official page opened by a task. In the selection preview, explicitly choose a saved round and **Save selected excerpt**. This saves up to 2,000 characters with the page, account, page instance, URL, selector and selection bounds. Public conversation/message IDs are included only when the selected element declares them. Associating a round does not establish message identity.

Excerpts remain incomplete and separate from website capture versions. They never replace the current answer. Choose an excerpt in a comparison's version selector, or explicitly include it in opt-in synthesis to explain that region. Comparison still needs 2–3 different targets in the same round. The task's Markdown retains the excerpt and provenance; current-answer export continues to use the current website capture.

### Website adapter rules

Open **Website adapter rules** in a supported official page's toolbar. A rule is scoped to that provider, exact official origin, account and URL pathname. Use an exact pathname, or a final `*` for a prefix. Choose or type three CSS selectors: composer, submit button and answer content. **Select an element on the page** uses the existing selection tool; then use the selection for the appropriate role. An answer selector must match one content region inside each public assistant message. Replace a selector tied to one old message with a reusable selector before verification. Rules do not supply missing website message identities.

**Save candidate** writes a visible Markdown record under `<workspace folder>/适配规则/` and does not enable it. Describe the verification scenario and enter one question. **Precheck and preview verification** creates a local task and reviews the exact account, rule version, selectors and prompt without typing. **Send verification once** performs one submission through the normal task safeguards and saves its receipt and partial answer. Review that answer, then **Confirm answer and enable rule**. NAND rereads the current message and selected content before saving the verification links and enabling the rule. Failed or unknown submissions cannot enable it or replay the consumed send.

An enabled rule applies to matching future actions. Existing task bindings need **Use current conversation** again when the rule changes; their previews display the bound rule version. Editing a saved definition creates a new candidate version and removes its verification. **Withdraw rule** revokes its use immediately; future actions use the built-in adapter after reviewing the target again. Conflicting enabled rules stop the action and require withdrawal of the conflict. **Pause and use page** on the target revokes the current task's page ownership. Restarting or disabling the module discards candidate verification permissions and never replays a send. **Retry saving** retries only a failed local rule write.

## Scoped web assistant

Open **Browser → Web assistant** and enable **Set up a web assistant task**. Choose an agent, a goal, specific open pages and the permitted operations. Each page is bound to its current account and guest instance. Review the full prompt, page list, operation limit (including observations) and time limit, then authorize one run. The limits are at most 200 operations and 30 minutes. The Agent module must provide the selected installed agent; opening the assistant does not start it.

A fresh run calls the selected agent once and gives it temporary access only to the reviewed pages and operations. It cannot open or close pages, enumerate other pages or execute page JavaScript through this grant. Choosing an existing session only pastes planning material: it does not attach browser access or mean that the task ran. Website text is observation data and cannot expand the authorization.

The original page shows the active task with **Pause**, **Stop** and **Take over this page**. These revoke the run's access; takeover returns control to the same page. Closing or replacing a guest, disabling Browser, expiration or the operation limit also ends access. **Review a new run** creates a new authorization using previous evidence and fresh page observations. It never reuses an old confirmation or automatically resumes a task.

Clicks and key presses require a separate, one-use review of the visible control, current form content and declared destination. Filling a draft does not require this extra confirmation. Declining, changing the reviewed material or leaving the request unanswered for one minute prevents the action. A missing declared destination or a sensitive credential form requires manual takeover. This review covers observable page content; it cannot establish what hidden website scripts will do. Check the resulting page evidence before treating a submission as accepted.

Tasks, full prompts, step evidence, final output and reported usage are saved as independent Markdown documents under `<workspace folder>/网页助手/`. An action acknowledgment and an agent's completed response are shown separately from website acceptance. After a restart, unfinished tasks become interrupted and unfinished steps have unknown results; no page action is replayed. **Retry saving** writes retained results without rerunning the agent. **Review local recovery** reads this device and workspace's drafts even if the main documents cannot load. Select and inspect a draft before restoring it; changed documents are checked again, conflicts remain available to read, and restoration never starts a task.

The local integration has been exercised with controlled Electron pages and a fixture at the public agent interface. Live websites, actual CLI accounts, SSO/passkeys and mobile native control remain separate acceptance gates.

## Reusable browser workflows

Open **Browser → Browser workflows** to save a finite sequence of observations, reads, fills, clicks, key presses and navigation. Add an explicit page scope with its account, origin and path prefix. **Inspect page elements** reads the selected page’s accessibility roles and names; use a unique match in each step. Every step needs before and after checks. A fill also needs the expected current field value and a check of the resulting value. There are no scripts, loops or automatic retries.

Variables can be text, numbers, booleans or secrets. For each manual run, choose the pages and variable values, review the scope, then start. Manual input reveals the selected page. Submission-capable actions require another confirmation on that page, bound to the current action and its contents. A changed input value stops a fill instead of overwriting someone’s draft. Secrets stay in memory; a workflow declaring secret variables omits observed values, page evidence and result text from its saved run documents.

**Take over this page** pauses the run and releases control. **Resume with fresh checks** checks the same page and account again. If an earlier action may have happened, resuming checks its result without repeating it; unresolved results stay paused. **Stop** prevents further steps but does not undo website actions. Runs are limited to ten minutes, including pauses, and 200 browser operations. Closing a result page does not stop its run. Restarting Obsidian interrupts unfinished runs and never replays them.

After a successful run, **Mark these verified steps reusable** makes that exact version available in Automations. Editing the definition requires verification again. Automations stores the single run ID and receipt; browser documents contain the step checks and results. A save failure stops further actions; retrying the save only writes the retained record.

Templates are visible Markdown under the workspace’s `流程/` folder, with run documents under `流程/运行/`. Do not put secret defaults or secret literals in templates. See [Automations](automation.md#browser-workflows) for explicit page selection, scheduling and module shutdown behavior. Controlled local pages have been tested in native Windows Obsidian; real-account website acceptance remains unverified.

## Address bar and toolbar

The address bar accepts full addresses (`https://example.com`), bare domains (`example.com`) and local addresses (`localhost:3000`). Local hosts (`localhost`, `127.x.x.x`, `0.0.0.0`, IPv6 literals) use HTTP; other domains and `host:port` use HTTPS. Anything else is searched with your search engine: Google (default), Bing or DuckDuckGo, set under **Settings → Browser**. Addresses with a user name or password, file paths and schemes other than http(s) are refused.

The toolbar has back, forward, reload or stop, find, zoom and select element. The **More actions** menu has hard reload, copy address, open in system browser, developer tools, screenshot, full-page screenshot and annotate screenshot. While the address bar, toolbar or find field has focus, `Ctrl/Cmd+L` selects the address and `Ctrl/Cmd+F` opens and focuses find. Esc closes find and returns to the page; in a browser dialog, another Esc closes the dialog. These local shortcuts follow the focused browser pane, including popout windows. The webpage and note editor keep their own shortcuts. A page that fails to load offers **Retry** and **Open in system browser**.

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

Pages using the same account in a vault share sign-in state. The default account retains the vault's existing login session. Under **Settings → Browser → Browser accounts**, create named isolated accounts for separate logins and site permissions. Open an account from this list, or choose it in a page's account selector to open a new page with the same address. Each existing page keeps its original account. Different vaults use separate sessions.

You can rename or delete an isolated account. Deletion lists its affected pages for confirmation, closes those pages and clears only that account's website data and permissions. If the page list changes, review and confirm again. An interrupted deletion remains available to retry; it cannot open new pages. The default account cannot be deleted here.

A sign-in pop-up with a name or window features keeps its link and account session from the page that opened it; an ordinary link to a new window opens as a NAND tab using the same account.

Downloads use the system save flow. The browser shows progress, cancel, open file and show in folder. Closing the page cancels downloads that are still running.

The Obsidian workspace stores each page's account ID, address, title, zoom and a restorable scroll position; pages that are not active load later. Switching between tabs keeps the page alive. Moving a page to a new window, or from a dialog to a tab, rebuilds it, so an unsubmitted form can be lost. Turning the module off releases pages and the local connection but keeps sign-in data and settings; native tabs then show that the module is off, and turning it on again restores them.

The latest 500 history entries and the site permissions are stored in `.nand/browser/<device-id>/state.json` and feed address suggestions. Cookies live in Obsidian's local Electron session on this computer, not in the plugin settings or the vault sync files. A page address can still be synced through the Obsidian workspace file.

## Let agents use the same pages

This is off by default. Turn on **Let agent sessions use the browser** under **Settings → Browser**; only then does NAND start a local connection. With it off, no terminal starts one. It needs Node.js on this computer; nothing has to be installed globally.

Shell sessions and terminal scripts do not inherit the `NAND_BROWSER_*` variables. Only agent sessions that NAND starts get the current connection: `NAND_BROWSER_CLI`, `NAND_BROWSER_CONTEXT`, `NAND_BROWSER_TOKEN` and `NAND_BROWSER_GUIDE`. NAND's managed Obsidian context skill tells the agent to read the usage guide. An agent that is already running without these variables can use the explicit connection below.

**External client with a limited grant.** Open **Browser → Local access**, enter the task or purpose, select the already loaded pages/accounts and allowed operations, then review and create the connection. This page is also available from **Settings → Browser → Manage local access**. Merely opening it starts no connection. Grants last 1–30 minutes and allow at most 200 browser operations. Page listings contain only the selected live page instances. A replacement guest, another account or another task is rejected.

The connection command appears once and supplies `NAND_BROWSER_CLI`, `NAND_BROWSER_CONTEXT`, `NAND_BROWSER_TOKEN` and `NAND_BROWSER_TASK`. Copy it to the local client's terminal and keep the task variable with the token. Credentials stay in memory; the connection JSON contains only the local endpoint. Closing the access page keeps its grants active. **Revoke access** invalidates a connection, while **Revoke access and take over** on the original page revokes every grant for that page and cancels waiting actions. Expiry and module shutdown also stop queued actions. A dispatched action remains returned or unknown; it is never replayed or undone automatically. Restarting creates no grants.

Limited grants expose observations, element reads, screenshots, explicit page reveal/navigation, guarded fills and confirmed clicks/key presses, according to your selection. They cannot create or close other pages or execute scripts. Reads do not reveal a page or take keyboard focus. Input requires a visible page, a fresh snapshot reference and page ownership; another workflow or client keeps its existing control. `fill` additionally needs `--expectedValue` matching the current draft (`--expectedValue=` for empty). A click or key press waits for the same final action review on the original page; without confirmation it fails. CLI failures include symbolic `code`, `reason` and `retryAction`, without raw native exception text.

The session-wide setting above and **Copy CLI connection command** give broader access to this vault's pages, including page creation and closing. Turning that setting off invalidates its credentials and queued input; enabling it again issues a new credential. Explicit limited grants have their own lifetime. Both use the same local named pipe/socket and existing native browser controller; neither opens a network server.

PowerShell examples:

```powershell
node $env:NAND_BROWSER_CLI tab list
node $env:NAND_BROWSER_CLI tab create --url http://localhost:3000
node $env:NAND_BROWSER_CLI snapshot --page PAGE_ID
node $env:NAND_BROWSER_CLI click --page PAGE_ID --revision SNAPSHOT_REVISION --element '@e2'
node $env:NAND_BROWSER_CLI fill --page PAGE_ID --revision SNAPSHOT_REVISION --element '@e3' --value 'test text' --expectedValue=
node $env:NAND_BROWSER_CLI screenshot --page PAGE_ID --full --output screenshot.png
```

Use the real `PAGE_ID` and `SNAPSHOT_REVISION` values. Every operation returns JSON. After navigation, a reload or a stale element, take a new snapshot; element references from another page or an old snapshot are rejected. The screenshot output path must not exist yet.

Reading a live background page keeps the foreground page and keyboard focus. Saved pages that have not loaded must first be opened with `tab switch`. Screenshots require a visible page and report this immediately for hidden pages. `tab list` includes each live page's account and generation; pass `--profileId` and `--generation` to reject a replaced target. Moving a page to another window creates a new generation, so list pages and take a fresh snapshot before continuing.

Typing, clicking and other native input also require a visible page. Use `tab switch` explicitly to reveal the target; input focuses that guest. If focus leaves before dispatch, the action fails instead of taking focus back. Reading a page and navigating its address do not reveal it.

| Capability | Commands and main arguments |
|---|---|
| Pages | `tab list/create/switch/close`; `create --url`, the others take `--page` |
| Navigation | `goto --url`, `back`, `forward`, `reload [--hard]`, `stop` |
| Understanding | `snapshot`, `get --element`, `screenshot [--full] [--output]` |
| Interaction | `click`, `dblclick`, `hover`, `focus`, `fill --value`, `type --value`, `select --value`, `check --checked true/false` |
| Drag and keyboard | `drag --from @e1 --to @e2`; `keypress --key Enter` or `Control+a` |
| Page | `scroll --direction down --amount 600`; `viewport --width 1280 --height 800` (0 for both resets) |
| Waiting | `wait --text`, `--url`, `--selector`, `--load load/domcontentloaded/networkidle`, `--timeout` up to 60000 ms |
| Debugging | `console`, `network`: the latest 100 diagnostic summaries each, recorded from the first time control is attached |

Element operations also need `--revision`. A value that starts with `--` can be written as `--value=--example`. References carry the iframe they belong to; dragging across iframes is refused with an error. Developer tools can disconnect the control connection on some Electron versions; browsing keeps working, and closing developer tools and reopening the page restores control.

Console summaries contain the event type, timestamp and argument types. Network summaries contain resource type, timestamp, cancellation and symbolic failure code. Raw console arguments, request URLs, headers and bodies are not retained in these diagnostics. Closing the guest clears its summaries and listeners.

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

Desktop Obsidian, HTTP(S) sites and local services. Some sign-in services refuse embedded browsers, and DRM or browser-extension features may be limited; use the system browser then. A very large page is refused as a full-page screenshot; capture the visible area instead. Named accounts use separate local browser sessions. External cookie import, SSH network forwarding, remote browsers and an MCP server are not provided.

Windows review runs cover local browser control, account isolation and provider fixtures in real Obsidian; provider fixtures do not establish live website compatibility. Other host checks are listed in [Validation](../speculo/.speculo/specdev/context/validation.md). Chinese text typed by automation is not the same as a verified operating system input-method composition.

Browser interaction and parts of the algorithms follow [Orca](https://github.com/stablyai/orca/tree/d74388f8a2dad2bd4bbfe3b937aba66e6648258b) under its MIT license; see [Orca sources and adapted parts](third-party/orca-terminal-workbench.md).
