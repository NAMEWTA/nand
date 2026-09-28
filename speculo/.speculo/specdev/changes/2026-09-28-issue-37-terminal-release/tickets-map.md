---
schema_version: 3
plan_contract_version: 1
plan_revision: 2
requested_deliverables: []
deliverable_policy: "用户要求完整覆盖所有确认问题，未指定固定数量；本 Map 枚举全部切片，不以票数替代验收"
artifact: "tickets-map"
change: "2026-09-28-issue-37-terminal-release"
status: "in_progress"
---

# Tickets Map: #37 发布与插件匹配的终端服务

## 1. 目标与拆分策略

Spec <Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/spec.md</Path>，诊断 <Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/diagnosis.md</Path>；全部 1 张票覆盖 2 条合同。按完整用户行为切片，不按技术层分工。保留已修行为作为回归，不重复造功能。

### 总体实施背景

公开最新 Release 仍为 0.0.1，二进制路由仅识别 pty；当前客户端会发 agent_data，旧服务将其解析失败投影为 pty/PARSE_ERROR。并行 PTY 初始化会遇到非自身模块的错误；当前源码服务能够返回对应 requestId 的历史结果。manifest 仍 0.0.1，版本相等检测不能选择尚未发布的新服务。

边界：遵循源 issue 最终决定：不加旧服务兼容/版本协商。此次不发布 release，不关闭 issue。原报告完整首次打开 UI 和孤儿 shell 未在本轮 Obsidian 实测。 代码基线 `09aade655241fff439d3147a55ec1448a4f93eea`；上下文术语从永久 context 读取，永久 ADR 只读。

### 项目 Skill 读取矩阵

| Applies To | Project Skill | Trigger / Scope | Read Timing | Purpose |
|---|---|---|---|---|
| ALL | <Path>.agents/skills/dev/SKILL.md</Path> | NAND源码、原生设置、数据/构建与测试 | Map后Ticket前，按匹配参考展开 | 边界、身份与验证 |


## 2. 执行清单

| ID | Ticket | 可观察产出 | Blocked By | Depth | Risk | Ready | Owner | Contract IDs | Wave/Gate | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| T-01 | <Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/ticket/01-plan.md</Path> | 准备并发布同提交配套终端服务资产 | — | deep | high | yes | codex-issue-planning | AC-001, AC-002 | G1/G2/G3 | in_progress |

frontmatter 是 Ticket 状态权威；本表只作投影。

## 3. 依赖 DAG

- T-01：无语义依赖

真实依赖：#36 后续呈现复用前票已统一的错误/日期/状态解释与测试基线；开关在只读历史界面和错误呈现就绪后实施。#41 会话/布局复用历史状态呈现的稳定组件基线。其余独立票只因 current 唯一写者串行，不制造语义边。

## 4. 合同覆盖矩阵

| Contract ID | 覆盖 Ticket | 验证接缝 | 状态 | 说明 |
|---|---|---|---|---|
| AC-001 | T-01 | 对应 Ticket 行为验证矩阵 | covered | 实施证据尚未产生 |
| AC-002 | T-01 | 对应 Ticket 行为验证矩阵 | covered | 实施证据尚未产生 |

## 5. 并行与路径所有权

用户选择 current，所有 change 全局只允许一个当前票写者，本轮不派 agent。共同 main.js、样式/翻译及测试脚本由唯一 Lead codex-issue-planning 在当前票中修改，检查点后才交接；不能把不同目录当作可并行证据。

共享路径：无。明确串行顺序为本表从上至下；独立票可以经 Lead 重审调整，不能并行。跨 issue 共享入口/翻译合入后必须重验后续票摘要，避免旧计划覆盖新代码。

## 6. Gate、Wave 与集成点

G0=授权/基线/环境，G1=精确红灯与正确范围，G2=当前票回归/build/lint及direct-parent，G3=本change整体验收。权威编排为 <Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/goal-plan.md</Path>。

## 7. 横切契约与风险

固定 view type、只读原生日志、档案 Markdown 真相、设备游标和通知回执不变。新增自动化开关只由 #36/T-05 拥有；#38错误/可用性与#39导航各有唯一行为owner。旧截图不充当本轮 E2E。

## 8. 同步规则

Ticket变更回写此投影；合同/路径变化递增 plan_revision 并重过 validator；Skill变化先复核摘要。不存在实现 Evidence 时不填通过。新公共合同必须回到 Spec owner。

## 9. 总控与恢复

运行 `node speculo/workflows/specdev/common/tools/ticket-control.mjs --map speculo/.speculo/specdev/changes/2026-09-28-issue-37-terminal-release/tickets-map.md --repo .` 只读检查。下一 Work：<Path>{roots.workflows}/specdev/P-goal-plan/P-goal-plan.md</Path> plan，未来获准 run 才转 <Path>{roots.workflows}/specdev/I-implement/I-implement.md</Path>。本 Map 的 requested_deliverables=[] 表示用户未定数量，不表示无交付。

实施 revision=2：#37/T-01 扩展发布校验脚本、技能 release 参考及 README 写集，见票内实施复核。
