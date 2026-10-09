# Speculo 能力目录

生成的只读发现视图。仅定位相关入口；不自动读取所有入口、激活状态机或授权动作。

roots 来自 [workspace.json](workspace.json)。Workflow 激活合同由各 INDEX 声明；Person 不要求不存在的 README。

## Commands
- [archive-and-consolidate](../commands/archive-and-consolidate.md) — Archive or consolidate a user-selected completed change and its knowledge under the owning workflow contract.
- [docs-sync](../commands/docs-sync.md) — Audit, update or explicitly commit documentation for a confirmed reproducible Git range.
- [git-history-squash](../commands/git-history-squash.md) — Plan and execute a confirmed first-parent Git history squash with recoverable refs and exact remote leases.
- [git-repository-audit](../commands/git-repository-audit.md) — Produce a read-only reproducible audit for explicitly selected local Git repositories.
- [handoff](../commands/handoff.md) — Persist a compact handoff when the user asks another agent or session to continue the current work.
- [retro](../commands/retro.md) — Analyze confirmed Speculo usage friction and propose or create GitHub issues through the T-triage remote operation protocol.
- [status](../commands/status.md) — Summarize installed workflows, active changes, anomalies, and next routes without activating a workflow.

## Skills
- [archive-and-consolidate](../skills/archive-and-consolidate/SKILL.md) — Archive and consolidate completed workflow changes and knowledge; use only for an explicitly selected archive/consolidation or cleanup review.
- [docs-sync](../skills/docs-sync/SKILL.md) — Audit and update project documentation and AGENTS/CLAUDE handbooks for a confirmed Git range; use only for documentation synchronization.
- [engineering-standards-builder](../skills/engineering-standards-builder/SKILL.md) — Generate or refresh project-specific engineering skills after the user explicitly invokes the builder.
- [git-history-squash](../skills/git-history-squash/SKILL.md) — Plan and execute a confirmed first-parent Git history squash with recoverable refs and exact remote leases; never auto-trigger.
- [optimize-codex-config](../skills/optimize-codex-config/SKILL.md) — Audit config.toml/auth.json and diagnose Codex 413 or related failures; modify configuration only after explicit confirmation.
- [retrospective](../skills/retrospective/SKILL.md) — Analyze a development session or Speculo usage feedback when asked for a retrospective; return evidence, root causes, and improvement proposals to the caller, without executing fixes or remote operations.
- [source-code-zip](../skills/source-code-zip/SKILL.md) — Create a requested source ZIP using the bundled Node script and its ignore rules; do not install dependencies.
- [upstream-fork-sync](../skills/upstream-fork-sync/SKILL.md) — Assess a requested fork/upstream checkpoint and produce reproducible diff, conflict, and customization-risk evidence.
- [writing-for-agents](../skills/writing-for-agents/SKILL.md) — Review or author agent instructions, Skills, AGENTS, commands and workflow contracts when explicitly requested.

## Workflows
- [specdev](../workflows/specdev/INDEX.md) — 以本地工件为开发权威，覆盖来源分诊、诊断、设计、逻辑/UI 原型、规格、Ticket、编排、实现、审查、复盘、GitHub/PR/包发布交付与知识归档。
