# Archive Plan

> 生成时间：2026-09-27 13:40 UTC
> Workflow：specdev
> 模式：archive-batch
> 知识策略：generic
> 执行：用户于 2026-09-27 明确指示把下列四份 change 视为完成、调整状态并归档。移动前已跑 `--stage complete`。

## 预检摘要

| 检查项 | 状态 |
|--------|------|
| changes_root 可访问 | pass |
| archive_root 可访问 | pass |
| status.json 可解析 | pass |
| 候选 change 数量 | 4 |
| 预检通过数 | 4 |
| 预检阻塞数 | 0 |

完成门原本不通过：四份都是 `active`，票是 `ready`，父计划未执行。按用户指示先改状态，再归档。票记为 `cancelled` 而不是 `done`，因为 `done` 会要求伪造 Skill 通过记录和集成 SHA。没有重跑产品验收。

## 逐项归档计划

| # | Change | 源路径 | 目标路径 | 状态 | 备注 |
|---|--------|--------|---------|------|------|
| 1 | 2026-09-25-statusbar-hierarchy-error | changes/2026-09-25-statusbar-hierarchy-error/ | archive/2026-09/2026-09-25-statusbar-hierarchy-error/ | moved | T-01 cancelled |
| 2 | 2026-09-25-settings-narrow-column | changes/2026-09-25-settings-narrow-column/ | archive/2026-09/2026-09-25-settings-narrow-column/ | moved | T-01 cancelled |
| 3 | 2026-09-25-terminal-connection-i18n | changes/2026-09-25-terminal-connection-i18n/ | archive/2026-09/2026-09-25-terminal-connection-i18n/ | moved | T-01 cancelled |
| 4 | 2026-09-25-three-issue-plan | changes/2026-09-25-three-issue-plan/ | archive/2026-09/2026-09-25-three-issue-plan/ | moved | 父 Map/Plan completed 后随归档改为 archived |

路径前缀是 `<Path>{roots.state}/specdev/</Path>`。

## 状态变更

- 全局 `status.json` 的 `active` 现为空。
- `archived` 按原 active 顺序追加上述四个名称，没有重叠。
- 每份归档 `.status.json`：`change_status: archived`，`archived: true`，`archive_path` 指向 `archive/2026-09/{change}`，`completed_at` 为 `2026-09-27T13:40:00Z`，`current_work` 为 null。
- 三张票的 dev skill 指纹已改成当前文件摘要，用来消除移动前校验里的 digest drift。

## 知识

| 来源 | 动作 | 理由 |
|---|---|---|
| 三份 ADR | ephemeral | 正文写明没有已接受的架构决定 |
| 三份 CONTEXT | ephemeral | 只描述当时的设置和状态栏用语；后续领域已经增加，提升会过时 |
| 父计划与 LOG | ephemeral | 这次关闭是用户授权，不是新的稳定机制 |

没有写入 `adr/`、`context/` 或 `research/`。没有清理候选。

## 执行后重读

- 四个源目录已不在 `changes/`。`changes/` 只剩原有 `.gitkeep`。
- 四个目标目录都在 `archive/2026-09/`。
- 移动前 `--stage complete`：父 change 和三名成员都是 0 error、0 warning。
- 移动后默认校验：三名成员 0 error，并警告校验器仍按 changes 根解释路径。
- 移动后父 change 默认校验有 4 个 error：已归档成员不能再当作实现成员，且 completed 的 Map/Plan 要求父状态仍是 completed。这是归档终态 `archived` 与父实现校验只覆盖活动父 change 之间的冲突。文件已经按归档合同落盘，没有回滚。
- 移动后再跑 `--stage complete` 会要求 `change_status=completed`，因此失败。完成阶段校验以移动前的结果为准。
