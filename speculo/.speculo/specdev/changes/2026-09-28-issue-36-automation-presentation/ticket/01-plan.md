---
schema_version: 3
plan_contract_version: 1
skill_scan: "已枚举 .agents/skills；dev 匹配产品/测试，view-render 仅匹配叶子表面；SpecDev 技能不伪装为项目技能"
skill_bindings: [{"id": "dev", "path": "<Path>.agents/skills/dev/SKILL.md</Path>", "sha256": "f9da74f9f81825387ff53292e09b7d032b2696cd33a9586a3e736044299be7e7", "phase": "implement", "operation": "apply-nand-contract", "inputs": ["当前 Map、Ticket、基线 diff 与匹配参考"], "outputs": ["符合边界的修改和逐合同验证 Evidence"], "required": true, "on_failure": "block-ticket"}, {"id": "dev", "path": "<Path>.agents/skills/dev/SKILL.md</Path>", "sha256": "f9da74f9f81825387ff53292e09b7d032b2696cd33a9586a3e736044299be7e7", "phase": "verify", "operation": "run-required-checks", "inputs": ["当前 Map、Ticket、基线 diff 与匹配参考"], "outputs": ["符合边界的修改和逐合同验证 Evidence"], "required": true, "on_failure": "block-ticket"}, {"id": "view-render", "path": "<Path>.agents/skills/view-render/SKILL.md</Path>", "sha256": "460f7764529a617992319dbb6945982da8f227329060d8aa152cdd1b0b29fbd8", "phase": "implement", "operation": "apply-nand-contract", "inputs": ["当前 Map、Ticket、基线 diff 与匹配参考"], "outputs": ["符合边界的修改和逐合同验证 Evidence"], "required": true, "on_failure": "block-ticket"}]
resource_claims: ["current-workspace:exclusive-writer", "generated-main-js:Lead-only", "source-domain:issue-36"]
artifact: "ticket"
change: "2026-09-28-issue-36-automation-presentation"
id: "T-01"
title: "运行与通知结构化状态按当前语言展示"
status: "ready"
kind: "bug"
planning_depth: "deep"
planning_depth_reason: "跨持久化/生命周期或发布边界，要求恢复和集成门"
ready: true
risk: "high"
blocked_by: []
contract_ids: ["AC-001", "AC-002", "AC-003"]
owner: "codex-issue-planning"
expected_changes: ["<Path>src/shared/automation/errors.ts</Path>", "<Path>src/shared/automation/types.ts</Path>", "<Path>src/core/automations/service.ts</Path>", "<Path>src/core/notifications/service.ts</Path>", "<Path>src/plugin/workflows/automation-host.ts</Path>", "<Path>src/view/notifications/InboxPanel.tsx</Path>", "<Path>src/view/automations/AutomationsPanel.tsx</Path>", "<Path>src/shared/i18n/automation.ts</Path>", "<Path>scripts/verify-automation.ts</Path>"]
writable_paths: ["<Path>src/shared/automation/errors.ts</Path>", "<Path>src/shared/automation/types.ts</Path>", "<Path>src/core/automations/service.ts</Path>", "<Path>src/core/notifications/service.ts</Path>", "<Path>src/plugin/workflows/automation-host.ts</Path>", "<Path>src/view/notifications/InboxPanel.tsx</Path>", "<Path>src/view/automations/AutomationsPanel.tsx</Path>", "<Path>src/shared/i18n/automation.ts</Path>", "<Path>scripts/verify-automation.ts</Path>", "<Path>main.js</Path>"]
read_only_paths: ["<Path>src/view/automations/editor.ts</Path>", "<Path>src/plugin/settings/automation-settings.ts</Path>"]
shared_paths: ["<Path>src/shared/automation/types.ts</Path>", "<Path>src/core/automations/service.ts</Path>", "<Path>src/plugin/workflows/automation-host.ts</Path>", "<Path>src/view/automations/AutomationsPanel.tsx</Path>", "<Path>src/shared/i18n/automation.ts</Path>", "<Path>scripts/verify-automation.ts</Path>", "<Path>main.js</Path>"]
shared_path_owners: ["<Path>src/shared/automation/types.ts</Path> => codex-issue-planning (唯一 Lead，按 current Ticket 串行修改)", "<Path>src/core/automations/service.ts</Path> => codex-issue-planning (唯一 Lead，按 current Ticket 串行修改)", "<Path>src/plugin/workflows/automation-host.ts</Path> => codex-issue-planning (唯一 Lead，按 current Ticket 串行修改)", "<Path>src/view/automations/AutomationsPanel.tsx</Path> => codex-issue-planning (唯一 Lead，按 current Ticket 串行修改)", "<Path>src/shared/i18n/automation.ts</Path> => codex-issue-planning (唯一 Lead，按 current Ticket 串行修改)", "<Path>scripts/verify-automation.ts</Path> => codex-issue-planning (唯一 Lead，按 current Ticket 串行修改)", "<Path>main.js</Path> => codex-issue-planning (唯一 Lead，按 current Ticket 串行修改)"]
---

