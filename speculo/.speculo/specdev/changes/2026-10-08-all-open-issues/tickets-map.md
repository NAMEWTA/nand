---
schema_version: 1
artifact: "goal-tickets-map"
change: "2026-10-08-all-open-issues"
implementation_map: "<Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/implementation-map.md</Path>"
implementation_plan: "<Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/implementation-plan.md</Path>"
---

# Goal 总控入口

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查与修复见 [review-report.md](review-report.md) 和 [review-progress.json](review-progress.json)。已逐项审查61票／180条AC；原规划文本、阶段 Gate 与历史授权说明保留为历史记录。用户当前已授权自主代码修复，未要求提交、推送、发版或关闭 issue；不以规划阶段“0/61／只规划”描述当前工作区，也不把真实账号或未跑平台 Gate 视为通过。
<!-- ACTUAL-CODE-REVIEW:END -->

只解析到上述Implementation Map/Plan，不复制成员、依赖、owner或状态。先运行 <Path>{roots.workflows}/specdev/common/tools/ticket-control.mjs</Path> --map 本文件 --repo 项目根的只读检查；后续P run/resume再核真实授权。本轮只计划。

规划总览：<Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/open-issues-plan-2026-10-08.md</Path>。需要查看领域分组、完整交付与BUG账本时读取。
