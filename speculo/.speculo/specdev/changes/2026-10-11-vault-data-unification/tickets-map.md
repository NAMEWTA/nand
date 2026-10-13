---
schema_version: 3
plan_contract_version: 1
plan_revision: 2
requested_deliverables: [{"name":"0.0.1-alpha.2 Release","count":1}]
deliverable_policy: "用户批准全量存储、两项 issue、中文文档、Windows 验收、一次 alpha.2 发布与归档；不削减交付。"
artifact: "tickets-map"
change: "2026-10-11-vault-data-unification"
status: "in_progress"
---

# 实施总控

### 总体实施背景

合同位于 <Path>{roots.state}/specdev/changes/2026-10-11-vault-data-unification/spec.md</Path>。先修复持久化再迁移路径，内容/浏览器/账号分别验收，随后整理文档并发布。模块只经 api.ts 协作，Node/Electron 仅 desktop。root 是全部项目写入、状态、提交、E2E 与远程动作的唯一 owner。current workspace 串行实施，无 subagent 并行写入。未创建 Goal Plan，按已批准的确定性顺序 T-01 至 T-08 进入 I。

### 项目 Skill 读取矩阵

| Applies To | Project Skill | Trigger / Scope | Read Timing | Purpose |
|---|---|---|---|---|
| ALL | <Path>.agents/skills/dev/SKILL.md</Path> | 插件、存储、测试、文档与发布 | Map 后 Ticket 前 | 架构与验证 |
| T-02,T-03,T-04,T-05,T-06,T-08 | <Path>.agents/skills/ui/SKILL.md</Path> | 内容与账号界面、浏览器、宿主验收 | Map 后 Ticket 前 | 工作台与可访问性 |

## 2. 执行清单

| ID | Ticket | 可观察产出 | Blocked By | Depth | Risk | Ready | Owner | Contract IDs | Status |
|---|---|---|---|---|---|---|---|---|---|
| T-01 | <Path>{roots.state}/specdev/changes/2026-10-11-vault-data-unification/ticket/01-durable-storage.md</Path> | 连续保存与故障恢复 | — | deep | high | yes | root | AC-001 | done |
| T-02 | <Path>{roots.state}/specdev/changes/2026-10-11-vault-data-unification/ticket/02-vault-storage.md</Path> | 统一路径、设备身份与内部状态 | T-01 | deep | high | yes | root | AC-002 | done |
| T-03 | <Path>{roots.state}/specdev/changes/2026-10-11-vault-data-unification/ticket/03-hidden-content.md</Path> | 隐藏目录中的内容访问和迁移 | T-02 | deep | high | yes | root | AC-003 | done |
| T-04 | <Path>{roots.state}/specdev/changes/2026-10-11-vault-data-unification/ticket/04-browser-sessions.md</Path> | 浏览器会话与产物进入 vault | T-02 | deep | high | yes | root | AC-004 | done |
| T-05 | <Path>{roots.state}/specdev/changes/2026-10-11-vault-data-unification/ticket/05-agent-accounts.md</Path> | 账号身份、凭据与终端辅助程序 | T-02 | deep | high | yes | root | AC-005 | done |
| T-06 | <Path>{roots.state}/specdev/changes/2026-10-11-vault-data-unification/ticket/06-git-release-gates.md</Path> | Git 冲突判定与发布检查依赖 | — | deep | high | yes | root | AC-006 | done |
| T-07 | <Path>{roots.state}/specdev/changes/2026-10-11-vault-data-unification/ticket/07-current-docs.md</Path> | 当前规范中文化与旧文档清理 | T-01, T-02, T-03, T-04, T-05, T-06 | deep | high | yes | root | AC-007 | done |
| T-08 | <Path>{roots.state}/specdev/changes/2026-10-11-vault-data-unification/ticket/08-alpha2-delivery.md</Path> | Windows 验收、alpha.2 发布与归档 | T-01, T-02, T-03, T-04, T-05, T-06, T-07 | deep | high | yes | root | AC-008 | ready |

## 4. 合同覆盖矩阵

AC-001 → T-01：JsonStore 与真实 SettingsStore 接线。

AC-002 → T-02：路径解析、设备初始化及现有状态调用链。

AC-003 → T-03：内容文档集合、工作台编辑入口与迁移清单。

AC-004 → T-04：Windows Obsidian 的 Session.storagePath 与本地测试站点。

AC-005 → T-05：Agent 启动/恢复/自动化的真实环境与私有目录。

AC-006 → T-06：真实 Git autostash 与 Release reusable workflow。

AC-007 → T-07：文档政策、链接校验与 A 永久知识网关。

AC-008 → T-08：完整 CI、真实 Release 资产与 Windows Obsidian。

## 9. 总控与恢复

状态来自票 frontmatter。生产写入串行；公共接口先稳定后迁移消费者，未完成票不得收缩兼容层。各票定向验证与双轴审查通过后记录 commit/Evidence；2026-10-12 用户取消 Windows 专属验收门，优先完成编码；完整 CI 和当前可用环境的适用集成检查仍为发布前门。T-07 仅经 A 网关修改永久知识；已归档历史只读。同步数据不授权重放旧运行队列。失败保留基线、未闭合操作和恢复点。完成后按 T 远程入口验证 Release/issue，按 A 网关归档。

## 3. 依赖 DAG

T-01 → T-02 → {T-03,T-04,T-05}；T-06 独立；T-01..T-06 → T-07 → T-08。所有票按编号串行执行，路径相交由唯一 root owner 修改。

## 5. 并行与路径所有权

不并行写入。全部共享项目路径显式绑定 root，状态及 E2E 也由 root 负责。

恢复约束：单并发，不派发其他 agent。两轴分别顺序自审，明确无独立 reviewer 的局限；Windows 历史失败保留，不阻断用户已取消的专属门禁。

### plan_revision 2：A网关阶段归属澄清

A仅处理completed change；T-07先完成当前中文项目文档及知识候选，T-08完成发布/真实下载/issue核对并交接A。正式永久知识归并及移动在本地完成后执行，仍为AC-007/AC-008和整个Goal的硬交付，未减少数量/权限/验收。依赖编号仍严格串行；A前不得修改永久 namespace 或宣称归档。根因是原票将A的完成后动作写入前置I票，造成生命周期循环；由同一root按原已批准完整目标澄清拥有者。
