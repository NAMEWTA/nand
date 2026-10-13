# Vault 数据统一归档

本 change 已完成 T-01 至 T-08，并于 2026-10-13 经用户确认归档。alpha.2 发布、正式资产验收、Issue 151/148 关闭及18份知识提升均已完成。

- 范围与验收：[规格](spec.md)、[票据与计划](tickets-map.md)。
- 实现与发行：[T-08 证据](evidence/T-08.md)、[交付核对](evidence/goal-delivery.md)。
- 知识结果：[逐项提升清单](evidence/knowledge-plan.json)。
- 归档回执：<Path>{roots.state}/commands/archive-and-consolidate/2026-10-13-specdev-2026-10-11-vault-data-unification.md</Path>。

状态 schema v6 要求 worktrees.integration.evidence 保留创建时的 changes 路径。该字段作为历史来源定位保留；对应文件现位于本归档 evidence 目录，archive_path 记录现行根目录。其他现行 Path 引用已更新。历史日志与执行回执保留当时事实，不代表仍有待办；最终结果以归档回执为准。归档完成后只读，后续纠正经新 change 处理。
