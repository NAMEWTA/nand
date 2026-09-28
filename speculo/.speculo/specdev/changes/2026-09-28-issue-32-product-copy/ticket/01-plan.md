---
schema_version: 3
plan_contract_version: 1
skill_scan: "已枚举 .agents/skills；dev 匹配产品/测试，view-render 仅匹配叶子表面；SpecDev 技能不伪装为项目技能"
skill_bindings: [{"id": "dev", "path": "<Path>.agents/skills/dev/SKILL.md</Path>", "sha256": "f9da74f9f81825387ff53292e09b7d032b2696cd33a9586a3e736044299be7e7", "phase": "implement", "operation": "apply-nand-contract", "inputs": ["当前 Map、Ticket、基线 diff 与匹配参考"], "outputs": ["符合边界的修改和逐合同验证 Evidence"], "required": true, "on_failure": "block-ticket"}, {"id": "dev", "path": "<Path>.agents/skills/dev/SKILL.md</Path>", "sha256": "f9da74f9f81825387ff53292e09b7d032b2696cd33a9586a3e736044299be7e7", "phase": "verify", "operation": "run-required-checks", "inputs": ["当前 Map、Ticket、基线 diff 与匹配参考"], "outputs": ["符合边界的修改和逐合同验证 Evidence"], "required": true, "on_failure": "block-ticket"}, {"id": "view-render", "path": "<Path>.agents/skills/view-render/SKILL.md</Path>", "sha256": "460f7764529a617992319dbb6945982da8f227329060d8aa152cdd1b0b29fbd8", "phase": "implement", "operation": "apply-nand-contract", "inputs": ["当前 Map、Ticket、基线 diff 与匹配参考"], "outputs": ["符合边界的修改和逐合同验证 Evidence"], "required": true, "on_failure": "block-ticket"}]
resource_claims: ["current-workspace:exclusive-writer", "generated-main-js:Lead-only", "source-domain:issue-32"]
artifact: "ticket"
change: "2026-09-28-issue-32-product-copy"
id: "T-01"
title: "修正已锁定的品牌及标点文案"
status: "ready"
kind: "bug"
planning_depth: "standard"
planning_depth_reason: "跨入口与领域接缝的可独立验收行为切片"
ready: true
risk: "medium"
blocked_by: []
contract_ids: ["AC-001", "AC-002"]
owner: "codex-issue-planning"
expected_changes: ["<Path>src/shared/i18n/terminal-agent.ts</Path>", "<Path>src/shared/i18n/nand.ts</Path>", "<Path>src/shared/i18n/iconic.ts</Path>", "<Path>scripts/verify-issue-regressions.ts</Path>"]
writable_paths: ["<Path>src/shared/i18n/terminal-agent.ts</Path>", "<Path>src/shared/i18n/nand.ts</Path>", "<Path>src/shared/i18n/iconic.ts</Path>", "<Path>scripts/verify-issue-regressions.ts</Path>", "<Path>main.js</Path>"]
read_only_paths: []
shared_paths: ["<Path>main.js</Path>"]
shared_path_owners: ["<Path>main.js</Path> => codex-issue-planning (唯一 Lead，按 current Ticket 串行修改)"]
---

# Ticket T-01: 修正已锁定的品牌及标点文案

- Map：<Path>{roots.state}/specdev/changes/2026-09-28-issue-32-product-copy/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-09-28-issue-32-product-copy/spec.md</Path>
- Diagnosis：<Path>{roots.state}/specdev/changes/2026-09-28-issue-32-product-copy/diagnosis.md</Path>
- Evidence（未来实现产物，不是已存在的通过证明）：<Path>{roots.state}/specdev/changes/2026-09-28-issue-32-product-copy/evidence/T-01.md</Path>

启动顺序：完整 Map → 适用项目 Skill 入口及其命中参考 → 本 Ticket → 当前上游证据。矩阵为最低集合，不是 allowlist；技能摘要漂移先由 Lead 复核绑定再继续。

## 1. 战略与来源

来源：GitHub #32 最新冻结正文/评论、Diagnosis 真实红灯与 CODE；合同 AC-001, AC-002。

当前事实：实际合并后的翻译字典仍返回旧字面量，非语言事件或缓存问题：中文两个终端键无空格，intro/body 与 about/introduction 保留 NAND WTA，英文图标菜单使用三个句点。

可观察产出：
- 中文终端 tooltip/命令均为“打开 NAND 终端”；英文图标菜单为“Change icon…”。
- 介绍与关于页作者品牌统一 NAMEWTA；中英文均覆盖，许可证/上游 attribution 不动。

## 2. 决策状态

目标行为以 Spec 为准，实施者不重新猜产品范围。没有阻止此票规划的高影响未知。低影响默认：复用现有 host/组件/翻译体系。远程写入、实现 commit 和父分支推进授权是运行门，不能由 ready=true 授予。

## 3. 范围边界

IN：本票列出的完整行为及其回归。REUSE：现有存储、领域端口、原生 Setting 或 Preact、项目测试脚本。OUT：不改命令 id、插件 id、许可证中的上游署名或历史归档。

## 4. 要构建什么

- 中文终端 tooltip/命令均为“打开 NAND 终端”；英文图标菜单为“Change icon…”。
- 介绍与关于页作者品牌统一 NAMEWTA；中英文均覆盖，许可证/上游 attribution 不动。

失败时保留原输入/数据，不给成功提示；重试不重复副作用。与其它票的共享源只由唯一 Lead 在当前票写入。

## 5. 实现契约

