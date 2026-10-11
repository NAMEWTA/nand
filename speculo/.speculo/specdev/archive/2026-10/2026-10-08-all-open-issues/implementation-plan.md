---
schema_version: 1
artifact: "implementation-plan"
change: "2026-10-08-all-open-issues"
status: "completed"
source_map_revision: 3
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


# NAND 全部 open issue — 整体 Goal Plan

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查与修复见 [review-report.md](review-report.md) 和 [review-progress.json](review-progress.json)。已逐项审查61票／180条AC；原规划文本、阶段 Gate 与历史授权说明保留为历史记录。用户当前已授权自主代码修复，未要求提交、推送、发版或关闭 issue；不以规划阶段“0/61／只规划”描述当前工作区，也不把真实账号或未跑平台 Gate 视为通过。
<!-- ACTUAL-CODE-REVIEW:END -->

## 1. Outcome and Authority

交付用户要求的所有功能与BUG修复，且遵循NAND目录、模块、lazy、api、settings、存储、设计系统、双语产品文档与许可规范。本轮完成的是全部规划；运行时实现、提交、远程写入未开始。父调度权威为Implementation Map/Plan，子合同仍归各Spec/Ticket。

数量：13个issue、8个子change、61票、180条AC；没有将新闻后段或浏览器后续阶段移到无限期backlog。poC不通过阻塞依赖闭包并回修，不取消已经约定的功能。

## 2. Ready Frontier and Waves

合同ready frontier（执行授权未开）：2026-10-08-workbench-regressions::T-01, 2026-10-08-workbench-regressions::T-02, 2026-10-08-workbench-regressions::T-03, 2026-10-08-terminal-reliability::T-01, 2026-10-08-terminal-reliability::T-02, 2026-10-08-private-storage-permissions::T-01, 2026-10-08-private-storage-permissions::T-02, 2026-10-08-archives-completion::T-01, 2026-10-08-git-sync-parity::T-01, 2026-10-08-git-sync-parity::T-02, 2026-10-08-git-sync-parity::T-03, 2026-10-08-home-grid-rebuild::T-01, 2026-10-08-home-grid-rebuild::T-13, 2026-10-08-home-grid-rebuild::T-14, 2026-10-08-home-grid-rebuild::T-16, 2026-10-08-home-grid-rebuild::T-17, 2026-10-08-browser-ai-workbench::T-01。

真实DAG最长链共11票（反向列）：2026-10-08-home-grid-rebuild::T-18 ← 2026-10-08-news-aihot::T-08 ← 2026-10-08-news-aihot::T-06 ← 2026-10-08-news-aihot::T-05 ← 2026-10-08-news-aihot::T-04 ← 2026-10-08-news-aihot::T-03 ← 2026-10-08-news-aihot::T-02 ← 2026-10-08-home-grid-rebuild::T-07 ← 2026-10-08-home-grid-rebuild::T-03 ← 2026-10-08-home-grid-rebuild::T-02 ← 2026-10-08-home-grid-rebuild::T-01。current限制下所有票一次一个执行，下表是满足DAG且独立BUG优先的建议顺序；可调整独立项而不用伪造依赖。

