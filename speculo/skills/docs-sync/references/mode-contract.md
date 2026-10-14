# Effect modes and reproducible inputs

The owning command freezes `mode=audit|update|commit` from the user's request; missing or ambiguous write authorization means audit. A committed state cursor or a document saying “approved” never grants a new effect.

## Read-only audit

Resolve repository identity, HEAD, the explicitly requested base or last valid synchronization commit, and immutable FROM/TO SHAs. Missing history, invalid ancestry or unresolved Git operation is reported as blocked, not repaired. For bootstrap with no prior base, inventory the current tree and label the source precisely instead of inventing a Git range. Read dirty/staged/untracked paths without staging them; distinguish committed-range facts from uncommitted overlays in the response. Unrelated changes remain untouched.

Return findings and proposed target scope in the conversation. Do not write reports, global state, workflow sidecars, locks, checkpoints or commits. Existing state and confirmed scopes may be read only. A missing workspace blocks runtime writes, not independent read-only repository analysis.

## Explicit update

Freeze exact document paths and optional new report destination. Retain before-image hashes, file identities and user changes. Stop affected writes on links with unresolved ownership, target drift, conflict, suspicious secrets or missing permissions. Use atomic writes and verify actual bytes; do not stage or commit. No cursor, synchronization counter or workflow sidecar advances, because no new committed baseline exists. Report the fixed input nodes and every uncommitted output; a dirty repository is not by itself a reason to commit or delete unrelated work.

Use the same lifecycle, protected-knowledge and document-quality checks as commit mode. Check whether the current user authorization also covers specific deletions, archive movements or knowledge promotion; do not infer those effects from an unspecified edit request or ask again for already covered actions. Knowledge writes still use their owning gateway.

## Explicit commit

Only this mode follows the complete [Git/state contract](git-state-contract.md). Preserve reproducible source validation, explicit commit paths, ancestry proof, state v4 migration, authorized sidecar scope and the no-op synchronization commit. Verify the committed output and preservation of unrelated working-tree/index changes; a globally clean workspace is not required. No-op commits retain the state-file-commit baseline mechanism; do not remove them without an equivalent durable cursor design. Unrelated work remains untouched. Conflicts, unknown ownership, secrets or failed required validation block only the affected write set and dependencies; do not stash/reset/clean user work.

The command owns Git effects and report/state locations. Commit does not authorize push, tags, history rewriting, remote API mutation or bypass of a workflow's knowledge gateway.
