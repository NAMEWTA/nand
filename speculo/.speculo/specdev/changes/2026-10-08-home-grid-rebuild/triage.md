---
schema_version: 2
artifact: "triage"
change: "2026-10-08-home-grid-rebuild"
mode: "intake"
disposition: "ready-for-agent"
verification: "passed"
remote_actions: []
source: "<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/source.md</Path>"
classification: "mixed"
risk: "high"
route: "specdev/grill-with-docs"
ready_for_implementation: false
external_action: "pending-close"
publish_action: "not-requested"
publish: null
updated_at: "2026-10-09T04:27:47.546747+00:00"
---

# Triage: 首页看板自由网格、组件贡献与智能体技能派发

## 当前判定

先独立修复 #141 的窄桌面快捷创建栏异常高度和横幅遮挡；随后完整落实 #137：固定参考 apex-dashboard 3.7.5 源码，形成按看板布局/成员、沉浸式统一网格、内外部小组件贡献、NAND 终端技能派发、工作流分区以及全部八项附加体验。遵守现有模块边界、懒加载、全局主题、Markdown 保真、i18n 与许可；RSS 产品由新闻 change 实现。本次交付是成熟规格、18 张票与串行计划，不执行实现或发布。

当前研究基线为 NAND 1b9121382363cc50254fbc973c24742b7742edc7。#137 的 21f852b 路径/类型描述部分过时：DashboardLayoutMode/layoutMode 已删除，shell/board-settings.ts 仅覆盖 dashboardFile；真正布局入口是 home/ui/renderer/render-sidebar-widgets.ts 的 isStackedLayout()，非手机恒为 stacked。DashboardData 尚无 layout/immersive/members，parser 已具备 document.source/baseline 与 preserveDashboardDocument 原文保真。内置 widgets 仍硬编码，BoardOperations.reorder 已有但面板未暴露。AgentSessionsPort 仅 list/attachMaterial，既有 interactive 会话只粘贴；自动化 runtime 的 reuse 会回车，不可直接用于新快捷按钮的既有会话路径。AUTOMATIONS.runAction 只接已存 id，尚无动态 prompt 调用/派发回执 API。icons 无 api.ts，但内部用 Obsidian getIconIds 和 lazy keywords。当前全局主题 ADR 是 0006，非 issue 旧编号 0020。#141 的 ≤640 媒体查询空档仍存在；本轮只有静态根因核查，未声称真实 Obsidian 已复现或修复。

核验通过仅表示完整摄入和当前源码证据足以规划；并非已复现全部宿主问题、完成实现或通过验收。BUG全部保留修复票，旧事实已过时的部分明确核销，不重复建设。

## 来源和分配

| Issue | 不可变快照 | 分类/归属 |
|---|---|---|
| #137 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/source.md</Path> | 首页看板自由网格、组件贡献与智能体技能派发 |
| #141 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/sources/SRC-141.md</Path> | 首页看板自由网格、组件贡献与智能体技能派发 |

## 未知项

代码、引用与平台验证事实由本次静态研究和后续执行验收负责；本轮用户已选择仅规划和current串行。G真实产品选择见 <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/design-tree.json</Path>。未测宿主/账号不得冒充已验证。

## 路由

按用户显式串联：G → S → T-tickets → P(plan)。代码事实和参考对照见 <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/reference-analysis.md</Path>，产品合同由Spec拥有。

## 外部动作

每个来源保持open，external_action=pending-close。授权远程写入：无。没有改标签、指派GitHub账号、评论或关闭Issue；分类分配是本地领域与执行owner。只有该issue全部AC有真实证据才进入reconcile；各源分别核销，主源字段不替代其它源关闭账本。publish未请求。