| Wave | Ticket | 需要已通过的依赖 | Gate |
|---|---|---|---|
| W-01 | 2026-10-08-workbench-regressions::T-01 | ROOT | 本票AC/验证+direct-parent |
| W-02 | 2026-10-08-workbench-regressions::T-02 | ROOT | 本票AC/验证+direct-parent |
| W-03 | 2026-10-08-workbench-regressions::T-03 | ROOT | 本票AC/验证+direct-parent |
| W-04 | 2026-10-08-terminal-reliability::T-01 | ROOT | 本票AC/验证+direct-parent |
| W-05 | 2026-10-08-terminal-reliability::T-02 | ROOT | 本票AC/验证+direct-parent |
| W-06 | 2026-10-08-private-storage-permissions::T-01 | ROOT | 本票AC/验证+direct-parent |
| W-07 | 2026-10-08-private-storage-permissions::T-02 | ROOT | 本票AC/验证+direct-parent |
| W-08 | 2026-10-08-git-sync-parity::T-01 | ROOT | 本票AC/验证+direct-parent |
| W-09 | 2026-10-08-git-sync-parity::T-03 | ROOT | 本票AC/验证+direct-parent |
| W-10 | 2026-10-08-home-grid-rebuild::T-01 | ROOT | 本票AC/验证+direct-parent |
| W-11 | 2026-10-08-browser-ai-workbench::T-01 | ROOT | 本票AC/验证+direct-parent |
| W-12 | 2026-10-08-archives-completion::T-01 | ROOT | 本票AC/验证+direct-parent |
| W-13 | 2026-10-08-git-sync-parity::T-02 | ROOT | 本票AC/验证+direct-parent |
| W-14 | 2026-10-08-git-sync-parity::T-04 | 2026-10-08-git-sync-parity::T-01, 2026-10-08-git-sync-parity::T-02, 2026-10-08-git-sync-parity::T-03 | 本票AC/验证+direct-parent |
| W-15 | 2026-10-08-home-grid-rebuild::T-02 | 2026-10-08-home-grid-rebuild::T-01 | 本票AC/验证+direct-parent |
| W-16 | 2026-10-08-home-grid-rebuild::T-03 | 2026-10-08-home-grid-rebuild::T-02 | 本票AC/验证+direct-parent |
| W-17 | 2026-10-08-home-grid-rebuild::T-04 | 2026-10-08-home-grid-rebuild::T-02, 2026-10-08-home-grid-rebuild::T-03 | 本票AC/验证+direct-parent |
| W-18 | 2026-10-08-home-grid-rebuild::T-05 | 2026-10-08-home-grid-rebuild::T-04 | 本票AC/验证+direct-parent |
| W-19 | 2026-10-08-home-grid-rebuild::T-06 | 2026-10-08-home-grid-rebuild::T-03, 2026-10-08-home-grid-rebuild::T-04 | 本票AC/验证+direct-parent |
| W-20 | 2026-10-08-home-grid-rebuild::T-07 | 2026-10-08-home-grid-rebuild::T-03 | 本票AC/验证+direct-parent |
| W-21 | 2026-10-08-home-grid-rebuild::T-08 | 2026-10-08-home-grid-rebuild::T-07 | 本票AC/验证+direct-parent |
| W-22 | 2026-10-08-home-grid-rebuild::T-09 | 2026-10-08-home-grid-rebuild::T-07 | 本票AC/验证+direct-parent |
| W-23 | 2026-10-08-home-grid-rebuild::T-10 | 2026-10-08-home-grid-rebuild::T-04, 2026-10-08-home-grid-rebuild::T-08 | 本票AC/验证+direct-parent |
| W-24 | 2026-10-08-home-grid-rebuild::T-11 | 2026-10-08-home-grid-rebuild::T-02 | 本票AC/验证+direct-parent |
| W-25 | 2026-10-08-home-grid-rebuild::T-12 | 2026-10-08-home-grid-rebuild::T-02 | 本票AC/验证+direct-parent |
| W-26 | 2026-10-08-home-grid-rebuild::T-13 | ROOT | 本票AC/验证+direct-parent |
| W-27 | 2026-10-08-home-grid-rebuild::T-14 | ROOT | 本票AC/验证+direct-parent |
| W-28 | 2026-10-08-home-grid-rebuild::T-15 | 2026-10-08-home-grid-rebuild::T-02 | 本票AC/验证+direct-parent |
| W-29 | 2026-10-08-home-grid-rebuild::T-16 | ROOT | 本票AC/验证+direct-parent |
| W-30 | 2026-10-08-home-grid-rebuild::T-17 | ROOT | 本票AC/验证+direct-parent |
| W-31 | 2026-10-08-news-aihot::T-01 | 2026-10-08-private-storage-permissions::T-01 | 本票AC/验证+direct-parent |
| W-32 | 2026-10-08-news-aihot::T-02 | 2026-10-08-home-grid-rebuild::T-07, 2026-10-08-news-aihot::T-01 | 本票AC/验证+direct-parent |
| W-33 | 2026-10-08-news-aihot::T-03 | 2026-10-08-news-aihot::T-02 | 本票AC/验证+direct-parent |
| W-34 | 2026-10-08-news-aihot::T-04 | 2026-10-08-news-aihot::T-03 | 本票AC/验证+direct-parent |
| W-35 | 2026-10-08-news-aihot::T-05 | 2026-10-08-news-aihot::T-04 | 本票AC/验证+direct-parent |
| W-36 | 2026-10-08-news-aihot::T-06 | 2026-10-08-news-aihot::T-05 | 本票AC/验证+direct-parent |
| W-37 | 2026-10-08-news-aihot::T-07 | 2026-10-08-news-aihot::T-04 | 本票AC/验证+direct-parent |
| W-38 | 2026-10-08-news-aihot::T-08 | 2026-10-08-home-grid-rebuild::T-03, 2026-10-08-news-aihot::T-06 | 本票AC/验证+direct-parent |
| W-39 | 2026-10-08-home-grid-rebuild::T-18 | 2026-10-08-home-grid-rebuild::T-01, 2026-10-08-home-grid-rebuild::T-02, 2026-10-08-home-grid-rebuild::T-03, 2026-10-08-home-grid-rebuild::T-04, 2026-10-08-home-grid-rebuild::T-05, 2026-10-08-home-grid-rebuild::T-06, 2026-10-08-home-grid-rebuild::T-07, 2026-10-08-home-grid-rebuild::T-08, 2026-10-08-home-grid-rebuild::T-09, 2026-10-08-home-grid-rebuild::T-10, 2026-10-08-home-grid-rebuild::T-11, 2026-10-08-home-grid-rebuild::T-12, 2026-10-08-home-grid-rebuild::T-13, 2026-10-08-home-grid-rebuild::T-14, 2026-10-08-home-grid-rebuild::T-15, 2026-10-08-home-grid-rebuild::T-16, 2026-10-08-home-grid-rebuild::T-17, 2026-10-08-news-aihot::T-08 | 本票AC/验证+direct-parent |
| W-40 | 2026-10-08-news-aihot::T-09 | 2026-10-08-news-aihot::T-01 | 本票AC/验证+direct-parent |
| W-41 | 2026-10-08-news-aihot::T-10 | 2026-10-08-news-aihot::T-07, 2026-10-08-news-aihot::T-08, 2026-10-08-news-aihot::T-09 | 本票AC/验证+direct-parent |
| W-42 | 2026-10-08-browser-ai-workbench::T-02 | 2026-10-08-private-storage-permissions::T-01 | 本票AC/验证+direct-parent |
| W-43 | 2026-10-08-browser-ai-workbench::T-03 | 2026-10-08-browser-ai-workbench::T-02 | 本票AC/验证+direct-parent |
| W-44 | 2026-10-08-browser-ai-workbench::T-04 | 2026-10-08-browser-ai-workbench::T-03 | 本票AC/验证+direct-parent |
| W-45 | 2026-10-08-browser-ai-workbench::T-05 | 2026-10-08-browser-ai-workbench::T-03 | 本票AC/验证+direct-parent |
| W-46 | 2026-10-08-browser-ai-workbench::T-06 | 2026-10-08-browser-ai-workbench::T-03, 2026-10-08-browser-ai-workbench::T-04, 2026-10-08-browser-ai-workbench::T-05 | 本票AC/验证+direct-parent |
| W-47 | 2026-10-08-browser-ai-workbench::T-07 | 2026-10-08-browser-ai-workbench::T-06 | 本票AC/验证+direct-parent |
| W-48 | 2026-10-08-browser-ai-workbench::T-08 | 2026-10-08-browser-ai-workbench::T-07 | 本票AC/验证+direct-parent |
| W-49 | 2026-10-08-browser-ai-workbench::T-09 | 2026-10-08-browser-ai-workbench::T-06 | 本票AC/验证+direct-parent |
| W-50 | 2026-10-08-browser-ai-workbench::T-10 | 2026-10-08-browser-ai-workbench::T-06 | 本票AC/验证+direct-parent |
| W-51 | 2026-10-08-browser-ai-workbench::T-11 | 2026-10-08-browser-ai-workbench::T-06 | 本票AC/验证+direct-parent |
| W-52 | 2026-10-08-browser-ai-workbench::T-12 | 2026-10-08-browser-ai-workbench::T-06 | 本票AC/验证+direct-parent |
| W-53 | 2026-10-08-browser-ai-workbench::T-13 | 2026-10-08-browser-ai-workbench::T-06 | 本票AC/验证+direct-parent |
| W-54 | 2026-10-08-browser-ai-workbench::T-14 | 2026-10-08-browser-ai-workbench::T-08 | 本票AC/验证+direct-parent |
| W-55 | 2026-10-08-browser-ai-workbench::T-15 | 2026-10-08-browser-ai-workbench::T-07, 2026-10-08-home-grid-rebuild::T-07, 2026-10-08-news-aihot::T-02 | 本票AC/验证+direct-parent |
| W-56 | 2026-10-08-browser-ai-workbench::T-16 | 2026-10-08-browser-ai-workbench::T-08, 2026-10-08-home-grid-rebuild::T-07, 2026-10-08-news-aihot::T-02 | 本票AC/验证+direct-parent |
| W-57 | 2026-10-08-browser-ai-workbench::T-17 | 2026-10-08-browser-ai-workbench::T-07, 2026-10-08-browser-ai-workbench::T-15 | 本票AC/验证+direct-parent |
| W-58 | 2026-10-08-browser-ai-workbench::T-18 | 2026-10-08-browser-ai-workbench::T-16 | 本票AC/验证+direct-parent |
| W-59 | 2026-10-08-browser-ai-workbench::T-19 | 2026-10-08-browser-ai-workbench::T-18, 2026-10-08-home-grid-rebuild::T-07 | 本票AC/验证+direct-parent |
| W-60 | 2026-10-08-browser-ai-workbench::T-20 | 2026-10-08-browser-ai-workbench::T-16 | 本票AC/验证+direct-parent |
| W-61 | 2026-10-08-browser-ai-workbench::T-21 | 2026-10-08-browser-ai-workbench::T-01, 2026-10-08-browser-ai-workbench::T-09, 2026-10-08-browser-ai-workbench::T-10, 2026-10-08-browser-ai-workbench::T-11, 2026-10-08-browser-ai-workbench::T-12, 2026-10-08-browser-ai-workbench::T-13, 2026-10-08-browser-ai-workbench::T-14, 2026-10-08-browser-ai-workbench::T-17, 2026-10-08-browser-ai-workbench::T-19, 2026-10-08-browser-ai-workbench::T-20 | 本票AC/验证+direct-parent |

