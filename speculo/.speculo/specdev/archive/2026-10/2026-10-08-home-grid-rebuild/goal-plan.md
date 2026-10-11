---
schema_version: 6
artifact: "goal-plan"
change: "2026-10-08-home-grid-rebuild"
status: "completed"
modes: ["reference-conformance","high-assurance","migration"]
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


# Goal Plan: 首页看板自由网格、组件贡献与智能体技能派发

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查与修复：[review-index.md](evidence/review-index.md)，覆盖本 change 的 18 票、77 条 AC。下文保留原规划目标与当时基线，不能把“尚未实现／本轮只规划”当成当前代码状态。当前源码与接口以审查证据及 owner 的 `api.ts` 为准；未验证的账号或平台仍未验证，原 AC 没有删减。
<!-- ACTUAL-CODE-REVIEW:END -->

- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/spec.md</Path>
- 控制入口：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/tickets-map.md</Path>

## 1. Outcome and Authority

### Outcome

先独立修复 #141 的窄桌面快捷创建栏异常高度和横幅遮挡；随后完整落实 #137：固定参考 apex-dashboard 3.7.5 源码，形成按看板布局/成员、沉浸式统一网格、内外部小组件贡献、NAND 终端技能派发、工作流分区以及全部八项附加体验。遵守现有模块边界、懒加载、全局主题、Markdown 保真、i18n 与许可；RSS 产品由新闻 change 实现。本次交付是成熟规格、18 张票与串行计划，不执行实现或发布。

### Success and False Completion

成功为全部AC、数据保持、真实宿主/平台和参考差异验收成立。只存在实现/测试文件、mock通过、票标done或本文档生成都不代表产品完成。无需源码改动的既有能力通过非空验收文档交付或有理由取消；不造空commit。

### Non-goals

- RSS/新闻抓取、阅读产品由 #136/news change 实现，本 change 仅提供贡献契约
- Claudian/Copilot/Codex Desktop/ZCode 外部适配器为明确非必选后续项
- GPL home-pages 实现代码、单体 apex renderer/i18n/saveData/整份 CSS
- dnd-kit/gridstack 或第二套 UI 系统、新 Obsidian view/router/tab 系统
- 按看板独立主题/私有调色板、作者个人目录预设、TickTick 集成
- 本轮代码实施、提交、推送、关闭 issue、创建 PR 或发布

### Authoritative Inputs

用户本轮已明确完整规划、BUG有票、current串行、规划工件中文；本change ADR/CONTEXT→Spec→Ticket拥有局部合同，Goal只拥有调度。原始来源和固定参考见 <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/source.md</Path> 与 <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/reference-analysis.md</Path>。生产现状以HEAD 1b9121382363cc50254fbc973c24742b7742edc7源码为准。

## 2. Execution Graph

### DAG and Critical Path

| Ticket | 依赖 | 可观察交付 |
|---|---|---|
| T-01 | ROOT | 在#141复现窗口直接恢复紧凑快捷栏及下方内容，独立完成，不等待沉浸式重构。 |
| T-02 | T-01 | 让现有side/stacked成为每板可保存选择，同时建立三布局codec与迁移入口，第一份适配代码有完整许可证据。 |
| T-03 | T-02 | 所有内置及外部组件按同一公开贡献契约渲染，各板成员独立且模块关闭不丢位置。 |
| T-04 | T-02, T-03 | 用户首次切immersive即可看到widgets/sections/cards的共同网格，重启与窄屏投影可靠。 |
| T-05 | T-04 | 用户能用pointer或完全键盘自由排列，任何取消都恢复原位且不写错布局。 |
| T-06 | T-03, T-04 | 用户无需离开看板即可创建首个多实例组件、删除/重加成员和调整看板顺序。 |
| T-07 | T-03 | 从一个可配置技能小组件生成精确prompt，经预览编辑或直发创建真实新agent会话并可追踪结果；公共能力供news/browser复用。 |
| T-08 | T-07 | 用户从快念/卡片或技能组件把准确材料粘贴到指定已有agent输入框，同时看到诚实的待发送回执。 |
| T-09 | T-07 | 无需记住技能名即可从库内/历史/显式桌面目录选择，调用语法按真实agent能力。 |
| T-10 | T-04, T-08 | 配置一个真实笔记工作流，能推进状态/目录、管理清单/截止并给卡片或整列派技能，全部行为可重启恢复。 |
| T-11 | T-02 | library/folder可选择多个笔记模板，新建时选一个且不破坏旧templatePath数据。 |
| T-12 | T-02 | 用户能为每分区保存表格列顺序和显隐，数据变化后偏好仍可靠。 |
| T-13 | ROOT | 大型分组/kanban首次只渲染可用的一屏批次，用户可逐步加载且知道截断范围。 |
| T-14 | ROOT | 用户输入农历日期可无损转换并在每年正确农历日提醒，闰月/短月政策明确。 |
| T-15 | T-02 | 用户能为每张横幅图和卡片封面保存独立crop焦点，通过鼠标和键盘都可操作。 |
| T-16 | ROOT | 按已确认规则保存theme+home完整命名组合，一键恢复全部窗口外观且不引入按板主题。 |
| T-17 | ROOT | 用户找到任意宿主图标，并在所有文件卡视图通过可达按钮安全删除，无额外数据或图标系统。 |
| T-18 | T-01, T-02, T-03, T-04, T-05, T-06, T-07, T-08, T-09, T-10, T-11, T-12, T-13, T-14, T-15, T-16, T-17 | 在全部feature和news贡献可用后验证完整用户旅程，交付可追溯的双语文档、许可和实际证据。 |

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

