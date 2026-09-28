# docs 来源与毕业映射

核验日期：2026-09-28。原始材料来自工作区基线提交 fa1803c4c435d6541992d6e85c1e02f61b27c51b，全部 44 份保持原字节。永久知识是当前代码核验后的提炼，不是对历史验收的重跑。

## 每份材料的去向

| 原始资料（归档副本） | 内容和毕业判断 | 当前知识或公开入口 | 原 docs 动作 |
|---|---|---|---|
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/agent-upgrade-2026-09-27.md</Path> | 智能体升级与 #14、#26–#36 修复；长期机制提升；Promise thenable、按钮响应等局部修复及未复现 #33 留历史。 | <Path>{roots.state}/specdev/adr/0003-pty-session-view-lifetimes.md</Path>、<Path>{roots.state}/specdev/adr/0004-vault-scoped-native-history.md</Path>、<Path>{roots.state}/specdev/adr/0007-device-owned-durable-automation.md</Path>、<Path>{roots.state}/specdev/adr/0008-independent-notification-receipts.md</Path>、<Path>{roots.state}/specdev/adr/0009-isolated-iconic-store.md</Path>、<Path>{roots.state}/specdev/context/terminal-agent.md</Path>、<Path>{roots.state}/specdev/context/automations.md</Path>、<Path>{roots.state}/specdev/context/notifications.md</Path> | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/agent-workbench.md</Path> | 终端使用、原生历史、用量与开发安装；用户操作保留；Rust 安装与验收过程留原件，历史/用量语义进入术语。 | <Path>{roots.state}/specdev/adr/0003-pty-session-view-lifetimes.md</Path>、<Path>{roots.state}/specdev/adr/0004-vault-scoped-native-history.md</Path>、<Path>{roots.state}/specdev/context/terminal-agent.md</Path>、<Path>docs/agent-workbench.md</Path> | rewrite-for-users |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/agent-workbench.png</Path> | 历史界面截图；不提升为架构决定或词汇，不作为最新构建的验收。公开保留为工作台布局示意。 | <Path>docs/agent-workbench.png</Path> | retain |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/architecture-refactor/terminal-1.13.7.png</Path> | 历史界面截图；不提升为架构决定或词汇，不作为最新构建的验收。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/architecture-refactor/validation.json</Path> | 原始运行结果／构建指纹；保留原版本与场景，不能转换为本次运行结果。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/architecture-refactor.md</Path> | 分层、渲染、生命周期和完整迁移；架构提炼；组件清单与 49 个测试入口、580 模块等阶段结果留原件。 | <Path>{roots.state}/specdev/adr/0001-layered-dependency-boundaries.md</Path>、<Path>{roots.state}/specdev/adr/0002-native-host-preact-surfaces.md</Path>、<Path>{roots.state}/specdev/adr/0003-pty-session-view-lifetimes.md</Path>、<Path>{roots.state}/specdev/adr/0005-contacts-markdown-source.md</Path>、<Path>{roots.state}/specdev/adr/0006-comment-sidecar-storage.md</Path>、<Path>{roots.state}/specdev/context/nand-shell.md</Path>、<Path>{roots.state}/specdev/context/dashboard.md</Path>、<Path>{roots.state}/specdev/context/context-map.md</Path> | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/automation.md</Path> | 设备调度、来源数据、运行恢复和通知；使用、备份和能力限制保留；旧源码表、测试与发布过程只归档。 | <Path>{roots.state}/specdev/adr/0007-device-owned-durable-automation.md</Path>、<Path>{roots.state}/specdev/adr/0008-independent-notification-receipts.md</Path>、<Path>{roots.state}/specdev/context/automations.md</Path>、<Path>{roots.state}/specdev/context/notifications.md</Path>、<Path>docs/automation.md</Path> | rewrite-for-users |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/contacts-development.md</Path> | 档案数据流、冲突、维护和验收；稳定数据决定提升；代码导航与未完成实机清单留原件。 | <Path>{roots.state}/specdev/adr/0005-contacts-markdown-source.md</Path>、<Path>{roots.state}/specdev/context/contacts.md</Path> | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/contacts.md</Path> | 档案操作、身份、任职和关系；操作与冲突处理保留；规范术语和数据权威提炼；失效源码链接改为用户目录内格式说明。 | <Path>{roots.state}/specdev/adr/0005-contacts-markdown-source.md</Path>、<Path>{roots.state}/specdev/context/contacts.md</Path>、<Path>docs/contacts.md</Path> | rewrite-for-users |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/iconic/picker-popout.png</Path> | 历史界面截图；不提升为架构决定或词汇，不作为最新构建的验收。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/iconic/rules.png</Path> | 历史界面截图；不提升为架构决定或词汇，不作为最新构建的验收。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/iconic/settings-1.12.4.png</Path> | 历史界面截图；不提升为架构决定或词汇，不作为最新构建的验收。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/iconic/settings-1.13.7.png</Path> | 历史界面截图；不提升为架构决定或词汇，不作为最新构建的验收。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/iconic-port.md</Path> | Iconic 迁入边界、上游 oracle 与兼容差异；稳定隔离决定提升；固定上游对照、22 项配置和桌面验证保留为日期证据。 | <Path>{roots.state}/specdev/adr/0009-isolated-iconic-store.md</Path>、<Path>{roots.state}/specdev/context/icons.md</Path> | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/icons.md</Path> | 图标操作、规则与备份；操作和恢复保留；移除开发记录入口；语义与独立存储决定提升。 | <Path>{roots.state}/specdev/adr/0009-isolated-iconic-store.md</Path>、<Path>{roots.state}/specdev/context/icons.md</Path>、<Path>docs/icons.md</Path> | rewrite-for-users |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/issue-23-25/comments-dark-narrow.png</Path> | 历史界面截图；不提升为架构决定或词汇，不作为最新构建的验收。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/issue-23-25/comments-light.png</Path> | 历史界面截图；不提升为架构决定或词汇，不作为最新构建的验收。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/issue-23-25/popout-titles.json</Path> | 原始运行结果／构建指纹；保留原版本与场景，不能转换为本次运行结果。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/issue-23-25/runtime-checks.json</Path> | 原始运行结果／构建指纹；保留原版本与场景，不能转换为本次运行结果。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/issue-23-25-fixes.md</Path> | 评论浮层、无障碍和标题路由；评论来源语义和持久化边界提炼；定位、Scope 与窗口标题修复是可逆实现细节，不另造 ADR。 | <Path>{roots.state}/specdev/adr/0006-comment-sidecar-storage.md</Path>、<Path>{roots.state}/specdev/context/comments.md</Path> | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/issue-fixes-2026-09-27/comments-en.png</Path> | 历史界面截图；不提升为架构决定或词汇，不作为最新构建的验收。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/issue-fixes-2026-09-27/settings-sync.png</Path> | 历史界面截图；不提升为架构决定或词汇，不作为最新构建的验收。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/issue-fixes-2026-09-27.md</Path> | 早期 #17–#22 路径、语言和设置修复；现行术语提升；早期迁移工具、测试结果和当时 issue 状态只归档。 | <Path>{roots.state}/specdev/adr/0006-comment-sidecar-storage.md</Path>、<Path>{roots.state}/specdev/context/nand-shell.md</Path>、<Path>{roots.state}/specdev/context/comments.md</Path> | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/issue-review-2026-09-27.md</Path> | 旧问题状态与已实施的后续计划；ephemeral：被后续实现取代的计划和远程状态快照，不列为当前待办，不重新查询或修改远程。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/third-party/orca-LICENSE.txt</Path> | Orca 固定来源及完整 MIT 归属；公开与构建用途保留，不作为领域知识。 | <Path>docs/third-party/orca-LICENSE.txt</Path> | retain |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/ui-review/after-agent-english-dark.png</Path> | 历史界面截图；不提升为架构决定或词汇，不作为最新构建的验收。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/ui-review/after-agent-narrow-dark.png</Path> | 历史界面截图；不提升为架构决定或词汇，不作为最新构建的验收。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/ui-review/after-agent-settings.png</Path> | 历史界面截图；不提升为架构决定或词汇，不作为最新构建的验收。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/ui-review/after-board.png</Path> | 历史界面截图；不提升为架构决定或词汇，不作为最新构建的验收。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/ui-review/after-comments-dark.png</Path> | 历史界面截图；不提升为架构决定或词汇，不作为最新构建的验收。实际画面含前景用量弹窗，不能仅凭文件名当成完整深色评论验收。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/ui-review/after-comments-english-dark.png</Path> | 历史界面截图；不提升为架构决定或词汇，不作为最新构建的验收。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/ui-review/after-comments-light.png</Path> | 历史界面截图；不提升为架构决定或词汇，不作为最新构建的验收。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/ui-review/after-connection.png</Path> | 历史界面截图；不提升为架构决定或词汇，不作为最新构建的验收。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/ui-review/after-disabled-editor.png</Path> | 历史界面截图；不提升为架构决定或词汇，不作为最新构建的验收。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/ui-review/after-home.png</Path> | 历史界面截图；不提升为架构决定或词汇，不作为最新构建的验收。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/ui-review/after-usage.png</Path> | 历史界面截图；不提升为架构决定或词汇，不作为最新构建的验收。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/ui-review/before-agent-settings.png</Path> | 历史界面截图；不提升为架构决定或词汇，不作为最新构建的验收。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/ui-review/before-board.png</Path> | 历史界面截图；不提升为架构决定或词汇，不作为最新构建的验收。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/ui-review/before-comments.png</Path> | 历史界面截图；不提升为架构决定或词汇，不作为最新构建的验收。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/ui-review/before-connection.png</Path> | 历史界面截图；不提升为架构决定或词汇，不作为最新构建的验收。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/ui-review/before-disabled-editor.png</Path> | 历史界面截图；不提升为架构决定或词汇，不作为最新构建的验收。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/ui-review/before-home.png</Path> | 历史界面截图；不提升为架构决定或词汇，不作为最新构建的验收。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/ui-review/before-usage.png</Path> | 历史界面截图；不提升为架构决定或词汇，不作为最新构建的验收。 | 只保留归档证据 | remove-after-verified-archive |
| <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/ui-review-2026-09-26.md</Path> | 模块启停和界面历史评审；宿主/模块边界提炼；布局调整、前后截图和固定用量夹具留历史。 | <Path>{roots.state}/specdev/adr/0002-native-host-preact-surfaces.md</Path>、<Path>{roots.state}/specdev/context/nand-shell.md</Path>、<Path>{roots.state}/specdev/context/comments.md</Path> | remove-after-verified-archive |

