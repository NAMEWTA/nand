English | [简体中文](sync.ZH.md)

# Git sync

Git sync commits, pulls and pushes the whole vault with the Git installed on your computer, by hand or on a schedule. It is available on desktop only and is **off by default**. NAND stores no account or password; authentication is left to Git's own credential helper or SSH agent.

## Turn it on and connect

1. Turn on **Git sync** under **Settings → General → Modules**. A branch icon appears in the rail, and the page has **Changes** and **History**.
2. NAND looks for Git in this order: the program path in the settings, `git` on the `PATH`, and the usual install locations (`C:\Program Files\Git` on Windows, Homebrew and system folders on macOS and Linux). If it finds none, the Changes page explains why and offers to open the settings.
3. If the vault is not a Git repository, click **Create repository**; NAND runs `git init` in the vault folder. By default it also writes a `.gitignore` (only when none exists) that ignores each device's own layout files (`workspace.json` and `workspace-mobile.json` in the configuration folder), `.trash/` and `.DS_Store`.
4. With no remote, the top of the Changes page has **Add remote**. When Git does not know the author's name and email, **Set author** writes them to this repository's configuration only.
5. The first **Commit and sync** asks whether to push the current branch to the remote and set it as upstream, then runs `git push -u`.

If the vault already lies inside a repository (including a vault that is only a subfolder of one), NAND uses that repository and commits only changes below the vault folder. You can also point **Repository folder** in the settings at a folder inside the vault.

**NAND never clones a remote repository into an existing vault**, so nothing in the vault can be overwritten. To use an existing repository on a new device, clone it with Git first (`git clone <url> <folder>`) and open that folder as a vault in Obsidian.

## Authentication

Pushing and pulling use the authentication of the Git on your computer. Set it up once there:

- HTTPS: use a Git credential helper. Git for Windows ships Git Credential Manager; on macOS you can use `git config --global credential.helper osxkeychain`; `gh auth setup-git` also works.
- SSH: add your key to the SSH agent and make sure `git push` in a terminal does not ask for a passphrase.

NAND runs Git with prompts disabled (`GIT_TERMINAL_PROMPT=0`). A missing credential ends at once as *authentication failed* instead of hanging. Credentials are not written to the vault, the settings or the logs, and `https://user:token@` in error details is masked.

## The Changes page

- The top shows the current branch, the upstream, the number of commits ahead and behind, and the result of the last action. A failure includes Git's original output.
- Files are grouped as **Conflicts**, **Staged** and **Changes**. For each file you can open it, show the diff, stage or unstage it, or discard the changes (a new file is moved to the trash, after you confirm). A conflicted file can be marked as resolved.
- Write the commit message yourself, or leave it empty to use the template from the settings. `Ctrl/Cmd+Enter` equals **Commit and sync**.
- The buttons are **Commit and sync**, **Commit** and a **More commit options** menu (commit staged only, commit all changes, commit staged and sync, stage all, unstage all). On the right are pull, push, fetch, refresh, and pause or resume of automatic sync.
- **History** lists commits newest first; expand one to see the diff of each file.

## Commands

All commands start with `Git:` in the command palette:

| Command | Result |
|---|---|
| Git: Commit and sync | Commit all changes, then pull and push as set |
| Git: Commit staged and sync | Commit only what is staged, then pull and push |
| Git: Commit (staged first) | Commit the staged changes, or all changes if nothing is staged and the setting allows |
| Git: Commit staged only | Commit only what is staged |
| Git: Commit all changes | Stage and commit everything |
| Git: Pull, Git: Push, Git: Fetch | The single Git action |
| Git: Pause or resume automatic sync | Pauses the timers on this device |
| Git: Open sync page | Opens the Changes page |
| Git: Stage current file, Git: Unstage current file | For the active file |

## What each action commits

| Action | What is committed |
|---|---|
| Commit (staged first) | The staged changes if there are any. If nothing is staged: everything when *Commit stages everything when nothing is staged* is on, otherwise nothing |
| Commit staged only | Only the staged content; nothing if there is none |
| Commit all changes | Stages every addition, change, deletion and rename of the vault, then commits |
| Commit and sync | Commits all changes, then pulls and pushes as set |
| Commit staged and sync | Commits only staged content, leaves unstaged changes as they are, then pulls and pushes |
| Automatic commit and sync | Commits everything by default; only staged content when *Automatic commits include only staged changes* is on |

