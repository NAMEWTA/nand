---
custom: keep # author
skills:
  - id: fresh-review
    label: Review
    icon: sparkles
    agentId: codex
    skillName: review
    promptTemplate: |2
        {{path}}
      {{input}}
    inputPlaceholder: What matters?
    directSend: false
    destination:
      kind: fresh
      cwd: ""
  - id: existing-plugin
    label: 检查
    agentId: claude-code
    skillName: plugin:check
    promptTemplate: "{{paths}}"
    directSend: true
    destination:
      kind: existing
      sessionId: remembered-session
---

<!-- My notes -->
