---
schema_version: 6
artifact: "goal-plan"
change: "2026-09-28-issue-37-terminal-release"
status: "draft"
modes: ["high-assurance", "release-coordination"]
orchestration: "lead-directed"
lead: "codex-issue-planning"
implementation_agent_limit: 1
integration_attempt_limit: 3
ticket_workspace_policy: "current"
integration_gate: "direct-parent"
ready_for_execution: false
---

# Goal Plan: #37 发布与插件匹配的终端服务

## 1. Outcome and Authority

Outcome：发布与插件匹配的终端服务 的全部 Spec 合同已通过真实行为验收，保留旧正确行为与数据。规划完成不是修复完成；绿色基线/局部探针/票全done都不能替代整体验收。

权威：用户最新决定 → 本 Spec → Ticket → 当前源码与诊断。来源 <Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/source.md</Path>，Spec <Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/spec.md</Path>，总控 <Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/tickets-map.md</Path>。永久知识只读。

## 2. Execution Graph

执行顺序：T-01（current 串行序列；语义依赖以票 frontmatter 为准）。每张票从前一已验收的当前父基线启动，实际 parent/base SHA 在实施时记录。

| Wave | Ticket | 前置条件 | Workspace | Implementation owner | Evidence |
|---|---|---|---|---|---|
| 1 | T-01 | G0；无语义前置 | current | codex-issue-planning | <Path>{roots.state}/specdev/changes/2026-09-28-issue-37-terminal-release/evidence/T-01.md</Path> |

跨change顺序建议由全量核查索引说明，仅用于用户选择下一项；本 Goal 不占用其它 change，不伪造父 Implementation Map 或复制其它状态。

## 3. Gates and Completion Evidence

| Gate | 开启条件 | 关闭证据 | 失败影响与恢复 |
|---|---|---|---|
| G0 | 用户授权实施、必要提交/推进；重读HEAD与Skill；E2E环境可用 | 真实授权记录、dirty归属、baseline | 尚未满足，当前仅plan；不派单 |
| G1 | 当前票实际症状/新增合同红灯 | 当前基线命令/输出，确认不是夹具错误 | 与历史冲突返回Diagnosis/Spec，保留日志 |
| G2 | 本票行为、定向测试、build/lint及必要架构检查完成 | 非空implementation commit、Lead direct-parent结果、Ticket Evidence、真实E2E | 不启动下一写者；保存失败，最多3次集成尝试 |
| G3 | 全部合同覆盖、旧行为回归、数据完整性与宿主验收 | 整体Evidence、所有result SHA、未验证项为零或用户明确豁免 | 不宣布completed，不关闭来源issue |

发布 Gate：五平台同提交资产和摘要→具体dry-run→单独发布授权→公开默认下载验收；本地构建通过不能关闭此Gate。

## 4. Execution and Integration Protocol

Lead 固定 codex-issue-planning，用户选定 current/direct-parent。config上限3个implementation agents、3次integration；本计划降为1个实现writer，当前不委派。一次只实施一张票；main.js与公共文件由Lead拥有；同一父分支串行验收。

基线：branch `main`，HEAD `09aade655241fff439d3147a55ec1448a4f93eea`，规划开始clean；本轮仅本地诊断/计划工件改动。运行前重新核对；不得覆盖他人dirty状态或借历史授权提交。

| 动作 | 状态 | 条件 |
|---|---|---|
| 本地摄入/诊断/计划 | allowed | 用户本次明确请求 |
| 当前工作区Ticket实现 | not-authorized | 用户未来明确run |
| implementation commit / direct-parent推进 | not-authorized | 运行入口核对具体授权 |
| 独立worktree/candidate | not-applicable | 用户选current |
| push / PR / merge / release / Issue评论关闭 | not-authorized | 按对应网关展示具体目标再授权 |
| 归档/永久ADR修改/数据迁移 | not-authorized | 不从规划继承 |

形成实现提交后Lead执行当前workspace集成及E2E，记录parent-before和result SHA，下一票仅在通过后开始。已失败提交不强制重置用户分支；停止推进/追加纠正提交按授权恢复。每票Evidence记录Skill Execution Records；实际结果不能只来自自报。

## 5. Constraints, Risk and Recovery

不变量：遵循源 issue 最终决定：不加旧服务兼容/版本协商。此次不发布 release，不关闭 issue。原报告完整首次打开 UI 和孤儿 shell 未在本轮 Obsidian 实测。 不采用诊断control变体作为产品补丁或判卷标准。真实UI/E2E未运行就不能写passed。持久化类变更保留旧字段读取，先新增再使用；不删原数据。发布版不覆盖tag，必要时前向修订。

HEAD/输入/Skill摘要漂移：暂停相交分支，返回对应owner修订计划；重新建立红灯和验收证据。共享路径/其它任务冲突不能接管。重复失败达到上限保留具体blocker并停止，不以重跑凑通过。

## 6. Progress and Decisions

规划产物：Spec、1张ready票、Map、draft Goal；0张实施done，0个implementation commit，0个远程写操作。ready_for_execution=false，因为此次任务只授权分析和规划。

恢复：读取此Goal→Map→Ticket frontmatter→真实Skill→最新证据/Git，核对授权及环境后才能进I。全部实现完成后按 change-completion，来源回写独立走T-triage，不自动关闭或归档。

## Assumptions

仅可逆实现细节留给实施者；用户已确定“当前工作区，票据严格串行”。

## Parent orchestration

本change现在归属 <Path>{roots.state}/specdev/changes/2026-09-28-open-issues-remediation-goal/implementation-plan.md</Path>；该父Plan拥有跨change串行、共享资源和全局执行边界；本Goal只保留子合同Gate，策略相同不冲突。请从父 <Path>{roots.state}/specdev/changes/2026-09-28-open-issues-remediation-goal/tickets-map.md</Path> 恢复，不独立抢占writer。