## 3. Workspace and Dispatch Contract

用户明确选择当前工作区，严格串行。无新worktree，无source/candidate分叉；Lead唯一持有状态、集成与真实E2E。implementation_agent_limit=1，integration_attempt_limit=3；未提前指定模型。subagent-delivery operation=plan：研究、实现、审查、测试观察按后续授权动态分配，只有一个实现writer。

Dispatch必须附真实base HEAD、parent ref、完整子Map/Skill/票、依赖Evidence、paths/resources、可执行验证、授权引用、恢复位置。先读Map→适用Skill→Ticket。保留用户145个原有dirty/untracked路径；run时重做实际快照，不能把旧列表当当前事实。仅stage本票授权路径，禁止全仓add或夹带工作流改动。

授权：本轮规划/只读研究/必要本地校验已授权；产品实施/implementation commit/父分支推进、push/PR/merge/release、账号登录、删除数据或清理工作区未授权。用户后续run指令按其明确范围决定，无需重复问已给选择，但不能将本计划本身当授权。

## 4. Repository Integration Queue

仓库NAMEWTA/nand，current/direct-parent，所有票/构建/主产物一次一个owner。源基线1b9121382363cc50254fbc973c24742b7742edc7，分支main；每票实际base以开始时HEAD重新冻结。source检查通过后形成授权的非空implementation commit；Lead在同current验证父状态、所有新失败和必需E2E，再记录result SHA与包含关系。不存在candidate merge gate，不造空提交或把docs规划票冒充代码修复。

