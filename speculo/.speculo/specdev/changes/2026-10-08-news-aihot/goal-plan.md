---
schema_version: 6
artifact: "goal-plan"
change: "2026-10-08-news-aihot"
status: "draft"
modes: ["reference-conformance","high-assurance"]
orchestration: "lead-directed"
lead: "codex-root:nand-open-issues-20261008"
implementation_agent_limit: 1
integration_attempt_limit: 3
ticket_workspace_policy: "current"
integration_gate: "direct-parent"
ready_for_execution: false
---

# Goal Plan: 本地新闻工作台与 Agent 分析

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查与修复：[review-index.md](evidence/review-index.md)，覆盖本 change 的 10 票、28 条 AC。下文保留原规划目标与当时基线，不能把“尚未实现／本轮只规划”当成当前代码状态。当前源码与接口以审查证据及 owner 的 `api.ts` 为准；未验证的账号或平台仍未验证，原 AC 没有删减。
<!-- ACTUAL-CODE-REVIEW:END -->

- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/spec.md</Path>
- 控制入口：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/tickets-map.md</Path>

## 1. Outcome and Authority

### Outcome

深读 AIHOT 固定提交后按 NAND 模块、工作台、设置、Markdown 和 Agent CLI 契约重写完整新闻能力：采集、可解释精选、事件归组、热度、日报、收藏/简报、我的视图及首页组件；保留 OPML、静态网页列表、可选双评分与七天曲线。仅做本轮完整规划；后续 current 严格串行。

### Success and False Completion

成功为全部AC、数据保持、真实宿主/平台和参考差异验收成立。只存在实现/测试文件、mock通过、票标done或本文档生成都不代表产品完成。无需源码改动的既有能力通过非空验收文档交付或有理由取消；不造空commit。

### Non-goals

- 不搭建服务端、PostgreSQL、独立队列、公开网站、RSS/API/MCP输出或后台。
- 不直连模型API、不保存模型密钥，不支持首版排除的X/微信/Jina付费采集或向量检索。
- 不把新闻刷新建成自动化中心定义/cron，不默认开启YOLO或绕过CLI登录/信任/权限。
- 不自动全文转载、不使用AIHOT名称Logo、不在news change重做home看板。
- 周/月报仅需按第三节公式完成参考映射，#136实施与验收只要求今日要闻，本轮不建立周/月报产品入口。

### Authoritative Inputs

用户本轮已明确完整规划、BUG有票、current串行、规划工件中文；本change ADR/CONTEXT→Spec→Ticket拥有局部合同，Goal只拥有调度。原始来源和固定参考见 <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/source.md</Path> 与 <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/reference-analysis.md</Path>。生产现状以HEAD 1b9121382363cc50254fbc973c24742b7742edc7源码为准。

## 2. Execution Graph

### DAG and Critical Path

| Ticket | 依赖 | 可观察交付 |
|---|---|---|
| T-01 | ROOT | 用户可启用新闻，在设置添加三种feed，试抓/刷新后读取原始资料并保存可编辑Markdown。 |
| T-02 | T-01 | 新闻可通过公开runner发送一段prompt，得到完整最后答案及用量；用户能处理权限、取消和超时。 |
| T-03 | T-02 | 一次授权刷新产生可解释的中文精选与全部列表，拥有可靠批次结果、预算与重启行为。 |
| T-04 | T-03 | 读者看到重复报道折叠，同一事件后续进展清晰，点击代表新闻不会被爆料或无关汇总抢占。 |
| T-05 | T-04 | 读者看到按独立参与方计算的热点、可比趋势和真实观测曲线，能理解尚无趋势的原因。 |
| T-06 | T-05 | 读者无需额外AI调用即可看今日要闻、保存个性筛选并在重启/分屏恢复。 |
| T-07 | T-04 | 用户从新闻详情生成带来源简报、打开原文或送入现有Agent输入，并收到幂等完成/失败通知。 |
| T-08 | T-06 | 用户在统一首页组件库添加热点、精选、我的视图新闻组件，并能独立配置与导航。 |
| T-09 | T-01 | 用户可迁移OPML订阅及添加无需登录的静态HTML列表信源，并看到试抓预览和错误。 |
| T-10 | T-07, T-08, T-09 | 一名读者按文档可完成新闻全流程，维护者能审查参考/差异和真实运行证据。 |

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

### Ticket Quick Reference

| ID | Workspace | Implementation owner | E2E disposition | Evidence |
|---|---|---|---|---|
| T-01 | current | Lead或动态单writer | required: 真实Obsidian桌面用户闭环并记录未实测平台。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-01.md</Path> |
| T-02 | current | Lead或动态单writer | required: 真实Obsidian桌面用户闭环并记录未实测平台。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-02.md</Path> |
| T-03 | current | Lead或动态单writer | required: 真实Obsidian桌面用户闭环并记录未实测平台。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-03.md</Path> |
| T-04 | current | Lead或动态单writer | required: 真实Obsidian桌面用户闭环并记录未实测平台。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-04.md</Path> |
| T-05 | current | Lead或动态单writer | required: 真实Obsidian桌面用户闭环并记录未实测平台。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-05.md</Path> |
| T-06 | current | Lead或动态单writer | required: 真实Obsidian桌面用户闭环并记录未实测平台。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-06.md</Path> |
| T-07 | current | Lead或动态单writer | required: 真实Obsidian桌面用户闭环并记录未实测平台。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-07.md</Path> |
| T-08 | current | Lead或动态单writer | required: 真实Obsidian桌面用户闭环并记录未实测平台。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-08.md</Path> |
| T-09 | current | Lead或动态单writer | required: 真实Obsidian桌面用户闭环并记录未实测平台。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-09.md</Path> |
| T-10 | current | Lead或动态单writer | required: 真实Obsidian桌面用户闭环并记录未实测平台。 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/evidence/T-10.md</Path> |

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

- 真实Claude/Codex账号与其余CLI能力是执行事实验证门，不能以静态阅读代替；T-02保留真实版本/账号输出证据和支持表。
- 六CLI transcript/argv能力不一致且hook有字符与UTF8双上限；能力驱动单通道、受测批量上限、completion元数据独立于全文。
- AI合批/输出axes相对AIHOT独立分步会改变品味；少量标注样本对照，不声称模型等价，不建过度benchmark平台。
- 事件若无occurrence层会使ROUNDUP桥接与日报/代表错误；保留最小内嵌层级与确定关系fixture。
- 新源/落后采集虚增趋势；cohort和缺失小时显式，拒绝0填充；本地不等于24/7监控。
- home registry/Agent公共contract并行领域冲突：由home拥有公共基础，本change依赖具体契约票，后续current串行执行。
- 原issue版本及路径过期，#135是否已解决需终端领域真实下载验收；不能盲修旧版本假设。

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
