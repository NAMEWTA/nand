---
schema_version: 1
artifact: "goal-tickets-map"
change: "2026-10-08-all-open-issues"
implementation_map: "<Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/implementation-map.md</Path>"
implementation_plan: "<Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/implementation-plan.md</Path>"
---

# Goal 总控入口

只解析到上述Implementation Map/Plan，不复制成员、依赖、owner或状态。先运行 <Path>{roots.workflows}/specdev/common/tools/ticket-control.mjs</Path> --map 本文件 --repo 项目根的只读检查；后续P run/resume再核真实授权。本轮只计划。

规划总览：<Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/open-issues-plan-2026-10-08.md</Path>。需要查看领域分组、完整交付与BUG账本时读取。