# Ticket T-01: 运行与通知结构化状态按当前语言展示

- Map：<Path>{roots.state}/specdev/changes/2026-09-28-issue-36-automation-presentation/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-09-28-issue-36-automation-presentation/spec.md</Path>
- Diagnosis：<Path>{roots.state}/specdev/changes/2026-09-28-issue-36-automation-presentation/diagnosis.md</Path>
- Evidence（未来实现产物，不是已存在的通过证明）：<Path>{roots.state}/specdev/changes/2026-09-28-issue-36-automation-presentation/evidence/T-01.md</Path>

启动顺序：完整 Map → 适用项目 Skill 入口及其命中参考 → 本 Ticket → 当前上游证据。矩阵为最低集合，不是 allowlist；技能摘要漂移先由 Lead 复核绑定再继续。

## 1. 战略与来源

来源：GitHub #36 最新冻结正文/评论、Diagnosis 真实红灯与 CODE；合同 AC-001, AC-002, AC-003。

当前事实：运行列表在没有可见 run 时硬回落 pending，忽略持久化调度游标；清理历史仅移除 runs，不清 cursors，所以这是显示误报而非再次执行。日期未传 NAND locale，普通 Error 仅存 message；收件箱 body 是投递时拼接的字符串，只有部分 run.errorCode 支持动态翻译。

可观察产出：
- 新产生的系统失败原因保存稳定 code/params，运行与收件箱按当前 NAND 语言呈现；旧自由文本安全回退原文，绝不猜测翻译。
- 自动化日期与冒号遵循当前语言；用户输入/CLI 输出不翻译，已送到系统通知的历史文本不承诺追溯更改。
- 提醒标题和正文完全相同时只显示一次，原始定义与投递回执不变。

## 2. 决策状态

目标行为以 Spec 为准，实施者不重新猜产品范围。没有阻止此票规划的高影响未知。低影响默认：复用现有 host/组件/翻译体系。远程写入、实现 commit 和父分支推进授权是运行门，不能由 ready=true 授予。

## 3. 范围边界

IN：本票列出的完整行为及其回归。REUSE：现有存储、领域端口、原生 Setting 或 Preact、项目测试脚本。OUT：缺 CLI 的选择与错误优先级由 #38 唯一拥有；来源路径由 #39 拥有；不翻译用户正文、CLI 输出或猜测旧自由文本错误；不新增后台调度、邮件短信实现。

## 4. 要构建什么

- 新产生的系统失败原因保存稳定 code/params，运行与收件箱按当前 NAND 语言呈现；旧自由文本安全回退原文，绝不猜测翻译。
- 自动化日期与冒号遵循当前语言；用户输入/CLI 输出不翻译，已送到系统通知的历史文本不承诺追溯更改。
- 提醒标题和正文完全相同时只显示一次，原始定义与投递回执不变。

失败时保留原输入/数据，不给成功提示；重试不重复副作用。与其它票的共享源只由唯一 Lead 在当前票写入。

## 5. 实现契约

入口与修改导航：<Path>src/shared/automation/errors.ts</Path>, <Path>src/shared/automation/types.ts</Path>, <Path>src/core/automations/service.ts</Path>, <Path>src/core/notifications/service.ts</Path>。

输入/输出：由上述用户动作驱动到可观察文本、状态、来源或文件；测试必须穿过真实入口，不仅断言某 helper 被调用。公共 ID/机器标记保持；新代码不得让 view 导入 plugin。语言转换不得更改用户正文。持久化变更先保存后发布，失败不得丢失游标、回执或已存记录。

兼容：读取现有数据；未知或旧字符串原样回退，不用启发式翻译/丢弃。安全：只处理用户明确的目标，不扩大 Vault/会话权限。状态与失败流由 Spec 合同逐项覆盖。

## 6. 执行路线

1. 补运行→通知→持久化→重启→切换语言的集成夹具，覆盖代码化与 legacy message。
2. 以可选字段扩展通知呈现元数据；错误统一通过稳定标识而非保存翻译结果，保留原有字符串读取。
3. 呈现层统一日期 locale、标点与重复内容显示；结构化未知 code 有安全回退，不把堆栈暴露为用户提示。
4. 重启/清理/损坏存储/重复通知用例验证不变量，生产数据不做批量迁移。

## 7. 路径访问契约

- <Path>src/shared/automation/errors.ts</Path>
- <Path>src/shared/automation/types.ts</Path>
- <Path>src/core/automations/service.ts</Path>
- <Path>src/core/notifications/service.ts</Path>
- <Path>src/plugin/workflows/automation-host.ts</Path>
- <Path>src/view/notifications/InboxPanel.tsx</Path>
- <Path>src/view/automations/AutomationsPanel.tsx</Path>
- <Path>src/shared/i18n/automation.ts</Path>
- <Path>scripts/verify-automation.ts</Path>
- <Path>main.js</Path>

