---
schema_version: 6
artifact: "goal-plan"
change: "2026-10-08-browser-ai-workbench"
status: "draft"
modes: ["reference-conformance","high-assurance","migration"]
orchestration: "lead-directed"
lead: "codex-root:nand-open-issues-20261008"
implementation_agent_limit: 1
integration_attempt_limit: 3
ticket_workspace_policy: "current"
integration_gate: "direct-parent"
ready_for_execution: false
---

# Goal Plan: 浏览器快捷键修复与多 AI 工作台、受限网页助手

- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/spec.md</Path>
- 控制入口：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path>

## 1. Outcome and Authority

### Outcome

先独立修复 #142 浏览器地址栏快捷键，再在现有 Obsidian 浏览器内交付真实可用的 DeepSeek/Kimi/ChatGPT 三站 PoC，以真实宿主证据为后续 Gate，逐站补齐八站、可靠保存迁移、可选综合、受限网页助手、用户指认与复用流程、本地 scoped 外接。用户已确认完整阶段范围、三站、共享默认加可选隔离 profile、当前轮 Markdown 与模板快照/来源、maiw v3 迁移、确定发送不引额外 LLM、综合/助手 opt-in 与本地 token bridge；本轮只规划，所有实现 ticket 保留未执行，current 严格串行。

### Success and False Completion

成功为全部AC、数据保持、真实宿主/平台和参考差异验收成立。只存在实现/测试文件、mock通过、票标done或本文档生成都不代表产品完成。无需源码改动的既有能力通过非空验收文档交付或有理由取消；不造空commit。

### Non-goals

- 不实现完整日常浏览器、Chromium fork、独立云浏览器集群或企业跨环境 Grid；其参考仅记录取舍。
- 不统一附件上传、模型切换、thinking 开关；站点显示不可靠的模型元数据记 unknown。
- 不镜像全部官网历史/所有分支/附件，不导出 cookie/secret，不保证一键迁移 Chrome 登录、Google SSO 或 OS passkey。
- 不把多模型一致当真实性验证；不自动投票，不用视觉/LLM 做固定发送的无界兜底。
- 不默认开放远程端口、无人值守支付/发布/删除，不把 WebMCP early preview 当八站现有能力。

### Authoritative Inputs

用户本轮已明确完整规划、BUG有票、current串行、规划工件中文；本change ADR/CONTEXT→Spec→Ticket拥有局部合同，Goal只拥有调度。原始来源和固定参考见 <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/source.md</Path> 与 <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/reference-analysis.md</Path>。生产现状以HEAD 1b9121382363cc50254fbc973c24742b7742edc7源码为准。

## 2. Execution Graph

### DAG and Critical Path

| Ticket | 依赖 | 可观察交付 |
|---|---|---|
| T-01 | ROOT | #142独立第一票；真实宿主地址栏按F立即输入查找、L选中地址，guest/笔记无回归。 |
| T-02 | ROOT | 用户可保持旧登录并新增同站隔离账号；后续工作台可显式读/控某page而不抢前台或控制错页。 |
| T-03 | T-02 | 第一条真实可交付闭环：新task→DeepSeek真实新会话→输入预览→持久intent→发送确认→当前轮Markdown结果。 |
| T-04 | T-03 | Kimi在既有任务/模板快照/持久intent/结果UI中完成真实发送与当前轮采集，作为三站PoC之一。 |
| T-05 | T-03 | ChatGPT在既有任务/模板快照/持久intent/结果UI中完成真实发送与当前轮采集，作为三站PoC之一。 |
| T-06 | T-03, T-04, T-05 | 用户对DeepSeek/Kimi/ChatGPT一次统一发送并看独立结果；gate由这套生产路径真实运行证明，后续八站票依赖其通过。 |
| T-07 | T-06 | 同轮2–3答案可读比较、复制与单站追问，采集来源/完整性透明，迟到旧答案不会覆盖。 |
| T-08 | T-07 | 进程/guest退出、保存失败后可恢复事实和答案，无隐式重问；人工接管后可安全继续。 |
| T-09 | T-06 | Claude成为完整工作台目标，使用同一profile/turn/模板/结果/恢复契约，实际证明后加入支持表。 |
| T-10 | T-06 | 通义千问成为完整工作台目标，使用同一profile/turn/模板/结果/恢复契约，实际证明后加入支持表。 |
| T-11 | T-06 | 豆包成为完整工作台目标，使用同一profile/turn/模板/结果/恢复契约，实际证明后加入支持表。 |
| T-12 | T-06 | Coze成为完整工作台目标，使用同一profile/turn/模板/结果/恢复契约，实际证明后加入支持表。 |
| T-13 | T-06 | MiniMax成为完整工作台目标，使用同一profile/turn/模板/结果/恢复契约，实际证明后加入支持表。 |
| T-14 | T-08 | 用户管理并复用问题模板，搜索/整理历史，明确范围导出并从MAIW v3可靠迁移。 |
| T-15 | T-07 | 用户明确选择答案/版本与既有agent会话后得到独立综合文档，普通官网统一发送仍零额外模型调用。 |
| T-16 | T-08 | 用户在指定page/profile/task范围让已有agent辅助完成网页步骤，看到结果证据并可随时同页接管。 |
| T-17 | T-07, T-15 | 用户可指认回答片段加入比较或解释区域，并把验证过的composer/submit/answer规则保存为明确override。 |
| T-18 | T-16 | 用户把已验证的步骤保存成带变量的流程并手动运行/取消，看到每步前后条件和最终结果。 |
| T-19 | T-18 | 在现有automations页面选浏览器流程、运行/可选调度，并用同一receipt查看取消/结果。 |
| T-20 | T-16 | 外部agent在明确opt-in后获得短期page/profile/task/action有限权限，通过已有本地IPC操作同一guest并能撤回。 |
| T-21 | T-01, T-09, T-10, T-11, T-12, T-13, T-14, T-17, T-19, T-20 | 在已逐票功能完成基础上收束公开支持表、真实宿主使用指南、来源许可与产物一致性；不以这票替代前面真实验收。 |