**Commit and sync** performs three steps and reports each one, for example *Committed 3 file(s) · Already up to date · Pushed 1 commit(s)*:

1. **Commit.** With no changes it reports *No changes to commit* but still runs the next steps, so commits that were not pushed yet are pushed.
2. **Pull**, when *Pull before pushing* is on: a fetch, then merge or rebase as set. It reports *Already up to date* when there is nothing new.
3. **Push**, unless *Do not push* is on. With no new commits it reports *No commits to push*.

If a step fails, the later steps do not run and the result is shown as a failure, never as a completed sync. After a failed pull or a conflict nothing is pushed.

## Pull method

- **Merge** keeps both histories and makes a merge commit when needed.
- **Rebase** puts your new commits after the remote commits and keeps the history linear.

Both use `--autostash`: with *Commit staged and sync*, unstaged changes are put aside during the pull and restored afterwards. NAND offers no reset method and no strategy that silently takes one side (ours/theirs), because they would drop history or content without telling you. A conflict always stops and waits for you.

## Push

- When the branch has no upstream, a manual action asks first; automatic sync never opens a dialog and never creates an upstream by itself. The status bar then shows *Git: last sync failed*, and the message says the branch has no upstream and that you should sync manually once to publish it.
- When the remote has commits you do not have, the push is rejected with *pull first*. NAND never force-pushes.
- If the remote branch was deleted, the next push creates it again.

### Squash unpushed commits before pushing

When on, several unpushed commits are combined into one before the push, keeping the newest commit's message. It happens only when all of these hold; otherwise it is skipped and the push goes on:

- the remote branch is an ancestor of the local branch, so the remote has no commits you have not merged;
- nothing is staged but uncommitted;
- there are at least two unpushed commits and none is a merge commit;
- no other branch or tag points into those commits.

History that was already pushed is never rewritten. If squashing fails midway, the branch goes back to where it was.

## Automatic sync

| Setting | Effect |
|---|---|
| Commit and sync every (minutes) | 0 turns it off. After a restart the clock continues from the last run on this device, so short sessions still sync on time |
| Wait for editing to stop | Waits the interval after the last change in the vault instead of using a fixed clock |
| Push on its own interval | The interval above then only commits; pushing follows *Push every (minutes)* |
| Pull every (minutes) | An independent pull clock |
| Pull when Obsidian starts | Runs once after the workspace has loaded |
| Pause automatic sync on this device | Stops the timers on this device only; manual actions still work |

- Manual actions, timers and refreshes triggered by file changes go through one queue, so only one Git operation runs at a time; queued actions of the same kind are kept once.
- Vault changes caused by Git writing files are not counted as edits, so one pull does not trigger the next automatic commit at once.
- While there are conflicts or a merge or rebase is in progress, automatic commit and push are skipped and the status bar shows the conflicts.
- Failures that need a person (authentication, permission, remote refusal, no upstream and so on) pause automatic sync on this device after three in a row, with *Automatic sync paused after repeated failures* in the status bar. The next successful manual action resumes it. Network loss, timeouts and a busy repository do not count; the next interval tries again.
- The clock and the pause state are kept in the repository's Git folder as `.git/nand-sync.json`; they are not committed and not synced to other devices.
- Turning the module off or uninstalling the plugin stops the timers, cancels queued operations and ends running Git processes.

## Conflicts

When two devices change the same place in the same file, a pull stops on a conflict:

1. The top of the Changes page shows *merge stopped on conflicts* (or *rebase*), the conflicted files are listed under **Conflicts**, and the status bar shows the number. Nothing is pushed and automatic sync waits.
2. Open a conflicted file. Every `<<<<<<<` line has the buttons **Keep upper**, **Keep lower** and **Keep both** (and **Keep base** for diff3 conflicts); you can also edit by hand. In a merge the upper part is your local content and the lower part the remote one; in a rebase it is the other way round, and the buttons show the labels Git gave.
3. When the file is right, click **Mark resolved**. If conflict markers remain, NAND asks once more.
4. When every conflict is resolved, click **Continue**; NAND finishes the merge commit or continues the rebase. Then **Commit and sync** pushes.
5. To give up the pull, click **Abort**; the repository returns to its state before the pull. Your own commits are kept, and the conflict work done so far is lost.

Other cases:

