# NAND/AI Workspace/task/任务.md

---
nand-type: browser-task
nand-id: task
nand-workspace:
  id: task
  title: Compare sources
  pinned: false
  createdAt: 1
  updatedAt: 1
  targets:
    - id: target
      provider: deepseek
      profileId: default
      accountLabel: Personal
      page:
        pageId: page
        profileId: default
        generation: generation
      status: ready
  selectedTargetIds:
    - target
  visibleTargetIds: []
---

<!-- nand:draft -->
Question
<!-- /nand:draft -->

# NAND/AI Workspace/task/轮次/turn.md

---
nand-type: browser-turn
nand-id: turn
nand-workspace:
  id: turn
  taskId: task
  sequence: 1
  templates: []
  targets:
    - id: target
      provider: deepseek
      profileId: default
      accountLabel: Personal
      page:
        pageId: page
        profileId: default
        generation: generation
      status: ready
  createdAt: 2
---

<!-- nand:question -->
Question
<!-- /nand:question -->

<!-- nand:prompt -->
Full frozen prompt
<!-- /nand:prompt -->

# NAND/AI Workspace/task/回答/exchange.md

---
nand-type: browser-exchange
nand-id: exchange
nand-workspace:
  id: exchange
  turnId: turn
  targetId: target
  submitState: submitted
  acquisitionState: incomplete
  saveState: saved
  currentCaptureId: capture-two
  captures:
    - id: capture-one
      exchangeId: exchange
      revision: 1
      source: provider-api
      adapterVersion: fixture-v1
      conversationId: conversation
      messageId: answer
      parentId: question
      branchId: branch
      complete: true
      reasons: []
      terminalEvidence:
        - finished
      capturedAt: 3
    - id: capture-two
      exchangeId: exchange
      revision: 2
      source: provider-api
      adapterVersion: fixture-v1
      conversationId: conversation
      messageId: answer
      parentId: question
      branchId: branch
      complete: false
      reasons:
        - missing-terminal
      terminalEvidence: []
      capturedAt: 4
---

<!-- nand:answer-a -->
# Heading

| A | B |
| --- | --- |
| 1 | 2 |

```ts
const a = 1;
```

$x^2$
<!-- /nand:answer-a -->

<!-- nand:answer -->
Partial update
<!-- /nand:answer -->
