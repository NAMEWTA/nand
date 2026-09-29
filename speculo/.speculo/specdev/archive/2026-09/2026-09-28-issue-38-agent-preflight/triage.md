---
schema_version: 1
artifact: triage
change: 2026-09-28-issue-38-agent-preflight
mode: reconcile
source: <Path>{roots.state}/specdev/changes/2026-09-28-issue-38-agent-preflight/source.md</Path>
classification: bug
risk: medium
route: specdev/diagnose-bugs
ready_for_implementation: false
external_action: closed
publish_action: not-requested
publish: null
updated_at: 2026-09-29T01:25:58.184893+00:00
---

# Triage: #38 agent-preflight

## 当前判定

- 影响：以冻结 Source 的最新复测说明为症状范围；旧标题不等同于当前缺陷。
- 紧急度：normal；功能缺陷优先于纯文案/布局。
- 事实：远程仍 open；本地基线 `09aade655241fff439d3147a55ec1448a4f93eea`，初始工作区 clean；报告主要测试节点为 `0dc97e9`，之后已发生 Preact/分层迁移，须重新复现。
- 风险：诊断使用合成数据和可撤销夹具；不改用户库、生产代码、永久 ADR/context。涉及数据的后续票保留既有文件/运行/会话。
- 历史相似项：<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/agent-upgrade-2026-09-27.md</Path> 记录了旧修复；用户此次明确要求当前所有 open issue 的重新核查，因此继续，不能将旧“已修复”当成当前验收。

## 未知项

- 可发现事实：精确残留症状能否在当前源码/当前发布资产中复现；逐项判定见 diagnosis。
- 需要用户决定：本轮不扩展产品范围；未来 Goal 工作区选择已询问，未回答则待定，不挡只读诊断。
- 低影响实现细节：沿用现有组件、翻译入口和测试框架。

## 路由

下一 Work：<Path>{roots.workflows}/specdev/D-diagnose-bugs/D-diagnose-bugs.md</Path>。先运行真实行为红灯；无红灯的子症状只保留核查结论，不推断根因或编造 Ready 修复。

## 外部动作

目标：https://github.com/NAMEWTA/nand/issues/38；关闭能力 supported；external_action closed。2026-09-29T01:25:58Z 重读远程状态为 closed，评论含 specdev:2026-09-28-issue-38-agent-preflight:completion。publish_action 仍为 not-requested。

## 发布投影

publish_action not-requested；无票级远程发布请求；origin intake。
