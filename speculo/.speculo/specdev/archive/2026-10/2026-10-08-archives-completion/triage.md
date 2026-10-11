---
schema_version: 2
artifact: "triage"
change: "2026-10-08-archives-completion"
mode: "reconcile"
disposition: "ready-for-agent"
verification: "passed"
remote_actions: ["https://github.com/NAMEWTA/nand/issues/124"]
source: "<Path>{roots.state}/specdev/changes/2026-10-08-archives-completion/source.md</Path>"
classification: "mixed"
risk: "medium"
route: "specdev/grill-with-docs"
ready_for_implementation: false
external_action: "closed"
publish_action: "not-requested"
publish: null
updated_at: "2026-10-11T02:30:44.702Z"
---

# Triage: 档案列表、卡片与正文检索的完整核销

## 当前判定

完成个人/企业同一数据的双布局、入口笔记全文搜索、命中解释和性能验收；现有实现优先复用。

当前 src/modules/archives 已实现列表/卡片、默认偏好、分区文本、关联名称依赖失效与摘要；#124 的旧目录和“只有字段搜索”已过时。91项定向基线测试通过，但不包含本轮新宿主/规模证据。

核验通过仅表示完整摄入和当前源码证据足以规划；并非已复现全部宿主问题、完成实现或通过验收。BUG全部保留修复票，旧事实已过时的部分明确核销，不重复建设。

## 来源和分配

| Issue | 不可变快照 | 分类/归属 |
|---|---|---|
| #124 | <Path>{roots.state}/specdev/changes/2026-10-08-archives-completion/source.md</Path> | 档案列表、卡片与正文检索的完整核销 |

## 未知项

代码、引用与平台验证事实由本次静态研究和后续执行验收负责；本轮用户已选择仅规划和current串行。G真实产品选择见 <Path>{roots.state}/specdev/changes/2026-10-08-archives-completion/design-tree.json</Path>。未测宿主/账号不得冒充已验证。

## 路由

按用户显式串联：G → S → T-tickets → P(plan)。代码事实和参考对照见 <Path>{roots.state}/specdev/changes/2026-10-08-archives-completion/reference-analysis.md</Path>，产品合同由Spec拥有。

## 外部动作

每个来源保持open，external_action=pending-close。授权远程写入：无。没有改标签、指派GitHub账号、评论或关闭Issue；分类分配是本地领域与执行owner。只有该issue全部AC有真实证据才进入reconcile；各源分别核销，主源字段不替代其它源关闭账本。publish未请求。

## 2026-10-11 完成核对

用户要求修复 CI，并接受本轮 Windows 验收范围；[最终验收](evidence/completion.md)。来源及关联缺陷 [#124](https://github.com/NAMEWTA/nand/issues/124) 已回读为 CLOSED。已关闭的 issue 不重复评论；本次关闭的评论含唯一 marker、提交和 CI 证据。原账号/其他平台未验证事实保留。发布 #148 保持 OPEN，不作为这些源码 change 的关闭阻塞。
