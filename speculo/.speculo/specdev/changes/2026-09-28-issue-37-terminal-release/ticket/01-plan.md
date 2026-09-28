---
schema_version: 3
plan_contract_version: 1
skill_scan: "已枚举 .agents/skills；dev 匹配产品/测试，view-render 仅匹配叶子表面；SpecDev 技能不伪装为项目技能"
skill_bindings: [{"id": "dev", "path": "<Path>.agents/skills/dev/SKILL.md</Path>", "sha256": "f9da74f9f81825387ff53292e09b7d032b2696cd33a9586a3e736044299be7e7", "phase": "implement", "operation": "apply-nand-contract", "inputs": ["当前 Map、Ticket、基线 diff 与匹配参考"], "outputs": ["符合边界的修改和逐合同验证 Evidence"], "required": true, "on_failure": "block-ticket"}, {"id": "dev", "path": "<Path>.agents/skills/dev/SKILL.md</Path>", "sha256": "f9da74f9f81825387ff53292e09b7d032b2696cd33a9586a3e736044299be7e7", "phase": "verify", "operation": "run-required-checks", "inputs": ["当前 Map、Ticket、基线 diff 与匹配参考"], "outputs": ["符合边界的修改和逐合同验证 Evidence"], "required": true, "on_failure": "block-ticket"}]
resource_claims: ["current-workspace:exclusive-writer", "generated-main-js:Lead-only", "source-domain:issue-37"]
artifact: "ticket"
change: "2026-09-28-issue-37-terminal-release"
id: "T-01"
title: "准备并发布同提交配套终端服务资产"
status: "blocked"
kind: "operations"
planning_depth: "deep"
planning_depth_reason: "跨持久化/生命周期或发布边界，要求恢复和集成门"
ready: false
risk: "high"
blocked_by: []
contract_ids: ["AC-001", "AC-002"]
owner: "codex-issue-planning"
expected_changes: ["<Path>scripts/verify-release-artifacts.mjs</Path>", "<Path>.agents/skills/dev/references/build-and-release.md</Path>", "<Path>README.md</Path>", "<Path>manifest.json</Path>", "<Path>package.json</Path>", "<Path>versions.json</Path>", "<Path>CHANGELOG.md</Path>", "<Path>.github/workflows/release.yml</Path>", "<Path>scripts/verify-pty-automation.mjs</Path>", "<Path>src/platform/terminal-server/binary-downloader.test.ts</Path>"]
writable_paths: ["<Path>scripts/verify-release-artifacts.mjs</Path>", "<Path>.agents/skills/dev/references/build-and-release.md</Path>", "<Path>README.md</Path>", "<Path>manifest.json</Path>", "<Path>package.json</Path>", "<Path>versions.json</Path>", "<Path>CHANGELOG.md</Path>", "<Path>.github/workflows/release.yml</Path>", "<Path>scripts/verify-pty-automation.mjs</Path>", "<Path>src/platform/terminal-server/binary-downloader.test.ts</Path>", "<Path>main.js</Path>"]
read_only_paths: ["<Path>src/platform/terminal-server/binary-downloader.ts</Path>", "<Path>src/platform/terminal-server/binary-download-urls.ts</Path>", "<Path>src/platform/terminal-server/server-manager.ts</Path>", "<Path>src/platform/terminal-server/pty-client.ts</Path>", "<Path>processes/rust-terminal-servers/src/router.rs</Path>"]
shared_paths: ["<Path>manifest.json</Path>", "<Path>package.json</Path>", "<Path>versions.json</Path>", "<Path>main.js</Path>"]
shared_path_owners: ["<Path>manifest.json</Path> => codex-issue-planning (唯一 Lead，按 current Ticket 串行修改)", "<Path>package.json</Path> => codex-issue-planning (唯一 Lead，按 current Ticket 串行修改)", "<Path>versions.json</Path> => codex-issue-planning (唯一 Lead，按 current Ticket 串行修改)", "<Path>main.js</Path> => codex-issue-planning (唯一 Lead，按 current Ticket 串行修改)"]
---

# Ticket T-01: 准备并发布同提交配套终端服务资产

- Map：<Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/spec.md</Path>
- Diagnosis：<Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/diagnosis.md</Path>
- Evidence（未来实现产物，不是已存在的通过证明）：<Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/evidence/T-01.md</Path>

