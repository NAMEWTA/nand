---
schema_version: 2
artifact: "triage"
change: "2026-10-08-workbench-regressions"
mode: "intake"
disposition: "ready-for-agent"
verification: "passed"
remote_actions: []
source: "<Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/source.md</Path>"
classification: "mixed"
risk: "medium"
route: "specdev/grill-with-docs"
ready_for_implementation: false
external_action: "pending-close"
publish_action: "not-requested"
publish: null
updated_at: "2026-10-09T04:27:47.546747+00:00"
---

# Triage: 工作台导航、常规设置与图标语言回归

## 当前判定

修复medium覆盖层吞rail点击、模块图标位置错误和实时切换语言后的原生下拉裁切。

shell scrim inset0覆盖rail；home模块图标CSS仅命中原生设置祖先；bindLocalizedOptions只改选项DOM未刷新原生测量。根因来自源码与issue宿主观察，待本票定向重现。

核验通过仅表示完整摄入和当前源码证据足以规划；并非已复现全部宿主问题、完成实现或通过验收。BUG全部保留修复票，旧事实已过时的部分明确核销，不重复建设。

## 来源和分配

| Issue | 不可变快照 | 分类/归属 |
|---|---|---|
| #138 | <Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/source.md</Path> | 工作台导航、常规设置与图标语言回归 |
| #139 | <Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/sources/SRC-139.md</Path> | 工作台导航、常规设置与图标语言回归 |
| #140 | <Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/sources/SRC-140.md</Path> | 工作台导航、常规设置与图标语言回归 |

## 未知项

代码、引用与平台验证事实由本次静态研究和后续执行验收负责；本轮用户已选择仅规划和current串行。G真实产品选择见 <Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/design-tree.json</Path>。未测宿主/账号不得冒充已验证。

## 路由

按用户显式串联：G → S → T-tickets → P(plan)。代码事实和参考对照见 <Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/reference-analysis.md</Path>，产品合同由Spec拥有。

## 外部动作

每个来源保持open，external_action=pending-close。授权远程写入：无。没有改标签、指派GitHub账号、评论或关闭Issue；分类分配是本地领域与执行owner。只有该issue全部AC有真实证据才进入reconcile；各源分别核销，主源字段不替代其它源关闭账本。publish未请求。
