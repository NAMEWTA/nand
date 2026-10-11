---
schema_version: 2
artifact: "triage"
change: "2026-10-08-news-aihot"
mode: "reconcile"
disposition: "ready-for-agent"
verification: "passed"
remote_actions: ["https://github.com/NAMEWTA/nand/issues/136"]
source: "<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/source.md</Path>"
classification: "feature"
risk: "high"
route: "specdev/grill-with-docs"
ready_for_implementation: false
external_action: "closed"
publish_action: "not-requested"
publish: null
updated_at: "2026-10-11T02:30:44.702Z"
---

# Triage: 本地新闻工作台与 Agent 分析

## 当前判定

深读 AIHOT 固定提交后按 NAND 模块、工作台、设置、Markdown 和 Agent CLI 契约重写完整新闻能力：采集、可解释精选、事件归组、热度、日报、收藏/简报、我的视图及首页组件；保留 OPML、静态网页列表、可选双评分与七天曲线。仅做本轮完整规划；后续 current 严格串行。

NAND 当前 HEAD 1b9121382363cc50254fbc973c24742b7742edc7，无 news 模块，home 无跨模块 widget registry；#136 旧基线 21f852b 已过期。agent/api.ts 只有 AGENT_SESSIONS 与 AGENT_WORKBENCH；TerminalAutomationRuntime 已复用登录/CLI/hooks/PTY但要求 AutomationRun、答案截尾8000字符且无总运行超时。现六CLI首次prompt均经argv/flag，旧 automation-catalog.ts 与 CORE_AGENT_IDS 已删除；以 AGENT_CATALOG 为准。hook stdin >65536字符静默退出，spool >100000 bytes拒收；Pi/OpenCode未带最终答案，history/parse.ts仅元数据没有完整assistant文本。manifest/package当前0.0.1-alpha.1，不能按旧issue断言仍是1.0.0。AIHOT c547b669acc7f64720cd82024e502446ee1ef88d 已固定clone在repo外并深读算法/提示词/UI。home领域change拥有公共Agent目录/派发、automation invocation/receipt contract；本change依赖并复用，不另建同名公共目录。本change独立拥有新闻结构化后台结果runner扩展。

核验通过仅表示完整摄入和当前源码证据足以规划；并非已复现全部宿主问题、完成实现或通过验收。BUG全部保留修复票，旧事实已过时的部分明确核销，不重复建设。

## 来源和分配

| Issue | 不可变快照 | 分类/归属 |
|---|---|---|
| #136 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/source.md</Path> | 本地新闻工作台与 Agent 分析 |

## 未知项

代码、引用与平台验证事实由本次静态研究和后续执行验收负责；本轮用户已选择仅规划和current串行。G真实产品选择见 <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/design-tree.json</Path>。未测宿主/账号不得冒充已验证。

## 路由

按用户显式串联：G → S → T-tickets → P(plan)。代码事实和参考对照见 <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/reference-analysis.md</Path>，产品合同由Spec拥有。

## 外部动作

每个来源保持open，external_action=pending-close。授权远程写入：无。没有改标签、指派GitHub账号、评论或关闭Issue；分类分配是本地领域与执行owner。只有该issue全部AC有真实证据才进入reconcile；各源分别核销，主源字段不替代其它源关闭账本。publish未请求。

## 2026-10-11 完成核对

用户要求修复 CI，并接受本轮 Windows 验收范围；[最终验收](evidence/completion.md)。来源及关联缺陷 [#136](https://github.com/NAMEWTA/nand/issues/136) 已回读为 CLOSED。已关闭的 issue 不重复评论；本次关闭的评论含唯一 marker、提交和 CI 证据。原账号/其他平台未验证事实保留。发布 #148 保持 OPEN，不作为这些源码 change 的关闭阻塞。
