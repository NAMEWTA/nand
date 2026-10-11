---
custom: keep # author
columns: [ { id: flow, name: Workflow, type: pipeline, pipeline: { rootFolder: Work, statusField: state, stages: [ { id: draft, value: Draft, label: Draft, width: 300 }, { id: review, value: Review, label: Review, folder: Review, width: 420 } ], excludeFolders: [ Work/Templates ], templatePaths: [ Templates/Article.md ], sortBy: due, sortDesc: false, filterFields: [ channel ], filters: { channel: local }, search: Article, skills: [ { id: column-review, label: Review column, scope: stage, stages: [ Review ], agentId: codex, skillName: review, promptTemplate: "{{stage}}\n{{paths}}", directSend: false, destination: { kind: fresh, cwd: "" } } ], archiveFolder: Archive } } ]
---
## Workflow
My workflow notes.