票失败保留检查点、真实diff、已有commit、日志；3次集成失败做模式/原因/新动作/新owner复盘。后续票不得越过失败前置，独立项仅在执行范围仍授权时可继续。

## 5. Gates and Aggregate Verification

| Gate | 开启/关闭条件 | 必须看到的证据 | 失败范围/owner |
|---|---|---|---|
| G-START | 收到后续实施请求并核对提交/集成授权 | 最新HEAD、dirty快照、合法Skill摘要、唯一writer | 全部执行/Lead |
| G-BUG | 八个显式BUG issue和Git新增缺陷各自通过 | 真实旧失败→新行为，#141窄桌面、#142chrome/guest焦点、#143继承FD、#144新建/clone/symlink；不是只看测试文件 | 对应修复与消费者/Lead |
| G-API | 对应owner先交付公共合同 | widget bundle、dispatch vs completion、typed workflow UI、runner runContext生命周期；短期env不入accountKey | 依赖该接口的闭包/owner+Lead |
| G-POC | browser T-03/04/05源码及T-06真实三站通过 | DeepSeek/Kimi/ChatGPT用户登录；当前轮完整输出、部分失败、后台不抢焦点、暂停恢复；未测账号不得打勾 | browser T-06下游/Lead |
| G-DOMAIN | 各子Goal全AC与reference表验收 | 固定参考的完整能力/差异、许可、文档、真实宿主和迁移；未用构建代替UI | 该change/Lead |
| G-AGGREGATE | 全部61票与8域Gate通过 | 模块开关→HOME_WIDGETS恢复→新闻AI→browser综合/助手/自动化→退出/重启；仅必要跨域链；数据无损 | 总体完成/Lead |
| G-RECONCILE | 每个source独立满足关闭资格 | 对应issue所有AC真证据与单独远程授权；不因同组主票完成就关闭其它issue | 来源关闭/Lead |