启动顺序：完整 Map → 适用项目 Skill 入口及其命中参考 → 本 Ticket → 当前上游证据。矩阵为最低集合，不是 allowlist；技能摘要漂移先由 Lead 复核绑定再继续。

## 1. 战略与来源

来源：GitHub #37 最新冻结正文/评论、Diagnosis 真实红灯与 CODE；合同 AC-001, AC-002。

当前事实：公开最新 Release 仍为 0.0.1，二进制路由仅识别 pty；当前客户端会发 agent_data，旧服务将其解析失败投影为 pty/PARSE_ERROR。并行 PTY 初始化会遇到非自身模块的错误；当前源码服务能够返回对应 requestId 的历史结果。manifest 仍 0.0.1，版本相等检测不能选择尚未发布的新服务。

可观察产出：
- 新版本插件默认下载同一 tag 的配套服务，五个平台二进制及摘要齐全；从旧插件升级能因版本变化选择新服务。
- 新 Release 默认安装首次终端成功、历史/用量/导出/恢复可用，关闭后无孤儿进程，控制台无 agent_data 解析错误。

## 2. 决策状态

目标行为以 Spec 为准，实施者不重新猜产品范围。没有阻止此票规划的高影响未知。低影响默认：复用现有 host/组件/翻译体系。远程写入、实现 commit 和父分支推进授权是运行门，不能由 ready=true 授予。

## 3. 范围边界

IN：本票列出的完整行为及其回归。REUSE：现有存储、领域端口、原生 Setting 或 Preact、项目测试脚本。OUT：遵循源 issue 最终决定：不加旧服务兼容/版本协商。此次不发布 release，不关闭 issue。原报告完整首次打开 UI 和孤儿 shell 未在本轮 Obsidian 实测。

## 4. 要构建什么

- 新版本插件默认下载同一 tag 的配套服务，五个平台二进制及摘要齐全；从旧插件升级能因版本变化选择新服务。
- 新 Release 默认安装首次终端成功、历史/用量/导出/恢复可用，关闭后无孤儿进程，控制台无 agent_data 解析错误。

失败时保留原输入/数据，不给成功提示；重试不重复副作用。与其它票的共享源只由唯一 Lead 在当前票写入。

## 5. 实现契约

入口与修改导航：<Path>manifest.json</Path>, <Path>package.json</Path>, <Path>versions.json</Path>, <Path>CHANGELOG.md</Path>。

输入/输出：由上述用户动作驱动到可观察文本、状态、来源或文件；测试必须穿过真实入口，不仅断言某 helper 被调用。公共 ID/机器标记保持；新代码不得让 view 导入 plugin。语言转换不得更改用户正文。持久化变更先保存后发布，失败不得丢失游标、回执或已存记录。

兼容：读取现有数据；未知或旧字符串原样回退，不用启发式翻译/丢弃。安全：只处理用户明确的目标，不扩大 Vault/会话权限。状态与失败流由 Spec 合同逐项覆盖。

## 6. 执行路线

1. 读取项目 release 合同，固定发布候选提交；新版本取当前未使用的下一个 patch（当前候选0.0.2，实施前复核 remote tags），同时准备版本表和发行说明。
2. 以同 tag 构建五平台服务/摘要及插件包；Linux 用真实 WS scan/query/read/PTY/退出测试，校验下载 URL 与已安装版本比较。
3. 本地准备完成后生成具体 release dry-run 目标/资产/摘要表；只有该次发布授权到位才推 tag/发布，失败不覆盖已发布 tag。
4. 从新公开 Release 重下而非复制 target binary，干净库完成首次打开、重启、启停与进程数检查；记录五平台 CI 和实际测试范围。

## 7. 路径访问契约

- <Path>manifest.json</Path>
- <Path>package.json</Path>
- <Path>versions.json</Path>
- <Path>CHANGELOG.md</Path>
- <Path>.github/workflows/release.yml</Path>
- <Path>scripts/verify-pty-automation.mjs</Path>
- <Path>src/platform/terminal-server/binary-downloader.test.ts</Path>
- <Path>main.js</Path>

只可写 frontmatter 中路径。新测试纳入已有 scripts 命令；若需要新增其他路径，先由 Lead 更新范围并重过 DoR。main.js 是构建输出，由 Lead 在当前 Ticket 重建；不得手工编辑。共享源 owner 唯一，严格串行；读到外部 dirty 改动则暂停相交写集。

## 8. 验证矩阵