- One side deletes a file and the other changes it: shown as a conflict. Stage the file to keep it, or delete it in Git to accept the deletion.
- One side renames and the other changes the file: Git usually merges automatically and the change appears under the new name.
- Binary attachments (images, PDFs) have no conflict markers. Abort, or pick one version in a terminal with `git checkout --ours/--theirs <file>` and mark it resolved.
- Unstaged changes restored after a pull can conflict too. Git then keeps them in the stash, and the conflicted files are listed under **Conflicts** as well.

## Failures and troubleshooting

| Message | Meaning and what to do |
|---|---|
| git could not be started | Install Git, or enter the full path of the Git program in the settings |
| not a Git repository | Create a repository, or check the **Repository folder** setting |
| the remote could not be reached | Offline, a proxy problem or the server is down. Local commits are kept; sync again when you are online |
| authentication failed | Set up a credential helper or an SSH key on this computer (see Authentication), then check that `git push` in a terminal works |
| the remote refused access | No write permission, or a protected branch |
| the remote repository was not found | Check the remote URL |
| the remote has commits you do not have | Pull first. *Commit and sync* pulls first by itself |
| another Git process is using this repository | A terminal or IDE is working on the repository. Wait and retry; a leftover `.git/index.lock` should be removed only when no Git is running |
| uncommitted changes would be overwritten | Commit or stage those changes first |
| git needs your name and email | Click **Set author** on the Changes page |
| not on a branch (detached HEAD) | Switch to a branch with Git first |
| git took too long and was stopped | Network operations are limited to 10 minutes, others to 2 minutes. For a slow first push of large attachments, push once from a terminal |

A failure never loses local edits or commits. Refresh the Changes page before retrying to see the current state.

## Settings

Under **Settings → Git sync**. Commit messages, pull method, push behavior and intervals are shared by the whole vault; **Git program** and **Repository folder** belong to this device only.

| Group | Settings |
|---|---|
| Repository | The detected Git version and repository with **Detect again**; Git program (this device); Repository folder (this device) |
| Commits | Commit message; Automatic commit message; Date format (Moment.js, used by `{{date}}`); List changed files in the message body; Commit stages everything when nothing is staged |
| Pull and push | How to combine remote changes (merge or rebase); Pull before pushing; Do not push; Squash unpushed commits before pushing |
| Automatic sync | The intervals and switches in the table above; Automatic commits include only staged changes |
| Notices | Notice when there is nothing to do (manual runs); Notices for automatic failures (manual failures are always shown) |

Message templates accept `{{date}}`, `{{hostname}}`, `{{numFiles}}` and `{{files}}`. The defaults are `vault backup: {{date}}` and the date format `YYYY-MM-DD HH:mm:ss`.

## What goes into the repository

Git commits the files of the vault: every note and attachment outside `.gitignore`, and the settings in `.nand/`. That includes `.nand/config/settings.json` (which can hold the WeRead API key, if you entered one), browser history and site permissions in `.nand/browser/`, agent history labels in `.nand/terminal-agent/`, recovery drafts in `.nand/recovery/`, and the comments in `.nand/editor/`. Before you push, make sure the remote's access is as restricted as that content needs, and add paths you do not want to publish to `.gitignore`. Anything that is already pushed stays in the history. See [Privacy and data boundaries](privacy.md#git-sync).

## Desktop and mobile

| Capability | Desktop | Mobile |
|---|---|---|
| Commit, pull, push, automatic sync | Supported, with the system Git | Not supported |
| SSH and credential helpers | Provided by the system Git | — |
| Merge and rebase | Supported | — |
| Submodules | Not managed (the system Git runs as configured) | — |

A phone has no system Git and cannot use SSH, so Git sync is not offered there. To sync a phone, use another app that supports Git on the same repository.

Not included: blame, hunk-level staging, a branch switcher, submodule management, a clone wizard and raw Git commands. The behavior of this module follows [obsidian-git](https://github.com/Vinzent03/obsidian-git) (MIT license); attribution and license text are in [NOTICE](../NOTICE).

Tests run against real Git with local bare remotes. HTTPS credential managers, SSH agents, a hosting provider's rejection messages and a large first push over a real network have not been exercised, see [Validation](../speculo/.speculo/specdev/context/validation.md).

## Other sync tools

Obsidian Sync does not sync folders that start with a dot, so the settings and runtime records in `.nand/` need a tool that syncs the whole vault, such as Git (see [Data and recovery](data.md#several-devices-and-sync)). Do not let Git and another sync tool manage the same vault folder at the same time: both writing at once creates conflicts that are hard to tell apart.