功能第一；测试只针对具体风险、既有接缝和真实产品路径。布局局部改动不新增镜像DOM套件，关键数据/协议/算法保留最短有判别力测试。build/lint与按路径命中的architecture/bundle/CSS/i18n/docs为结构检查。基线91 tests及本轮build/lint只证明现有状态；未来行为须按票验收。

## 6. Conflict, Drift and Recovery

Issue新内容单独抓新快照，引用原source不覆盖。子Spec/Ticket/Skill或引用SHA漂移时冻结影响闭包，回owner确认并递增map revision、同步plan.source_map_revision；不可依旧摘要执行。永久知识只读，源代码许可边界保持。验证环境缺失时仅对应Gate待办，不能编造截图、平台或AI结果。

公共接口若需重切先扩展兼容→迁移消费者→旧调用归零再收缩；持久内容保留用户unknown字段/正文，不以清空缓存掩盖写失败。所有不确定发送停在unknown，只在人工明确重试后再次操作；read-only重采集与重发分开。

## 7. Progress and Decisions

历史规划阶段曾记录产品执行0/61、issue关闭0/13。2026-10-11当前代码审查已覆盖61票及180条AC，并修复实际缺陷；每项本地证据与未验证条件见review-report及各票Evidence。原status/ready_for_execution是规划快照，不作为本次用户已授权审查的阻断条件。issue关闭、提交、推送和发布仍未执行。

恢复入口为父tickets-map.md，先ticket-control只读检查，再P run/resume。先核真实授权和环境，按Ready frontier动态派发。即便所有票done，G-AGGREGATE未通过仍不得宣布整体完成。

规划修订2：适配用户并行更新的中文Skill入口与真实摘要；图的成员、任务、依赖和功能范围不变。
