# NAND 全部 open issue 规划总览

已按用户确认完成 T-triage → G → S → T-tickets → P-goal-plan。**13个open issue → 8个领域change → 61张Ticket → 180条验收合同**，另有1个整体父Goal。所有设计树consensus，子Spec/Tickets Ready；本轮只规划，产品执行0/61、issue关闭0/13。

**整体入口**：<Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/tickets-map.md</Path>；**整体Goal**：<Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/implementation-plan.md</Path>；**依赖与归属**：<Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/implementation-map.md</Path>；**验证报告**：<Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/planning-validation.md</Path>。

| 领域 | Issue | Tickets / AC | Spec | Tickets Map | Goal Plan |
|---|---|---|---|---|---|
| 工作台导航、常规设置与图标语言回归 | #138, #139, #140 | 3 / 5 | <Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/spec.md</Path> | <Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/tickets-map.md</Path> | <Path>{roots.state}/specdev/changes/2026-10-08-workbench-regressions/goal-plan.md</Path> |
| 终端 helper 可安装性、错误反馈与句柄隔离 | #135, #143 | 2 / 5 | <Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/spec.md</Path> | <Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/tickets-map.md</Path> | <Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/goal-plan.md</Path> |
| NAND 私有目录和文件的最小POSIX权限 | #144 | 2 / 6 | <Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/spec.md</Path> | <Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/tickets-map.md</Path> | <Path>{roots.state}/specdev/changes/2026-10-08-private-storage-permissions/goal-plan.md</Path> |
| 档案列表、卡片与正文检索的完整核销 | #124 | 1 / 8 | <Path>{roots.state}/specdev/changes/2026-10-08-archives-completion/spec.md</Path> | <Path>{roots.state}/specdev/changes/2026-10-08-archives-completion/tickets-map.md</Path> | <Path>{roots.state}/specdev/changes/2026-10-08-archives-completion/goal-plan.md</Path> |
| Git 同步对照补齐、仓库边界与失败恢复 | #134 | 4 / 11 | <Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/spec.md</Path> | <Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/tickets-map.md</Path> | <Path>{roots.state}/specdev/changes/2026-10-08-git-sync-parity/goal-plan.md</Path> |
| 首页看板自由网格、组件贡献与智能体技能派发 | #137, #141 | 18 / 77 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/spec.md</Path> | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/tickets-map.md</Path> | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/goal-plan.md</Path> |
| 本地新闻工作台与 Agent 分析 | #136 | 10 / 28 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/spec.md</Path> | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/tickets-map.md</Path> | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/goal-plan.md</Path> |
| 浏览器快捷键修复与多 AI 工作台、受限网页助手 | #142, #145 | 21 / 40 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/spec.md</Path> | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path> | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/goal-plan.md</Path> |

## 完整范围与用户已确认选择

- 首页：全部apex要求与#141修复；闰月映射普通同名农历月、短月月末；命名外观保存全局theme+home；列头默认预览，显式直发整列路径。
- 新闻：完整AIHOT信源、AI精选、事件、热度趋势、要闻、收藏/简报、三种首页组件、OPML/静态网页/七天曲线/可选双评分；默认关闭，桌面完整、手机读Markdown；周期后台默认关，未知AI批次只手动重试。
- 浏览器：#142独立修复；DeepSeek/Kimi/ChatGPT真实PoC Gate后完整八站、可靠历史与maiw v3迁移、显式综合/受限助手、可复用流程、自动化与本地scoped bridge。共享默认登录+可选多账号profile；不自动搬官网所有历史/附件。
- 档案与Git：基于当前已有实现补真实缺口和完成证据；Git补安全clone、库外index边界和实际push目标保护；档案保留双布局/全文/滚动/身份/规模等全部验收，不重造已完成机制。
- 所有显式BUG和研究新增缺陷都有具体修复票、失败复现与验收；未以“已有代码”替代真实宿主结果。
- 后续在当前工作区严格串行；保留用户现有145个改动路径。本轮单一中文运行时工件例外不改变产品/用户文档双语要求。无产品代码修改、提交、远程标签/分配/关闭、PR或发布。

## 显式 BUG 修复账本

| Issue | 归属修复票 | 验收重点 |
|---|---|---|
| #138 | 2026-10-08-workbench-regressions::T-01 | overlay图标轨单击/焦点与返回 |
| #139 | 2026-10-08-workbench-regressions::T-02 | 设置模块图标可见 |
| #140 | 2026-10-08-workbench-regressions::T-03 | 语言切换后下拉框尺寸 |
| #135 | 2026-10-08-terminal-reliability::T-01 | 真实安装与HTTP/网络诊断 |
| #143 | 2026-10-08-terminal-reliability::T-02 | Unix最早清理继承FD |
| #144 | 2026-10-08-private-storage-permissions::T-01、T-02 | POSIX所有writer、SQLite旁文件与symlink |
| #141 | 2026-10-08-home-grid-rebuild::T-01 | 窄桌面快捷创建高度 |
| #142 | 2026-10-08-browser-ai-workbench::T-01 | 地址栏/工具栏Mod+F与Mod+L |

#134额外发现的库外暂存/取消暂存与squash目标风险纳入Git T-01/T-03。八域源快照和reference-analysis保留完整原文、固定SHA、已读文件、采用/差异和许可边界。

## 执行与完成含义

全部合同Ready，执行Goal仍draft/blocked、ready_for_execution=false：这是用户明确“本轮只规划”的边界，并非产品设计未完成。后续按整体P run/resume读取真实授权与依赖Evidence，不跳过PoC、宿主与跨域Gate，不用mock声称实际账号通过。
