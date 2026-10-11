---
schema_version: 6
artifact: "goal-plan"
change: "2026-10-08-terminal-reliability"
status: "completed"
modes: ["high-assurance","release-coordination"]
orchestration: "lead-directed"
lead: "codex-root:nand-open-issues-20261008"
implementation_agent_limit: 1
integration_attempt_limit: 3
ticket_workspace_policy: "current"
integration_gate: "direct-parent"
ready_for_execution: false
---

<!-- ACCEPTANCE-20261011:START -->
2026-10-11 完成与归档记录：[最终验收](evidence/completion.md)。用户确认本轮以 Windows 验收为准，真实账号及其他平台保留未验证记录，不再作为本轮完成阻塞。历史规划与早期审查原文保留；当前状态、授权、提交和验收结论以本补充及正式状态为准。
<!-- ACCEPTANCE-20261011:END -->


# Goal Plan: 终端 helper 可安装性、错误反馈与句柄隔离

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查与修复：[review-index.md](evidence/review-index.md)，覆盖本 change 的 2 票、5 条 AC。下文保留原规划目标与当时基线，不能把“尚未实现／本轮只规划”当成当前代码状态。当前源码与接口以审查证据及 owner 的 `api.ts` 为准；未验证的账号或平台仍未验证，原 AC 没有删减。
<!-- ACTUAL-CODE-REVIEW:END -->

- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/spec.md</Path>
- 控制入口：<Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/tickets-map.md</Path>

## 1. Outcome and Authority

### Outcome

确保新安装真实下载校验后可打开Shell/Agent，并区分未发布资产与网络错误；Unix helper启动时不继承渲染进程无关句柄。

### Success and False Completion

成功为全部AC、数据保持、真实宿主/平台和参考差异验收成立。只存在实现/测试文件、mock通过、票标done或本文档生成都不代表产品完成。无需源码改动的既有能力通过非空验收文档交付或有理由取消；不造空commit。

### Non-goals

- 发布新版本/推送tag/下载旧helper兜底、GPL终端代码、把所有进程fd≥3都关闭

### Authoritative Inputs

用户本轮已明确完整规划、BUG有票、current串行、规划工件中文；本change ADR/CONTEXT→Spec→Ticket拥有局部合同，Goal只拥有调度。原始来源和固定参考见 <Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/source.md</Path> 与 <Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/reference-analysis.md</Path>。生产现状以HEAD 1b9121382363cc50254fbc973c24742b7742edc7源码为准。

## 2. Execution Graph

### DAG and Critical Path

| Ticket | 依赖 | 可观察交付 |
|---|---|---|
| T-01 | ROOT | 全新用户能安装，不能安装时获得准确失败原因。 |
| T-02 | ROOT | helper不再持有Obsidian无关IPC/共享内存，并保持终端会话正常。 |

关键路径由Ticket依赖最长链计算；current每Wave一个Ticket，独立BUG优先；跨change依赖以父Implementation Map为准，不在本地虚构T编号。

### Waves and Ownership

| Wave | Ticket | 前置条件 | 项目写owner | Gate/集成序号 |
|---|---|---|---|---|
| W-01 | T-01 | 依赖Evidence+本票DoR+父资源锁 | 唯一implementation owner；Lead写状态 | G-T-01 |
| W-02 | T-02 | 依赖Evidence+本票DoR+父资源锁 | 唯一implementation owner；Lead写状态 | G-T-02 |

### Ticket Quick Reference

| ID | Workspace | Implementation owner | E2E disposition | Evidence |
|---|---|---|---|---|
| T-01 | current | Lead或动态单writer | required: Lead 在 current-workspace 的一次性测试库验证本票列明的真实宿主路径；不得用构建或stub替代。 | <Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/evidence/T-01.md</Path> |
| T-02 | current | Lead或动态单writer | not-required: 可由真实系统Git/文件系统或子进程集成验证核心行为；需要的宿主观察另列Gate。 | <Path>{roots.state}/specdev/changes/2026-10-08-terminal-reliability/evidence/T-02.md</Path> |

## 3. Gates and Completion Evidence

### Overall Definition of Done

全部AC真实通过、无未处理数据/接口偏差、非空commit进入父分支、域集成与必需host验证完成、用户数量核对。规划阶段全部票仍未执行。

### Gates

| Gate | 开启条件 | 关闭证据 | 阻塞范围 | Owner | 失败恢复 |
|---|---|---|---|---|---|
| G-START | 用户后续要求run；实施提交/集成授权有效 | 真实授权引用、current唯一writer、dirty快照与范围 | 所有实施 | Lead/用户 | 保持plan，不开始代码 |
| G-T-NN | 依赖已通过、Skill摘要一致 | 本票AC+定向检查+适用E2E+commit/result | 本票及消费者 | Lead | 保存失败与检查点，修复不跳过断言 |
| G-DOMAIN | 全部票已验收 | 全部AC、参考能力表、数据/迁移、跨窗/重启与支持矩阵 | change完成 | Lead | 回失败AC拥有票，保留已有效证据 |