关键路径由Ticket依赖最长链计算；current每Wave一个Ticket，独立BUG优先；跨change依赖以父Implementation Map为准，不在本地虚构T编号。

### Waves and Ownership

| Wave | Ticket | 前置条件 | 项目写owner | Gate/集成序号 |
|---|---|---|---|---|
| W-01 | T-01 | 依赖Evidence+本票DoR+父资源锁 | 唯一implementation owner；Lead写状态 | G-T-01 |
| W-02 | T-02 | 依赖Evidence+本票DoR+父资源锁 | 唯一implementation owner；Lead写状态 | G-T-02 |
| W-03 | T-03 | 依赖Evidence+本票DoR+父资源锁 | 唯一implementation owner；Lead写状态 | G-T-03 |
| W-04 | T-04 | 依赖Evidence+本票DoR+父资源锁 | 唯一implementation owner；Lead写状态 | G-T-04 |
| W-05 | T-05 | 依赖Evidence+本票DoR+父资源锁 | 唯一implementation owner；Lead写状态 | G-T-05 |
| W-06 | T-06 | 依赖Evidence+本票DoR+父资源锁 | 唯一implementation owner；Lead写状态 | G-T-06 |
| W-07 | T-07 | 依赖Evidence+本票DoR+父资源锁 | 唯一implementation owner；Lead写状态 | G-T-07 |
| W-08 | T-08 | 依赖Evidence+本票DoR+父资源锁 | 唯一implementation owner；Lead写状态 | G-T-08 |
| W-09 | T-09 | 依赖Evidence+本票DoR+父资源锁 | 唯一implementation owner；Lead写状态 | G-T-09 |
| W-10 | T-10 | 依赖Evidence+本票DoR+父资源锁 | 唯一implementation owner；Lead写状态 | G-T-10 |
| W-11 | T-11 | 依赖Evidence+本票DoR+父资源锁 | 唯一implementation owner；Lead写状态 | G-T-11 |
| W-12 | T-12 | 依赖Evidence+本票DoR+父资源锁 | 唯一implementation owner；Lead写状态 | G-T-12 |
| W-13 | T-13 | 依赖Evidence+本票DoR+父资源锁 | 唯一implementation owner；Lead写状态 | G-T-13 |
| W-14 | T-14 | 依赖Evidence+本票DoR+父资源锁 | 唯一implementation owner；Lead写状态 | G-T-14 |
| W-15 | T-15 | 依赖Evidence+本票DoR+父资源锁 | 唯一implementation owner；Lead写状态 | G-T-15 |
| W-16 | T-16 | 依赖Evidence+本票DoR+父资源锁 | 唯一implementation owner；Lead写状态 | G-T-16 |
| W-17 | T-17 | 依赖Evidence+本票DoR+父资源锁 | 唯一implementation owner；Lead写状态 | G-T-17 |
| W-18 | T-18 | 依赖Evidence+本票DoR+父资源锁 | 唯一implementation owner；Lead写状态 | G-T-18 |
| W-19 | T-19 | 依赖Evidence+本票DoR+父资源锁 | 唯一implementation owner；Lead写状态 | G-T-19 |
| W-20 | T-20 | 依赖Evidence+本票DoR+父资源锁 | 唯一implementation owner；Lead写状态 | G-T-20 |
| W-21 | T-21 | 依赖Evidence+本票DoR+父资源锁 | 唯一implementation owner；Lead写状态 | G-T-21 |

