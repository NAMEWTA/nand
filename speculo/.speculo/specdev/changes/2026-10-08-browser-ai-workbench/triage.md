---
schema_version: 2
artifact: "triage"
change: "2026-10-08-browser-ai-workbench"
mode: "intake"
disposition: "ready-for-agent"
verification: "passed"
remote_actions: []
source: "<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/source.md</Path>"
classification: "mixed"
risk: "high"
route: "specdev/grill-with-docs"
ready_for_implementation: false
external_action: "pending-close"
publish_action: "not-requested"
publish: null
updated_at: "2026-10-09T04:27:47.546747+00:00"
---

# Triage: 浏览器快捷键修复与多 AI 工作台、受限网页助手

## 当前判定

先独立修复 #142 浏览器地址栏快捷键，再在现有 Obsidian 浏览器内交付真实可用的 DeepSeek/Kimi/ChatGPT 三站 PoC，以真实宿主证据为后续 Gate，逐站补齐八站、可靠保存迁移、可选综合、受限网页助手、用户指认与复用流程、本地 scoped 外接。用户已确认完整阶段范围、三站、共享默认加可选隔离 profile、当前轮 Markdown 与模板快照/来源、maiw v3 迁移、确定发送不引额外 LLM、综合/助手 opt-in 与本地 token bridge；本轮只规划，所有实现 ticket 保留未执行，current 严格串行。

本地 HEAD 1b9121382363cc50254fbc973c24742b7742edc7。已有稳定 page id、逐页队列、epoch:revision 引用、webview 生命周期/权限/Design Mode、默认同 vault Electron partition、opt-in token IPC/CLI；BrowserModule.execute 对几乎全部命令都会 activate，后台读也抢目标焦点。无 task/turn/exchange、站点 adapter、持久 submit intent、当前轮回答采集或 profile 隔离。#142 地址栏只挂 DOM 冒泡 keydown，guest 另有 before-input-event；尚未实际运行修复或真实 AI 账号验证。只有 workbench/comments 两个注册 view；浏览器必须复用 workbench feature 与 NativeSurface。

核验通过仅表示完整摄入和当前源码证据足以规划；并非已复现全部宿主问题、完成实现或通过验收。BUG全部保留修复票，旧事实已过时的部分明确核销，不重复建设。

## 来源和分配

| Issue | 不可变快照 | 分类/归属 |
|---|---|---|
| #142 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/source.md</Path> | 浏览器快捷键修复与多 AI 工作台、受限网页助手 |
| #145 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/sources/SRC-145.md</Path> | 浏览器快捷键修复与多 AI 工作台、受限网页助手 |

## 未知项

代码、引用与平台验证事实由本次静态研究和后续执行验收负责；本轮用户已选择仅规划和current串行。G真实产品选择见 <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/design-tree.json</Path>。未测宿主/账号不得冒充已验证。

## 路由

按用户显式串联：G → S → T-tickets → P(plan)。代码事实和参考对照见 <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/reference-analysis.md</Path>，产品合同由Spec拥有。

## 外部动作

每个来源保持open，external_action=pending-close。授权远程写入：无。没有改标签、指派GitHub账号、评论或关闭Issue；分类分配是本地领域与执行owner。只有该issue全部AC有真实证据才进入reconcile；各源分别核销，主源字段不替代其它源关闭账本。publish未请求。
