---
schema_version: 2
artifact: "triage"
change: "2026-10-08-private-storage-permissions"
mode: "intake"
disposition: "ready-for-agent"
verification: "passed"
remote_actions: []
source: "<Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/source.md</Path>"
classification: "mixed"
risk: "high"
route: "specdev/grill-with-docs"
ready_for_implementation: false
external_action: "pending-close"
publish_action: "not-requested"
publish: null
updated_at: "2026-10-09T04:27:47.546747+00:00"
---

# Triage: NAND 私有目录和文件的最小POSIX权限

## 当前判定

收紧桌面POSIX .nand配置/运行数据的目录与文件权限，兼容旧库、克隆库与原有读写。

JsonStore/DurableState/adapter写入按umask，native SQLite同样会创建文件；浏览器用户数据目录已显式0700/0600，库内目前不一致。

核验通过仅表示完整摄入和当前源码证据足以规划；并非已复现全部宿主问题、完成实现或通过验收。BUG全部保留修复票，旧事实已过时的部分明确核销，不重复建设。

## 来源和分配

| Issue | 不可变快照 | 分类/归属 |
|---|---|---|
| #144 | <Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/source.md</Path> | NAND 私有目录和文件的最小POSIX权限 |

## 未知项

代码、引用与平台验证事实由本次静态研究和后续执行验收负责；本轮用户已选择仅规划和current串行。G真实产品选择见 <Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/design-tree.json</Path>。未测宿主/账号不得冒充已验证。

## 路由

按用户显式串联：G → S → T-tickets → P(plan)。代码事实和参考对照见 <Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/reference-analysis.md</Path>，产品合同由Spec拥有。

## 外部动作

每个来源保持open，external_action=pending-close。授权远程写入：无。没有改标签、指派GitHub账号、评论或关闭Issue；分类分配是本地领域与执行owner。只有该issue全部AC有真实证据才进入reconcile；各源分别核销，主源字段不替代其它源关闭账本。publish未请求。
