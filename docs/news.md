English | [简体中文](news.ZH.md)

# News

News collects RSS, Atom, JSON Feed and configured static web lists into the NAND workbench. Optional analysis uses an installed CLI agent and its selected account. Enable News in **Settings → Modules**, then configure it in **Settings → News**. Collection, analysis, background refresh and daily-note writing start disabled. The module runs on desktop; saved Markdown remains readable on mobile and without NAND.

## Sources and collection

Add a feed URL in **Sources**, or import OPML. Imports merge sources by URL and preserve existing configuration. Imported feeds start unlisted; assign a tier and participation role deliberately. OPML export preserves the supported NAND source options.

Static web lists require selectors for the item, link and title; a date selector is optional. Preview checks the selected items before collection. These sources read returned HTML without executing page scripts. A page that requires client-side rendering needs another source.

A verified public example is the [Go blog](https://go.dev/blog/): item `p.blogtitle`, link `a`, title `a`, date `.date`. Its “More articles” link also matches that item selector and has no publication date. Selectors may need updating when a site changes its HTML.

**Refresh** collects enabled sources. Startup refresh, refresh when returning to stale content, and periodic refresh are separate opt-in settings. The source list shows health and failures. First-import history, missing publication dates and old reports remain available without being promoted into today's edition.

## Analysis and reading

Repeated collection reuses a report's identity. Whitespace-only changes do not create a content revision; a changed title, body or summary does. A feed that later omits body or summary retains the stored text. Another source linking to the same canonical article does not overwrite its original source or content. While the cache is retained, rotating back to an earlier accepted text keeps the current revision and avoids another analysis.

Enable analysis and select an installed agent in News settings. The agent and working directory are device-specific; a blank directory uses the vault. CLI login, trust and permission prompts remain under the CLI's control. **Open terminal** shows a running request when it needs attention.

**Analysis batch / brief timeout (minutes)** defaults to 10 and accepts whole minutes from 1 to 120. An analysis batch shares one deadline across its initial reply, format repair and independent second score; each brief has its own deadline. An expired batch cannot start another repair or scoring call, and an unsent call does not use quota. A timed-out call stops its terminal. Completed terminals close by default; enable **Keep completed terminals for inspection until News or Agent is turned off** to reopen them from run history. Format repair reuses the same terminal. Retained terminals are released when either module stops and are not restored after restart.

**Local filters before AI analysis** can exclude literal blocked terms, short title/content combinations, or declared feed languages before a new call, including explicit reanalysis. Terms ignore case and normalize character width; use one entry per line. Language comes from RSS, Atom or JSON Feed metadata: `en` accepts `en-US`, while a report without language metadata remains eligible. Empty lists and a zero minimum disable these filters. Raw reports remain readable. Clearing a filter lets pending reports be analyzed; it does not reanalyze completed revisions or discard saved replies.

**Category and tag vocabulary** configures categories, topic tags and entity tags, one value per line. Keep at least one category; each list allows up to 200 values of 100 characters. The prompt and reply validator use the same vocabulary. A durable batch retains its vocabulary for restart recovery. **Restore default vocabulary** resets the lists without making an AI call.

The four prompt templates have explicit **Save changes** and **Restore all four default templates** controls. The displayed effective SHA-256 includes the expanded templates, dependencies, vocabulary, interests and body excerpt limit; unsaved template edits do not change it. Unknown variables and missing or recursive includes prevent saving. A failed save retains the draft and restores the affected saved settings. Template or vocabulary changes apply to new analyses; completed revisions require explicit reanalysis. Changing score weights or featured thresholds recalculates saved scores locally.

Analysis, format repair, independent second scoring, event merge review and in-depth briefs share the daily call limit (20 by default). The limit follows the device's local calendar day. A known failure before submission costs no call; an interrupted request with an unknown outcome keeps its reservation. Retrying that request is explicit and can consume quota. Available native usage is shown; missing cost data is labelled unknown.

**Detailed summary score floor (exclusive)** defaults to 50 and accepts 0–100. The comparison uses the unrounded mean, so a mean of 50.5 exceeds 50 even when the displayed score is 50. Tier-qualified material remains eligible. Changing the floor recalculates existing analysis locally.

**Event recall and relation confidence** controls the retained-candidate window (1–365 days, default 14), minimum lexical similarity (0–100%, default 25%) and relation confidence (0–100%, default 80%). Save or restore defaults explicitly. These settings apply to new analysis batches. Each durable batch stores its candidate IDs and confidence threshold; recovering an old reply preserves them. Existing event memberships are not reinterpreted when these settings change.

The reader has **Featured**, **All news**, **Hot**, **Today's edition**, **Favorites**, **Sources** and **Run history** sections. Current analysis supplies Chinese titles, summaries, reasons, categories and tags, with raw scoring dimensions available in the detail. Reports retain original titles and URLs. A changed report's old analysis is withheld until that revision is analyzed.

Event details group related reports and developments. Reverse the timeline order, mark a report read or hide it. **Open original** uses the enabled NAND browser, with a system-browser fallback. **Send to agent** lists existing interactive sessions; reopen the list after starting a session. It pastes the selected title, URL and excerpt as one unsent block.

Search, category, tags, sources and minimum score can be saved as a named view. Updating a view preserves its identity; copying creates another. Up to 100 views are retained. Each workbench leaf keeps its own filter, selection and timeline order.

News settings also provides **Hot ranking and trends** and **Daily edition limits and memory**. Save a draft to recalculate existing data without an agent call, or restore that section's defaults. Heat controls include the window, half-life, minimum participants, list length, comparison interval, rising threshold and surge count/share. Ranking and historical curves use the same saved rules; changing them records a new heat rule version and keeps unobserved hours as gaps. Defaults remain 48 hours, 24 hours, two participants, ten entries and a six-hour comparison.

Daily edition defaults are twelve main stories, ten flashes, two main stories per leading source and seven days of publication memory. The controls allow 1–100 main stories, 0–100 flashes, 1–100 main stories per source and 1–30 memory days. Published issues are retained for up to 30 days so extending memory can reuse available issues. An unsaved draft has no effect; a failed save keeps it for retry.

## In-depth briefs

From an analyzed event, choose **Read in depth**. A brief uses up to 12 current, visible, analyzed source reports and the configured interests. Its prompt bounds source excerpts and preserves the exact cited URL set. A valid reply needs populated **背景**, **影响** and **时间线** Markdown sections and links to every supplied source.

Success is reported after the reply is written to a visible Markdown note. The detail renders that saved note and provides **Open saved note**. Regeneration uses quota. Renaming a brief within `NAND/新闻/` preserves its identity, and regeneration keeps reader annotations and extra frontmatter.

If the generated region was edited, or an open editor has unsaved changes, NAND leaves the old note intact. The received reply remains in run history. **Retry saving (no CLI call)** applies it locally after the conflict is resolved; it does not invoke an agent again. Restart also attempts to apply durable, unsaved replies locally. An interrupted CLI request instead requires an explicit retry that may use quota.

Notifications default to failures in the in-app inbox. Choose always, failure-only or never, and select available in-app/system channels. Each run outcome has an idempotent notification; **Open** resolves it through News's run history. Disabling Notifications does not prevent saving a brief.

## Home widgets

In Home's **Board widgets**, add **Featured news**, **Hot news** or a **News view**. **Create and add** makes a separate instance; **Configure** changes that instance wherever it is used. Each has its own name, item limit (1–50), summary switch and stale threshold (15–1440 minutes). A view widget refers to a saved view by its stable ID. Featured and view lists show one matching report per event; hot entries open their event detail. The heading opens the corresponding News section or saved view.

Widgets show the latest successful source update and current collection/analysis activity. **Refresh** shares source requests and respects their due time and retry backoff. Automatic stale refresh runs only when **Refresh stale news when opened** is enabled and the widget is visible, using its threshold. Opening a widget never enables collection or analysis. Removing a widget from a board releases its own resources while an already requested global refresh can finish.

**Settings → News → Home news widgets** creates, configures and deletes instance configurations. Removing board membership keeps its configuration. Deleting a configuration leaves a placeholder on its boards; a missing saved view asks you to choose another. Turning off News retains both the board references and configurations, and turning it on restores available instances.

## Favorites, editions and storage

**Collection and note storage** lets you save a material retention period of 1–365 days (default 30), switch adaptive collection intervals on or off, and choose favorite and daily-note folders. With adaptation off, a source uses its configured interval; failure backoff still applies. Changing a source interval updates its due time locally. Retention applies on the next cache write and never deletes visible Markdown or changes the separate 30-day CLI receipt window.

Folder paths must be visible folders inside the vault. Changes affect new notes. Existing favorites, briefs and daily editions keep their identity and location, including after a manual move to another visible folder and restart. NAND discovers them by their `nand-type` and `nand-id` metadata and updates only its untouched managed content. Keep these properties when moving a note.

**Save** writes one favorite note containing the Chinese title/summary when available, its source URL, score and tags, plus your annotations. It does not copy a full article automatically. Your notes outside the generated region survive refreshes; changes inside that region prevent replacement.

Today's edition uses local midnight-to-midnight boundaries and defaults to seven prior local days of compilation memory. Opening it is a read operation. **Rebuild edition**, successful collection and analysis record the edition; **Write daily note** optionally creates one Markdown file per day. Default limits are 12 main entries and 10 flashes, with at most two main entries from one leading source. Weekly and monthly report views are not provided.

| Data | Location and retention |
|---|---|
| Favorites | `NAND/新闻/收藏/` by default; configurable visible Markdown folder, retained until you remove it |
| Briefs | `NAND/新闻/简报/`; visible Markdown, retained until you remove it |
| Daily notes | `NAND/新闻/日报/YYYY-MM-DD.md` by default; configurable folder, written only when enabled |
| Collected reports, analysis and reader state | `.nand/news/<device>/`; material retention defaults to 30 days and is configurable from 1–365 days |
| CLI receipts and quota | `.nand/news/<device>/runs.json`; 30-day history, including raw replies; clearing the cache preserves history within this window and the current day's quota |
| Shared configuration | `.nand/config/settings.json`; sources, views, widget instances, interests and policies |
| Device configuration | `.nand/config/devices/<device>.json`; agent selection and working directory |

Clearing the cache retains visible notes and can rediscover favorites and briefs from their Markdown identity. Disabling News stops its work and preserves files. If a favorite cannot be indexed, the source note remains on disk for inspection.

Algorithm provenance, pinned upstream versions, formulas and deliberate differences are documented in [AIHOT news references](third-party/aihot-news.md).