### Ticket Quick Reference

| ID | Workspace | Implementation owner | E2E disposition | Evidence |
|---|---|---|---|---|
| T-01 | current | Lead或动态单writer | required: #141真实640×740中英/返回首页、639/641/660与窄pane、capture增高、横幅遮挡。 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-01.md</Path> |
| T-02 | current | Lead或动态单writer | required: 两板布局独立、窗口/phone有效布局、重启恢复与零只读写入。 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-02.md</Path> |
| T-03 | current | Lead或动态单writer | required: 所有内置无遗漏、两板共享实例、外部贡献模块关闭/恢复、页面卸载。 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-03.md</Path> |
| T-04 | current | Lead或动态单writer | required: mixed tiles、content-fit/fixed、重启、6/3列窄pane与Phone side。 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-04.md</Path> |
| T-05 | current | Lead或动态单writer | required: pointer与完整键盘、取消三路径、snap/swap、持续edge scroll、reduce/popout/touch。 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-05.md</Path> |
| T-06 | current | Lead或动态单writer | required: 零实例新建/取消、共享实例移除重加、面板排序及重启。 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-06.md</Path> |
| T-07 | current | Lead或动态单writer | required: fresh技能配置、editable preview原文、directSend、重复点击、off/busy/timeout、记录与真实CLI完成状态。 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-07.md</Path> |
| T-08 | current | Lead或动态单writer | required: existing零Enter、失效目标、快念/card文本、stage范围公共能力、fresh回归。 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-08.md</Path> |
| T-09 | current | Lead或动态单writer | required: 三目录发现+remembered、额外目录opt-in、模块不可用/移动端降级与至少已支持CLI调用smoke。 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-09.md</Path> |
| T-10 | current | Lead或动态单writer | required: 完整配置→创建→推进→checklist/due→技能→归档→重启，含冲突/部分IO失败/键盘。 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-10.md</Path> |
| T-11 | current | Lead或动态单writer | required: library/folder三种模板数量、选择/取消、创建内容和重启。 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-11.md</Path> |
| T-12 | current | Lead或动态单writer | required: 两分区独立、字段消失/返回、新列、键盘顺序/隐藏/reset。 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-12.md</Path> |
| T-13 | current | Lead或动态单writer | required: 501项代表数据、50→100追加、筛选后找到原截断结果、move/delete和非分组分页。 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-13.md</Path> |
| T-14 | current | Lead或动态单writer | required: 双向输入闰月日期、缺闰月/短月政策呈现、重启和真实提醒来源。 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-14.md</Path> |
| T-15 | current | Lead或动态单writer | required: carousel两图/card、pointer+键盘、reset、resize与重启。 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-15.md</Path> |
| T-16 | current | Lead或动态单writer | required: 保存/重名/应用/删除当前、theme+home双恢复、popout与重启、保存错误。 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-16.md</Path> |
| T-17 | current | Lead或动态单writer | required: 全集fuzzy/400限制/icons off；三卡片视图delete的确认/取消/失败与focus/touch。 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-17.md</Path> |
| T-18 | current | Lead或动态单writer | required: 完整功能与news联动、fresh/restart、light/dark三preset、三宽度/phone能力、keyboard/reduce/popout；真实平台能力如缺失必须明示。 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-18.md</Path> |

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

- 上游注释与实现不一致（坐标持久化、readonly预览、stage直发），按固定源码事实和用户确认修正，不盲搬注释。
- 迁移混合raw/source/baseline可能让首次打开改写；以旧字节golden和读盘写次数验证，继续使用现有preserveDocument。
- provider关闭被normalize当孤儿导致布局丢失；persisted member集合与active contribution集合明确分开。
- 自动化reuse会回车，与快捷按钮既有会话语义冲突；独立路由到attachMaterial并检测实际输入字节。
- workflow状态成功而rename失败会产生部分结果；提前检测目标冲突，错误回读真实状态，不只回滚DOM、不隐藏失败。
- cap粗/细单位反复迁移和窄屏坐标覆盖；codec只迁移legacy h一次，effective布局不写canonical。
- 主题组合跨namespace持久化：使用已有SettingsStore合并flush并明确保存错误，避免新增事务系统或私有主题。
- 18票有真实写文件重叠及跨change公共接口；严格串行由总体计划安排，deps只表示语义前置，不用伪依赖掩盖冲突。

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
