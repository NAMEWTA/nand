English | [简体中文](tracking.ZH.md)

# Change tracking

SpecDev tracks development with local Markdown and JSON artifacts only. A remote issue, URL or other source is first frozen by triage as `changes/<change>/source.md`. Remote state, labels, assignees and dependencies never replace the local change, ticket, map, goal plan or evidence.

- The change root is `speculo/.speculo/specdev/changes/`. A change lives in `changes/<YYYY-MM-DD>-<kebab-topic>/`.
- A change is one goal that can be explained, implemented, verified and archived on its own.
- `status.json` is the global index of active changes. `changes/<change>/.status.json` is the lifecycle of one change. The index lists exactly the directories under `changes/`.
- A ticket file is the authority for its state. `tickets-map.md` is a synchronized projection of the ticket files. Entry state, ticket state and map state are updated in the same operation.
- A change is complete when every required ticket is `done` or has an approved `cancelled`, the evidence is complete, no deviation is unapproved and the change-level verification passes.
- Conclusions of a finished change move into the ADRs, the context documents and the user guides. `archive/<YYYY-MM>/<change>/` is read-only once written; later corrections are new changes.
- A closable remote source is reconciled by triage after the local work is done. Publishing a ticket to a remote tracker is recorded in `changes/<change>/publish.md`. Unfiled notes are recorded in `capture.md` and do not create a change. The remote issue is never the development authority.
- A delivery states the source baseline, the files covered, the checks that ran and the items not verified. An unverified item is not turned into a passed one by editing a record.
