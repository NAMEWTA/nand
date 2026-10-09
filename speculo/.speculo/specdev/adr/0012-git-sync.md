English | [简体中文](0012-git-sync.ZH.md)

# ADR-0012: Git sync with the system git

Status: accepted. Checked against the code on 2026-10-08.

## Problem

Obsidian Sync does not carry dot-folders, so NAND's own data in `.nand/` needs another way to travel between devices. Git already versions the vault and keeps credentials in the user's own tools. A sync feature must not store credentials, lose either side's history, push while the vault is in conflict or leave processes running.

## Decision

- **A module, off by default, desktop only.** The `sync` module starts at `layout-ready`, because it starts processes and talks to a remote. It is unsupported on mobile: there is no system git and no SSH there, and the module does not bundle a JavaScript git.
- **The system git.** Each git call is its own process (`execFile`) in the repository directory. Prompts are off (`GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never`), messages are in English (`LC_ALL=C`) so failures can be classified, no pager or editor opens, and each call has a timeout: two minutes by default and ten minutes for fetch and push. Turning the module off kills running git processes and refuses new ones. The git binary is found from the device-scoped path setting, then `PATH`, then the usual install locations.
- **Credentials stay with git.** NAND does not ask for, store or log credentials. Authentication is the user's credential helper or SSH agent. Error text shown to the user has account names and tokens in URLs redacted.
- **Where the repository is.** The repository is the one around the vault, or around a folder inside the vault chosen in the device-scoped `repoSubPath`. When there is no repository, the page offers `git init`. NAND never clones a remote into an existing vault.
- **Commit modes.** `smart` commits what is staged and stages everything only when the index is empty and `autoStageOnEmptyIndex` is on; `staged` commits only what is staged; `all` stages every change first. Messages come from templates with `{{date}}`, `{{hostname}}`, `{{numFiles}}` and `{{files}}`. Commit mode resolution and conflict-block parsing are adapted from obsidian-git (MIT), credited in `NOTICE`.
- **Sync is reported steps.** Commit-and-sync runs commit, pull and push as separate steps. A failed or conflicted pull stops the push. A conflict or a detached HEAD stops the run. Nothing is force-pushed. There is no reset sync method and no automatic choice of ours or theirs. Pull merges or rebases onto the upstream with autostash. Squashing before push happens only when the upstream is an ancestor and no other ref lies in the range.
- **A serial queue.** Operations run one at a time and duplicate requests coalesce. Vault events caused by git itself are ignored.
- **Conflicts are the user's.** The sync page shows a conflict banner with continue and abort. In the editor, conflict blocks get buttons to keep the upper side, the lower side or both. Marking a file resolved warns while markers remain.
- **Automatic sync.** Intervals for commit-and-sync, pull and push, an after-last-edit mode and pull on start are settings of the vault. Three consecutive failures that need attention pause automatic sync until a manual run succeeds. The clock and the pause flag are per device and per repository, kept in `<git dir>/nand-sync.json`, so they are never committed or synced.

## Consequences

Git sync adds a dependency on a user-installed git and on how the user set up credentials. It never silently resolves a conflict and never rewrites remote history. A vault that is a Git repository commits `.nand/` content too, so the remote's access scope matters.

## Evidence

[Module](../../../../src/modules/sync/module.ts), [flow](../../../../src/modules/sync/core/flow.ts), [repository operations](../../../../src/modules/sync/core/repo.ts), [git runner](../../../../src/modules/sync/platform/desktop/git-runner.ts), [service](../../../../src/modules/sync/services/sync-service.ts). The sync suites in `src/modules/sync/` and `test/sync/git-flow.test.ts` run real git against a bare remote and two clones (first publish, merge and rebase, conflicts with abort and continue, rename, binary files, a missing remote, rejected push, `index.lock`, squash rules, CJK and wildcard paths, 1,001 files with a 20 MB attachment). The probe covers set-up, publish, a real conflict, abort and turning the module off in Obsidian. Authentication against real hosting is not verified ([validation](../context/validation.md)).
