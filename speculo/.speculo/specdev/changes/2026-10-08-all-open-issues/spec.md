---
schema_version: 3
artifact: "spec"
change: "2026-10-08-all-open-issues"
status: "ready"
ready_for_tickets: false
sources: ["<Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-archives-completion/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/spec.md</Path>"]
---

# 父 change 协调入口

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查与修复见 [review-report.md](review-report.md) 和 [review-progress.json](review-progress.json)。已逐项审查61票／180条AC；原规划文本、阶段 Gate 与历史授权说明保留为历史记录。用户当前已授权自主代码修复，未要求提交、推送、发版或关闭 issue；不以规划阶段“0/61／只规划”描述当前工作区，也不把真实账号或未跑平台 Gate 视为通过。
<!-- ACTUAL-CODE-REVIEW:END -->

父change由P组合已Ready子合同，产品规格由八个子Spec拥有。本文件仅为当前项目文档inventory提供活动change入口，ready_for_tickets=false表示该已完成的协调入口不生成本地产品Ticket；不增加第九套AC或本地Ticket。权威总体计划见 <Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/implementation-plan.md</Path>，合同组合见 <Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/implementation-map.md</Path>。