入口与修改导航：<Path>src/shared/i18n/terminal-agent.ts</Path>, <Path>src/shared/i18n/nand.ts</Path>, <Path>src/shared/i18n/iconic.ts</Path>, <Path>scripts/verify-issue-regressions.ts</Path>。

输入/输出：由上述用户动作驱动到可观察文本、状态、来源或文件；测试必须穿过真实入口，不仅断言某 helper 被调用。公共 ID/机器标记保持；新代码不得让 view 导入 plugin。语言转换不得更改用户正文。持久化变更先保存后发布，失败不得丢失游标、回执或已存记录。

兼容：读取现有数据；未知或旧字符串原样回退，不用启发式翻译/丢弃。安全：只处理用户明确的目标，不扩大 Vault/会话权限。状态与失败流由 Spec 合同逐项覆盖。

## 6. 执行路线

1. 运行真实 t() 诊断确认命中合并后的值。
2. 只替换目标字典键并对照 intro/about 两种语言；扫描产品来源中的 NAND WTA 残留。
3. 验证快捷键 ID、图标恢复、模块描述和平台命令门保持原状。

## 7. 路径访问契约

- <Path>src/shared/i18n/terminal-agent.ts</Path>
- <Path>src/shared/i18n/nand.ts</Path>
- <Path>src/shared/i18n/iconic.ts</Path>
- <Path>scripts/verify-issue-regressions.ts</Path>
- <Path>main.js</Path>

只可写 frontmatter 中路径。新测试纳入已有 scripts 命令；若需要新增其他路径，先由 Lead 更新范围并重过 DoR。main.js 是构建输出，由 Lead 在当前 Ticket 重建；不得手工编辑。共享源 owner 唯一，严格串行；读到外部 dirty 改动则暂停相交写集。

## 8. 验证矩阵

| 行为/风险 | 接缝与步骤 | 预期 | Evidence |
|---|---|---|---|
| 正常与边界 | AC-001, AC-002：由真实入口驱动，每条行为覆盖中文/英文与必要状态组合 | 全部可观察产出成立 | <Path>{roots.state}/specdev/changes/2026-09-28-issue-32-product-copy/evidence/T-01.md</Path> |
| 已确认失败 | 先原样重跑 diagnosis 红灯，再加本票合同到现有测试；不得启用 PROBE_CONTROL 当成回归绿 | 目标断言先红后绿，非构建错误 | <Path>{roots.state}/specdev/changes/2026-09-28-issue-32-product-copy/evidence/T-01.md</Path> |
| 定向回归 | `pnpm test:issue-regressions`；`pnpm test:iconic-port` | 0 exit，原有数据/生命周期合同不变 | <Path>{roots.state}/specdev/changes/2026-09-28-issue-32-product-copy/evidence/T-01.md</Path> |
| Workspace checks | `pnpm run build`、`pnpm run lint`；结构变化加 `pnpm test:architecture` | 无新增错误、bundle 与源码一致 | <Path>{roots.state}/specdev/changes/2026-09-28-issue-32-product-copy/evidence/T-01.md</Path> |
| E2E | Lead 在 current-workspace 的干净 Obsidian 测试库执行下述步骤 | 宿主实际行为与合同一致 | <Path>{roots.state}/specdev/changes/2026-09-28-issue-32-product-copy/evidence/T-01.md</Path> |

E2E disposition: required。

E2E owner/environment：Lead / current-workspace（未创建 worktree）。场景：按本票每条可观察产出依次操作，zh→en→zh，保存/重启后复验；包含空数据、失效输入，涉及布局则100+记录、800px/窄leaf及默认深浅主题截图；本轮尚未运行。

## 9. 发布、迁移与恢复

没有不可逆数据迁移。旧档案/原生日志/导出保留；新增可选资源仅对之后的操作生效。

观察信号：目标错误、保存失败、重复通知/执行、订阅数/残留进程、用户数据摘要变化。回滚局部源码/产物，保留用户新增数据；已对外发布版本不重写 tag，发修订版本。发布/推送/真实用户数据迁移均需具体动作授权。重复集成失败达到3次则停止该票，保存检查点，不无限尝试。

## 10. 验收标准

- [ ] AC-001：中文终端 tooltip/命令均为“打开 NAND 终端”；英文图标菜单为“Change icon…”。
- [ ] AC-002：介绍与关于页作者品牌统一 NAMEWTA；中英文均覆盖，许可证/上游 attribution 不动。
- [ ] Skill Execution Records 完整记录真实调用、摘要、操作、证据与结果。
- [ ] 路径未越界；所需 E2E 已实际执行。
- [ ] 授权后形成非空 implementation commit，Lead direct-parent 验证通过并记录 result SHA；当前本地计划不是该证据。
- [ ] 所有回归/构建/lint通过，未完成项没有伪标 done；无需要改动时取消该票并注明事实，禁止 empty commit。

## 11. SKILL 调用计划

dev implement：先读架构/领域参考，用其依赖与命名/持久化规则约束实现；verify：执行项目要求的构建、lint及本票定向脚本，写真实命令/exit。view-render implement：操作叶子前读取 runtime，验证 contentEl、window、unmount、host注入与局部样式。

必要 Skill 缺失或 SHA 漂移：block-ticket；不得将“已经阅读”当成执行完成。

## 12. 停止、检查点与交付

用户要求完整分析与计划，未规定固定票数，不能用删合同减票。当前为 plan，不实施。缺 required 接缝/环境、契约偏差、他人写集、源漂移则暂停本票及真实下游；独立票仍可规划。恢复读取 Map/Goal/源HEAD/Skill摘要/最近Evidence，核对未闭合动作再继续。交付所有 AC Evidence 后交回 Goal，不能自动远程评论、关闭或归档。