只可写 frontmatter 中路径。新测试纳入已有 scripts 命令；若需要新增其他路径，先由 Lead 更新范围并重过 DoR。main.js 是构建输出，由 Lead 在当前 Ticket 重建；不得手工编辑。共享源 owner 唯一，严格串行；读到外部 dirty 改动则暂停相交写集。

## 8. 验证矩阵

| 行为/风险 | 接缝与步骤 | 预期 | Evidence |
|---|---|---|---|
| 正常与边界 | AC-001, AC-002, AC-003：由真实入口驱动，每条行为覆盖中文/英文与必要状态组合 | 全部可观察产出成立 | <Path>{roots.state}/specdev/changes/2026-09-28-issue-36-automation-presentation/evidence/T-01.md</Path> |
| 已确认失败 | 先原样重跑 diagnosis 红灯，再加本票合同到现有测试；不得启用 PROBE_CONTROL 当成回归绿 | 目标断言先红后绿，非构建错误 | <Path>{roots.state}/specdev/changes/2026-09-28-issue-36-automation-presentation/evidence/T-01.md</Path> |
| 定向回归 | `pnpm test:automation`；`pnpm test:panel-composition` | 0 exit，原有数据/生命周期合同不变 | <Path>{roots.state}/specdev/changes/2026-09-28-issue-36-automation-presentation/evidence/T-01.md</Path> |
| Workspace checks | `pnpm run build`、`pnpm run lint`；结构变化加 `pnpm test:architecture` | 无新增错误、bundle 与源码一致 | <Path>{roots.state}/specdev/changes/2026-09-28-issue-36-automation-presentation/evidence/T-01.md</Path> |
| E2E | Lead 在 current-workspace 的干净 Obsidian 测试库执行下述步骤 | 宿主实际行为与合同一致 | <Path>{roots.state}/specdev/changes/2026-09-28-issue-36-automation-presentation/evidence/T-01.md</Path> |

E2E disposition: required。

E2E owner/environment：Lead / current-workspace（未创建 worktree）。场景：按本票每条可观察产出依次操作，zh→en→zh，保存/重启后复验；包含空数据、失效输入，涉及布局则100+记录、800px/窄leaf及默认深浅主题截图；本轮尚未运行。

## 9. 发布、迁移与恢复

Expand：新增可选字段/开关并保留旧数据读取；Migrate：只在正常保存或新生成时使用新格式，不批量改写；Contract：本轮不删除旧字符串/旧数据支持。发布票遵守同 tag 五平台资产及公开下载验证，旧服务不在支持范围。

观察信号：目标错误、保存失败、重复通知/执行、订阅数/残留进程、用户数据摘要变化。回滚局部源码/产物，保留用户新增数据；已对外发布版本不重写 tag，发修订版本。发布/推送/真实用户数据迁移均需具体动作授权。重复集成失败达到3次则停止该票，保存检查点，不无限尝试。

## 10. 验收标准

- [ ] AC-001：新产生的系统失败原因保存稳定 code/params，运行与收件箱按当前 NAND 语言呈现；旧自由文本安全回退原文，绝不猜测翻译。
- [ ] AC-002：自动化日期与冒号遵循当前语言；用户输入/CLI 输出不翻译，已送到系统通知的历史文本不承诺追溯更改。
- [ ] AC-003：提醒标题和正文完全相同时只显示一次，原始定义与投递回执不变。
- [ ] Skill Execution Records 完整记录真实调用、摘要、操作、证据与结果。
- [ ] 路径未越界；所需 E2E 已实际执行。
- [ ] 授权后形成非空 implementation commit，Lead direct-parent 验证通过并记录 result SHA；当前本地计划不是该证据。
- [ ] 所有回归/构建/lint通过，未完成项没有伪标 done；无需要改动时取消该票并注明事实，禁止 empty commit。

## 11. SKILL 调用计划

dev implement：先读架构/领域参考，用其依赖与命名/持久化规则约束实现；verify：执行项目要求的构建、lint及本票定向脚本，写真实命令/exit。view-render implement：操作叶子前读取 runtime，验证 contentEl、window、unmount、host注入与局部样式。

必要 Skill 缺失或 SHA 漂移：block-ticket；不得将“已经阅读”当成执行完成。

## 12. 停止、检查点与交付

用户要求完整分析与计划，未规定固定票数，不能用删合同减票。当前为 plan，不实施。缺 required 接缝/环境、契约偏差、他人写集、源漂移则暂停本票及真实下游；独立票仍可规划。恢复读取 Map/Goal/源HEAD/Skill摘要/最近Evidence，核对未闭合动作再继续。交付所有 AC Evidence 后交回 Goal，不能自动远程评论、关闭或归档。