### Ticket Quick Reference

| ID | Workspace | Implementation owner | E2E disposition | Evidence |
|---|---|---|---|---|
| T-01 | current | Lead或动态单writer | required: native hotkey事件必须真实Obsidian证明，DOM单测不足。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-01.md</Path> |
| T-02 | current | Lead或动态单writer | required: partition/SSO/guest focus是宿主行为。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-02.md</Path> |
| T-03 | current | Lead或动态单writer | required: 此票是可运行代码PoC，真实账号流程与fixture证据分别记录。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-03.md</Path> |
| T-04 | current | Lead或动态单writer | required: Kimi真实登录PoC，不是只加载官网。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-04.md</Path> |
| T-05 | current | Lead或动态单writer | required: ChatGPT真实登录PoC，不是只加载官网。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-05.md</Path> |
| T-06 | current | Lead或动态单writer | required: 三站源码与真实host验收是后续Gate；不可仅写研究结论。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-06.md</Path> |
| T-07 | current | Lead或动态单writer | required: 长回答与原生copy/官方原文定位。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-07.md</Path> |
| T-08 | current | Lead或动态单writer | required: 进程/guest与真实vault保存边界。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-08.md</Path> |
| T-09 | current | Lead或动态单writer | required: Claude不能用源码阅读或加载首页替代真实发送采集。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-09.md</Path> |
| T-10 | current | Lead或动态单writer | required: 通义千问不能用源码阅读或加载首页替代真实发送采集。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-10.md</Path> |
| T-11 | current | Lead或动态单writer | required: 豆包不能用源码阅读或加载首页替代真实发送采集。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-11.md</Path> |
| T-12 | current | Lead或动态单writer | required: Coze不能用源码阅读或加载首页替代真实发送采集。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-12.md</Path> |
| T-13 | current | Lead或动态单writer | required: MiniMax不能用源码阅读或加载首页替代真实发送采集。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-13.md</Path> |
| T-14 | current | Lead或动态单writer | required: 用户可操作的预览/导入/历史/导出全闭环。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-14.md</Path> |
| T-15 | current | Lead或动态单writer | required: home dispatch真实会话的材料与receipt边界。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-15.md</Path> |
| T-16 | current | Lead或动态单writer | required: 同页人工接管、真实guest焦点和授权交互。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-16.md</Path> |
| T-17 | current | Lead或动态单writer | required: 元素选择、真实单次验证和撤回。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-17.md</Path> |
| T-18 | current | Lead或动态单writer | required: 变量复用、真实page动作及暂停/取消。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-18.md</Path> |
| T-19 | current | Lead或动态单writer | required: 真实automation owner调度/receipt链路。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-19.md</Path> |
| T-20 | current | Lead或动态单writer | required: 真本地IPC认证、撤回及原page执行权。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-20.md</Path> |
| T-21 | current | Lead或动态单writer | required: 最终组合宿主验证；不要求无关站点/OS伪造通过。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-21.md</Path> |

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
| T-03 | main@1b9121382363cc50254fbc973c24742b7742edc7（run重核） | current | 本票验证矩阵 | 后续授权后非空commit | Lead direct-parent及required E2E | 通过后记录result SHA |
| T-04 | main@1b9121382363cc50254fbc973c24742b7742edc7（run重核） | current | 本票验证矩阵 | 后续授权后非空commit | Lead direct-parent及required E2E | 通过后记录result SHA |
| T-05 | main@1b9121382363cc50254fbc973c24742b7742edc7（run重核） | current | 本票验证矩阵 | 后续授权后非空commit | Lead direct-parent及required E2E | 通过后记录result SHA |
| T-06 | main@1b9121382363cc50254fbc973c24742b7742edc7（run重核） | current | 本票验证矩阵 | 后续授权后非空commit | Lead direct-parent及required E2E | 通过后记录result SHA |
| T-07 | main@1b9121382363cc50254fbc973c24742b7742edc7（run重核） | current | 本票验证矩阵 | 后续授权后非空commit | Lead direct-parent及required E2E | 通过后记录result SHA |
| T-08 | main@1b9121382363cc50254fbc973c24742b7742edc7（run重核） | current | 本票验证矩阵 | 后续授权后非空commit | Lead direct-parent及required E2E | 通过后记录result SHA |
| T-09 | main@1b9121382363cc50254fbc973c24742b7742edc7（run重核） | current | 本票验证矩阵 | 后续授权后非空commit | Lead direct-parent及required E2E | 通过后记录result SHA |
| T-10 | main@1b9121382363cc50254fbc973c24742b7742edc7（run重核） | current | 本票验证矩阵 | 后续授权后非空commit | Lead direct-parent及required E2E | 通过后记录result SHA |
| T-11 | main@1b9121382363cc50254fbc973c24742b7742edc7（run重核） | current | 本票验证矩阵 | 后续授权后非空commit | Lead direct-parent及required E2E | 通过后记录result SHA |
| T-12 | main@1b9121382363cc50254fbc973c24742b7742edc7（run重核） | current | 本票验证矩阵 | 后续授权后非空commit | Lead direct-parent及required E2E | 通过后记录result SHA |
| T-13 | main@1b9121382363cc50254fbc973c24742b7742edc7（run重核） | current | 本票验证矩阵 | 后续授权后非空commit | Lead direct-parent及required E2E | 通过后记录result SHA |
| T-14 | main@1b9121382363cc50254fbc973c24742b7742edc7（run重核） | current | 本票验证矩阵 | 后续授权后非空commit | Lead direct-parent及required E2E | 通过后记录result SHA |
| T-15 | main@1b9121382363cc50254fbc973c24742b7742edc7（run重核） | current | 本票验证矩阵 | 后续授权后非空commit | Lead direct-parent及required E2E | 通过后记录result SHA |
| T-16 | main@1b9121382363cc50254fbc973c24742b7742edc7（run重核） | current | 本票验证矩阵 | 后续授权后非空commit | Lead direct-parent及required E2E | 通过后记录result SHA |
| T-17 | main@1b9121382363cc50254fbc973c24742b7742edc7（run重核） | current | 本票验证矩阵 | 后续授权后非空commit | Lead direct-parent及required E2E | 通过后记录result SHA |
| T-18 | main@1b9121382363cc50254fbc973c24742b7742edc7（run重核） | current | 本票验证矩阵 | 后续授权后非空commit | Lead direct-parent及required E2E | 通过后记录result SHA |
| T-19 | main@1b9121382363cc50254fbc973c24742b7742edc7（run重核） | current | 本票验证矩阵 | 后续授权后非空commit | Lead direct-parent及required E2E | 通过后记录result SHA |
| T-20 | main@1b9121382363cc50254fbc973c24742b7742edc7（run重核） | current | 本票验证矩阵 | 后续授权后非空commit | Lead direct-parent及required E2E | 通过后记录result SHA |
| T-21 | main@1b9121382363cc50254fbc973c24742b7742edc7（run重核） | current | 本票验证矩阵 | 后续授权后非空commit | Lead direct-parent及required E2E | 通过后记录result SHA |

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

- AI官网DOM/网络格式/防护随时变化：每站adapter带version/能力支持表，失败明确原因，停留原页供人工操作，不删除安全隔离或新增猜测兜底。
- Obsidian guest隐藏输入、SSO/passkey可能不可行：真实三站源码PoC gate记录限制；阻塞对应adapter后续readiness，不伪造passed、不换独立浏览器架构而不更新决策。
- 发送后进程崩溃无法证明官网exactly-once：先journal、事后消息identity、unknown不自动重发；用户明确重发显示可能重复。
- isolated profile与旧默认登录迁移：default partition字节保持，新增隔离不复制cookie，活动page不可原地换partition；删除必须用户明确选择。
- 保存失败或用户编辑文档：DocumentRepository保留未知内容，flush失败不发/已发答案保存到recovery，retry-save不重问；坏文件不覆盖。
- 共享owner并行演化：home dispatch/receipt 与 browser消费者以公共API契约锁定；current严格串行，父计划插入外部依赖，不各自造agent scheduler。
- 研究资料不代表真实通过：PoC/每站验收有真实host版本/账号label/轮次/时间/证据路径，截图去敏感；当前规划不得改用户支持文档为已实现。

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