### Contract and Reference Coverage

完整覆盖由Map逐AC负责票矩阵拥有；固定参考中每条差异必须有理由与验收，不能以表格存在宣称功能一致。

## 4. Execution and Integration Protocol

### Lead Orchestration

Lead唯一：codex-root:nand-open-issues-20261008。implementation subagents=1（低于config的3，Lead不计入）；integration attempts=3。Read-only agents不另设SpecDev上限，遵守宿主slots且不竞争同一可变宿主。Dispatch=execution-time dynamic，不静态选模型。

subagent-delivery调用operation=plan：允许implementation/review/research/test-observation；Lead保留状态、父分支、E2E；未来dispatch必须附真实base、票、Skill、授权、路径、环境、停止条件，implementation只交候选commit/日志；Lead独立验收。当前未派任何实现票。

### Ticket Workspace and Integration

| Ticket | Parent/base | Workspace | Source checks | Implementation commit | Integration checks/E2E | Parent result |
|---|---|---|---|---|---|---|
| T-01 | main@1b9121382363cc50254fbc973c24742b7742edc7（run重核） | current | 本票验证矩阵 | 后续授权后非空commit | Lead direct-parent及required E2E | 通过后记录result SHA |
| T-02 | main@1b9121382363cc50254fbc973c24742b7742edc7（run重核） | current | 本票验证矩阵 | 后续授权后非空commit | Lead direct-parent及required E2E | 通过后记录result SHA |

current严格串行，无source/candidate worktree。实现前冻结dirty路径，保留用户speculo改动；每票仅按路径stage，不得git add -A全仓。形成授权的实现commit后在同一current workspace验证，HEAD漂移则重核；用户原改动未提交不能被纳入本票。

### Authorization Matrix

| 动作 | 状态 | 条件 |
|---|---|---|
| 规划工件写入/只读源码与测试 | authorized | 本轮明确请求 |
| Current workspace Ticket changes | not-authorized | 本轮只规划 |
| Implementation commit | not-authorized | 后续run需明确提交授权 |
| Local direct-parent verification and parent update | not-authorized | 后续run核验 |
| Push / PR / remote merge / release | not-authorized | 独立动作授权 |
| Branch/worktree cleanup / production migration | not-authorized | 不可由本计划自授权 |

### Evidence Return

实施者返回commit、dirty、实际路径、命令环境、结果、未测项；Lead重读而非采信自报，并写每票Skill Execution Records、AC映射、direct-parent/result及真实E2E。

## 5. Constraints, Risk and Recovery

### Non-negotiable Constraints

遵循dev/ui所有硬规则；保留用户内容、数据格式与模块边界；不造第二状态/设置/路由/调度器；不复制禁止许可代码。source为固定输入，后续漂移另建snapshot，不能覆盖。

### Verification Integrity

功能优先，最短有判别力验证，不为低影响布局堆镜像单测；关键算法/协议/数据改动仍需稳定seam验证。build不等于UI通过，真实AI账号不等于模拟输出，CLI退出不等于任务业务完成。

### Migration or Release Sequence

每票恢复说明为本地权威；改变格式时Expand→Migrate→Observe→Contract，收缩需旧调用/数据归零证据。版本资产一致性检查不授权发版。

### Risks, Monitoring and Recovery

- 真实下载验收不能设置NAND_PTY_BINARY，否则掩盖#135。
- 仅设CLOEXEC不能移除helper自己持有的资源，不能当作#143完整修复。

单票失败保留源/commit/日志；重复同一失败或3次集成失败先由Lead复盘四项：模式、原因、新动作、新owner，再考虑重派。不得用删测试、静默fallback或清空数据制造绿色。

### Deviation Control

公共合同、安全、范围、迁移与验收变化返回G/S/T；仅局部可逆实现按票内约定自行决定。共享资源冲突暂停闭包，不接管他人工作。

## 6. Progress and Decisions

### Current Status

规划完成待执行；0张实施完成，未创建执行Evidence。配置/路径/源码已读，基线测试见总验证报告；本Goal不是用户授权本身。

### Pending Decisions and Blockers

产品设计以已确认Spec为准；执行门未开：未授权实施/commit/父分支推进。需要真实AI账号或宿主的票在run时检查环境；不能用计划文本声称已有这些条件。

### Resume Protocol

先从Map做只读ticket-control，重读父Map/Plan、当前票、依赖Evidence、Skill摘要、HEAD/dirty和授权。仅补失效/缺失证据，不重做已完成副作用。

## Assumptions

只有文件细化等可逆实现假设；有高影响新事实时ready_for_execution必须为 `false` 并返回owner。本轮明确不执行。

## 整体父 Goal 约束

本change属于 <Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/implementation-map.md</Path>，调度权威为 <Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/implementation-plan.md</Path>。单独恢复本change也必须读取父图真实跨域边、Gate和全局current单writer策略；本地ready不解除父执行门。