| 行为/风险 | 接缝与步骤 | 预期 | Evidence |
|---|---|---|---|
| 正常与边界 | AC-001, AC-002：由真实入口驱动，每条行为覆盖中文/英文与必要状态组合 | 全部可观察产出成立 | <Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/evidence/T-01.md</Path> |
| 已确认失败 | 先原样重跑 diagnosis 红灯，再加本票合同到现有测试；不得启用 PROBE_CONTROL 当成回归绿 | 目标断言先红后绿，非构建错误 | <Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/evidence/T-01.md</Path> |
| 定向回归 | `cargo test --manifest-path processes/rust-terminal-servers/Cargo.toml`；`node scripts/verify-pty-automation.mjs`；`pnpm test:terminal-agent` | 0 exit，原有数据/生命周期合同不变 | <Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/evidence/T-01.md</Path> |
| Workspace checks | `pnpm run build`、`pnpm run lint`；结构变化加 `pnpm test:architecture` | 无新增错误、bundle 与源码一致 | <Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/evidence/T-01.md</Path> |
| E2E | Lead 在 current-workspace 的干净 Obsidian 测试库执行下述步骤 | 宿主实际行为与合同一致 | <Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/evidence/T-01.md</Path> |

E2E disposition: required。

E2E owner/environment：Lead / current-workspace（未创建 worktree）。场景：新 Release 默认下载→首次打开终端→查询历史/用量→导出/恢复→重启/启停→核对进程清理；五平台资产完整性另验。

## 9. 发布、迁移与恢复

Expand：新增可选字段/开关并保留旧数据读取；Migrate：只在正常保存或新生成时使用新格式，不批量改写；Contract：本轮不删除旧字符串/旧数据支持。发布票遵守同 tag 五平台资产及公开下载验证，旧服务不在支持范围。

观察信号：目标错误、保存失败、重复通知/执行、订阅数/残留进程、用户数据摘要变化。回滚局部源码/产物，保留用户新增数据；已对外发布版本不重写 tag，发修订版本。发布/推送/真实用户数据迁移均需具体动作授权。重复集成失败达到3次则停止该票，保存检查点，不无限尝试。

## 10. 验收标准

- [ ] AC-001：新版本插件默认下载同一 tag 的配套服务，五个平台二进制及摘要齐全；从旧插件升级能因版本变化选择新服务。
- [ ] AC-002：新 Release 默认安装首次终端成功、历史/用量/导出/恢复可用，关闭后无孤儿进程，控制台无 agent_data 解析错误。
- [ ] Skill Execution Records 完整记录真实调用、摘要、操作、证据与结果。
- [ ] 路径未越界；所需 E2E 已实际执行。
- [ ] 授权后形成非空 implementation commit，Lead direct-parent 验证通过并记录 result SHA；当前本地计划不是该证据。
- [ ] 所有回归/构建/lint通过，未完成项没有伪标 done；无需要改动时取消该票并注明事实，禁止 empty commit。

## 11. SKILL 调用计划

dev implement：先读架构/领域参考，用其依赖与命名/持久化规则约束实现；verify：执行项目要求的构建、lint及本票定向脚本，写真实命令/exit。view-render 不适用：该票不实现叶子表面。

必要 Skill 缺失或 SHA 漂移：block-ticket；不得将“已经阅读”当成执行完成。

## 12. 停止、检查点与交付

用户要求完整分析与计划，未规定固定票数，不能用删合同减票。当前为 plan，不实施。缺 required 接缝/环境、契约偏差、他人写集、源漂移则暂停本票及真实下游；独立票仍可规划。恢复读取 Map/Goal/源HEAD/Skill摘要/最近Evidence，核对未闭合动作再继续。交付所有 AC Evidence 后交回 Goal，不能自动远程评论、关闭或归档。

## 实施入口复核（2026-09-28）

用户已明确要求完整实施，总控原 plan-only 文字是历史授权快照。当前允许本地实现、验证及所需 implementation commit；公开发布仍待具体候选准备完毕。Lead 增补 release 校验脚本、release 规则所属技能参考及 README 路径，用于验证五平台资产、版本/标签一致性与用户升级说明；其余合同不变。技能入口 SHA256 与绑定相符，工作区初始仅规划文件 dirty。

本地实现和验证已通过；剩余 blocker 是五平台 CI、具体公开发布及公开下载 Obsidian E2E。不是实现失败，不阻止独立票继续。见 evidence/T-01.md。