## 核验后的阅读入口

- 当前领域语义：<Path>{roots.state}/specdev/context/</Path>；词汇出处逐项见 <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/context-provenance.md</Path>。
- 当前决策：<Path>{roots.state}/specdev/adr/</Path>；每份 ADR 自带当前代码指针和来源。
- 档案维护场景与未完成实机检查：<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/contacts-development.md</Path>。代码导航应以 ADR-0005 与当前源码为准，历史表格不是现役路径索引。
- 上游移植适配、资源许可和已知行为差异：<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/iconic-port.md</Path>；独立 oracle 位于 CODE:<Path>scripts/fixtures/iconic/README.md</Path>。
- Rust 本地配套安装与真实提供方验证边界：<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/agent-workbench.md</Path>、<Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/original-docs/agent-upgrade-2026-09-27.md</Path>；当前执行规范见 <Path>.agents/skills/dev/references/build-and-release.md</Path>。

## 事实冲突与处理

| 原表述 | 当前核验 | 处理 |
|---|---|---|
| 自动化指南中的 automation、notifications、terminal-agent 旧目录 | 源码已分为 core/platform/view，组合位于 plugin/workflows | 公开指南删除实现表，永久决策引用当前路径 |
| 档案指南指向旧 contacts 格式说明源码 | 当前协议在 core/contacts/persist；用户目录缺失时会生成说明 | 用户指南引导读取资料目录内说明；ADR 保留当前源码指针 |
| 开发技能称仍有业务面板未完成 Preact 迁移 | 当前业务面板已迁移，原生布局和配置 UI 仍保留 | 修正文案，不把原生配置 UI 当迁移遗漏 |
| 开发技能中的 workspace-registry 和终端 workbench 旧路径 | 实际位于 core/workspace 和 TerminalWorkbench | 修正现役导航 |
| 早期报告有 178/179/181 终端测试、19/20 档案测试、不同 lint 警告数 | 结果属于各自日期和构建 | 原文保留；不相互覆盖或拼成当前验收 |
| 全部看板迁移已有 GUI 验收 | 最终重构记录明确没有迁移后的完整 GUI 复验 | 不作此承诺；保留原构建指纹及旧截图边界 |
| #33 等旧 issue 状态及未复现结论 | 本次没有新的远程或运行时调查 | 保留日期，不宣称当前仍 open 或已解决 |

## 引用与保真边界

原始副本的相对链接按迁移前 docs 位置解释；旧源码引用本身可能已失效。这里保留原字节并提供当前导航，不以重写原件来掩盖历史。新工件与现役入口的链接全部检查。JSON 中的旧构建哈希、测试环境 ENOSPC/fs.watch 绕过、未覆盖的平台和 GUI 限制一并保留。

本次执行和命令结果见 <Path>{roots.state}/specdev/archive/2026-09/2026-09-28-docs-knowledge-consolidation/evidence/direct-spec.md</Path>。后续实机验收应建立新的 change/Evidence，不能在已封存的历史原件上追加当前成功声明。
