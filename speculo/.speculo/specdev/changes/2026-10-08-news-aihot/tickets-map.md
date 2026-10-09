---
schema_version: 3
plan_contract_version: 1
plan_revision: 2
requested_deliverables: [{"name":"该领域完整Spec、Tickets Map与Goal Plan","count":1}]
deliverable_policy: "用户要求所有13个open issue完整按域规划，无指定Ticket数量；数量依真实垂直切片，所有AC必须覆盖。"
artifact: "tickets-map"
change: "2026-10-08-news-aihot"
status: "ready"
---

# Tickets Map: 本地新闻工作台与 Agent 分析

- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/spec.md</Path>
- Goal：<Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/goal-plan.md</Path>

## 1. 目标与拆分策略

深读 AIHOT 固定提交后按 NAND 模块、工作台、设置、Markdown 和 Agent CLI 契约重写完整新闻能力：采集、可解释精选、事件归组、热度、日报、收藏/简报、我的视图及首页组件；保留 OPML、静态网页列表、可选双评分与七天曲线。仅做本轮完整规划；后续 current 严格串行。

### 总体实施背景

NAND 当前 HEAD 1b9121382363cc50254fbc973c24742b7742edc7，无 news 模块，home 无跨模块 widget registry；#136 旧基线 21f852b 已过期。agent/api.ts 只有 AGENT_SESSIONS 与 AGENT_WORKBENCH；TerminalAutomationRuntime 已复用登录/CLI/hooks/PTY但要求 AutomationRun、答案截尾8000字符且无总运行超时。现六CLI首次prompt均经argv/flag，旧 automation-catalog.ts 与 CORE_AGENT_IDS 已删除；以 AGENT_CATALOG 为准。hook stdin >65536字符静默退出，spool >100000 bytes拒收；Pi/OpenCode未带最终答案，history/parse.ts仅元数据没有完整assistant文本。manifest/package当前0.0.1-alpha.1，不能按旧issue断言仍是1.0.0。AIHOT c547b669acc7f64720cd82024e502446ee1ef88d 已固定clone在repo外并深读算法/提示词/UI。home领域change拥有公共Agent目录/派发、automation invocation/receipt contract；本change依赖并复用，不另建同名公共目录。本change独立拥有新闻结构化后台结果runner扩展。

现有公共接口位置：<Path>src/modules/agent/api.ts</Path>、<Path>src/modules/home/api.ts</Path>、<Path>src/modules/browser/api.ts</Path>、<Path>src/modules/notifications/api.ts</Path>。拟新增news/api.ts只导出类型/service keys。AGENT_PROMPT_RUNNER请求{agentId,cwd,prompt,title,timeoutMs,signal?,reveal?,keepTerminal?,resultChannel?}，返回完整{text,status:succeeded|failed|cancelled|interrupted|timeout,usage?,terminalId,errorCode?}并暴露running/needs-attention变化；公共agent目录从home-owner contract复用。共享底层执行独立于AutomationRun，由自动化adapter保持旧签名；无新进程管理器。

SourceConfig{id,name,type:rss|atom|jsonfeed|web-list,url,tier,participation:editorial|signal|isolated,participantStrategy/groupId/ownerEntityId,publisherRole,intervalMinutes,enabled,selectors?}存vault配置；SourceHealth{lastAttempt,lastSuccess,failureCount,nextDue,initializedAt,etag,lastModified,configHash}存设备运行数据。Material{id,sourceId,sourceItemId,originalUrl,canonicalKey,title,author,bodyExcerpt,publishedAt,claimedAt,discoveredAt,revision,contentHash,backfillReason}；Analysis{materialId,revision,contentHash,effectivePromptVersion,agentId,accountIdentity,samples:axes[],itemType,scoreCap,relevance,scope,category,tags,subjects,frame,titleZh,summaryZh,reason,createdAt}。score/selected为派生值，存原始axes可重算。

Event{id,title,occurrences:[{id,frame,materialIds,rootRelation,confidence}],roundupMentions,firstAt,latestAt,representative,mergedInto?}；同一发生与事件后续明确区分，merge alias保留收藏与深链。HeatSnapshot{eventId,hour,heat,participantCount,cohort,complete,ruleVersion}。RunReceipt{id,batchId,trigger,materialRevisionIds,promptVersion,agent/account,sample/attempt,state,startedAt,endedAt,rawResult/hash,usageKnown,errorCode,terminalId}；raw result先于business apply落盘。NewsView{id,name,filters:{category,tags,sourceIds,minScore,query}}；reader state{readIds,uninterestedIds}；收藏身份可独立于可过期material cache解析。

.nand/config/settings.json 的 news namespace保存sources、模板、权重、视图、显示/目录；绝对CLI目录/agent偏好可device scope，cwd优先存vault relative、执行canonicalVaultCwd。全部设备state在.nand/news/<device-id>/{materials,analyses,events,heat,runs,reader-state}.json，version envelope，JsonStore，默认30天，仅删可重建缓存且保留引用需要的最小identity。可选结果文件.nand/news/<device-id>/runs/<runId>/result.json，不默认使用。不得读取失败就以空值覆写，不另造备份系统。

用户Markdown默认NAND/新闻/收藏/YYYY-MM-DD-<安全标题>.md，frontmatter nand-type: news、stable id、url、source、published、score、tags、event，正文标题/摘要/理由/原文链接/我的批注；日报NAND/新闻/日报/YYYY-MM-DD.md，简报NAND/新闻/简报/…。中文路径不随界面语言变更；重复写采用稳定身份/管理区域，用户批注和未保存编辑不覆盖；更新只在耐久写成功后显示saved。.nand不经Obsidian Sync同步；手机读Markdown，不声称设备JSON共享。无已有news数据迁移，旧home board实例兼容由home registry owner负责，新增news widget实例遵循它的schema而非新格式。 AGENT_PROMPT_RUNNER另支持可选runContext:{provider,handle}，AGENT_RUN_CONTEXTS贡献点仅由受信模块注册resolver，将opaque handle转换为短期env与dispose；不接受任意用户env，不保存或日志输出env/token。provider缺席/句柄失效在启动前拒绝。resolver在实际runId/cwd就绪后解析并绑定，finally/取消/卸载一定释放。news普通分析不传runContext。这是既有contribution机制中的小型执行上下文端口，不新增进程管理器或调度器。 短期runContext env只能在最终host.create/spawn合并，不能混入accountEnv、accountKey、持久session/history、hook配置或receipt；保持现有账户身份算法。即使keepTerminal=true，业务完成/取消/timeout也立即dispose授权，不能随终端保留。

本图只投影Ticket。功能优先，纵向交付，只有真实产物前置才建边；共享文件重叠由current全局串行和父serialization处理，不把排期偏好造为依赖。每票复用验证；成熟Ready表示合同完备，不代表依赖已实现或本轮有执行授权。

### 项目 Skill 读取矩阵

先完整读取Map，再读取对应Skill入口与ALL/本票命中reference，最后读取Ticket。矩阵是最低必读集合，不是allowlist；真正调用绑定见每票。

| Applies To | Project Skill | Trigger / Scope | Read Timing | Purpose |
|---|---|---|---|---|
| ALL | <Path>.agents/skills/dev/SKILL.md</Path> | 模块/源码/存储/构建/验证 | Map后、Ticket前 | 约束结构、真实Skill调用和验证 |
| T-01, T-02, T-03, T-04, T-05, T-06, T-07, T-08, T-09, T-10 | <Path>.agents/skills/ui/SKILL.md</Path> | 页面/组件/样式/交互 | Map后、Ticket前 | 三栏、tokens、焦点与真实宿主 |

## 2. 执行清单

| ID | Ticket | 可观察产出 | Blocked By | Depth | Risk | Ready | Owner | Contract IDs | Wave/Gate | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| T-01 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/ticket/01-raw-news-and-collection.md</Path> | 用户可启用新闻，在设置添加三种feed，试抓/刷新后读取原始资料并保存可编辑Markdown。 | — | deep | high | yes | Lead | AC-001, AC-002, AC-003, AC-004, AC-005, AC-021 | G-T-01 | ready |
| T-02 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/ticket/02-agent-structured-prompt-runner.md</Path> | 新闻可通过公开runner发送一段prompt，得到完整最后答案及用量；用户能处理权限、取消和超时。 | T-01 | deep | high | yes | Lead | AC-006, AC-007 | G-T-02 | ready |
| T-03 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/ticket/03-featured-analysis-and-receipts.md</Path> | 一次授权刷新产生可解释的中文精选与全部列表，拥有可靠批次结果、预算与重启行为。 | T-02 | deep | high | yes | Lead | AC-008, AC-009, AC-010, AC-011, AC-012 | G-T-03 | ready |
| T-04 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/ticket/04-event-occurrences-and-representative.md</Path> | 读者看到重复报道折叠，同一事件后续进展清晰，点击代表新闻不会被爆料或无关汇总抢占。 | T-03 | deep | high | yes | Lead | AC-013, AC-014 | G-T-04 | ready |
| T-05 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/ticket/05-hot-ranking-and-observation-history.md</Path> | 读者看到按独立参与方计算的热点、可比趋势和真实观测曲线，能理解尚无趋势的原因。 | T-04 | deep | high | yes | Lead | AC-015, AC-016, AC-017 | G-T-05 | ready |
| T-06 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/ticket/06-daily-edition-and-saved-views.md</Path> | 读者无需额外AI调用即可看今日要闻、保存个性筛选并在重启/分屏恢复。 | T-05 | deep | high | yes | Lead | AC-018, AC-019 | G-T-06 | ready |
| T-07 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/ticket/07-briefs-reader-actions-and-notifications.md</Path> | 用户从新闻详情生成带来源简报、打开原文或送入现有Agent输入，并收到幂等完成/失败通知。 | T-04 | deep | high | yes | Lead | AC-020, AC-022, AC-026 | G-T-07 | ready |
| T-08 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/ticket/08-home-news-widgets.md</Path> | 用户在统一首页组件库添加热点、精选、我的视图新闻组件，并能独立配置与导航。 | T-06 | deep | high | yes | Lead | AC-023 | G-T-08 | ready |
| T-09 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/ticket/09-opml-and-static-web-sources.md</Path> | 用户可迁移OPML订阅及添加无需登录的静态HTML列表信源，并看到试抓预览和错误。 | T-01 | standard | medium | yes | Lead | AC-024, AC-025 | G-T-09 | ready |
| T-10 | <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/ticket/10-reference-docs-and-runtime-acceptance.md</Path> | 一名读者按文档可完成新闻全流程，维护者能审查参考/差异和真实运行证据。 | T-07, T-08, T-09 | deep | high | yes | Lead | AC-027, AC-028 | G-T-10 | ready |

## 3. 依赖 DAG

```text
T-01 <- ROOT
T-02 <- T-01
T-03 <- T-02
T-04 <- T-03
T-05 <- T-04
T-06 <- T-05
T-07 <- T-04
T-08 <- T-06
T-09 <- T-01
T-10 <- T-07, T-08, T-09
```

## 4. 合同覆盖矩阵

| Contract ID | 覆盖 Ticket | 验证接缝 | 状态 | 说明 |
|---|---|---|---|---|
| AC-001 | T-01 | ModuleRegistry + News service lifetime；真实Obsidian module switch | covered | 每条必须有真实Evidence；无deferred |
| AC-002 | T-01 | 拟新增feed-reader纯归一化出口，requestUrl adapter | covered | 每条必须有真实Evidence；无deferred |
| AC-003 | T-01 | core/materials identity/revision | covered | 每条必须有真实Evidence；无deferred |
| AC-004 | T-01 | core/materials timeline clock fixtures | covered | 每条必须有真实Evidence；无deferred |
| AC-005 | T-01 | core/source-schedule clock fixtures + health UI | covered | 每条必须有真实Evidence；无deferred |
| AC-006 | T-02 | AGENT_PROMPT_RUNNER真实PTY/native hook/transcript | covered | 每条必须有真实Evidence；无deferred |
| AC-007 | T-02 | agent runtime/runner与真实terminal状态 | covered | 每条必须有真实Evidence；无deferred |
| AC-008 | T-03 | core/analysis parse + runner continuation | covered | 每条必须有真实Evidence；无deferred |
| AC-009 | T-03 | analysis-service durable receipt seam | covered | 每条必须有真实Evidence；无deferred |
| AC-010 | T-03 | analysis-service budget ledger + RunHistory | covered | 每条必须有真实Evidence；无deferred |
| AC-011 | T-03 | core/scoring fixture table + settings subscription | covered | 每条必须有真实Evidence；无deferred |
| AC-012 | T-03 | core/prompts build/version contract | covered | 每条必须有真实Evidence；无deferred |
| AC-013 | T-04 | core/grouping + analysis relation output | covered | 每条必须有真实Evidence；无deferred |
| AC-014 | T-04 | core/representative + event alias resolution | covered | 每条必须有真实Evidence；无deferred |
| AC-015 | T-05 | core/heat deterministic fixtures | covered | 每条必须有真实Evidence；无deferred |
| AC-016 | T-05 | core/heat coverage/cohort contract | covered | 每条必须有真实Evidence；无deferred |
| AC-017 | T-05 | HeatSnapshot read model + real HeatChart | covered | 每条必须有真实Evidence；无deferred |
| AC-018 | T-06 | core/edition deterministic fixtures + Markdown writer | covered | 每条必须有真实Evidence；无deferred |
| AC-019 | T-06 | NewsPage PageCreate getState/stateKeys + real restart | covered | 每条必须有真实Evidence；无deferred |
| AC-020 | T-07 | EventDetail/AnalysisDetail + BROWSER_OPEN/AGENT_SESSIONS | covered | 每条必须有真实Evidence；无deferred |
| AC-021 | T-01 | test/golden/user-formats.test.ts + vault notes | covered | 每条必须有真实Evidence；无deferred |
| AC-022 | T-07 | Brief request + runner + notes + detail | covered | 每条必须有真实Evidence；无deferred |
| AC-023 | T-08 | home public registry + NEWS_READ service | covered | 每条必须有真实Evidence；无deferred |
| AC-024 | T-09 | platform/opml adapter + source settings | covered | 每条必须有真实Evidence；无deferred |
| AC-025 | T-09 | platform/web-list-reader + source preview | covered | 每条必须有真实Evidence；无deferred |
| AC-026 | T-07 | NOTIFICATION_INBOX + NOTIFICATION_OPENERS | covered | 每条必须有真实Evidence；无deferred |
| AC-027 | T-10 | 现有pnpm脚本 + scripts/obsidian-acceptance/workbench-fresh-runtime.mjs | covered | 每条必须有真实Evidence；无deferred |
| AC-028 | T-10 | docs/third-party/aihot-news.md/.ZH.md + NOTICE + docs/news.md/.ZH.md | covered | 每条必须有真实Evidence；无deferred |

## 5. 并行与路径所有权

用户选择current/direct-parent，所有票与其它change全局严格串行。每次唯一implementation writer，Lead独占SpecDev状态、Evidence、父分支与E2E。main.js/styles.css为Lead生成物；根路由/共享API只能由父计划登记的owner票修改，消费者只读。

路径或语义资源交集只建立serialization，不能冒充功能依赖。父组合图列出所有无依赖对的串行锁；当前运行无实现owner、无worktree、无candidate。

## 6. Gate、Wave 与集成点

逐票Gate G-T-NN核对对应AC；域终验核对全部合同、真实host/平台、参考/迁移和数据保持；详见 <Path>{roots.state}/specdev/changes/2026-10-08-news-aihot/goal-plan.md</Path>。推荐顺序优先BUG，后共享接口，再产品消费者，但执行前读取父DAG。

## 7. 横切契约与风险

- 真实Claude/Codex账号与其余CLI能力是执行事实验证门，不能以静态阅读代替；T-02保留真实版本/账号输出证据和支持表。
- 六CLI transcript/argv能力不一致且hook有字符与UTF8双上限；能力驱动单通道、受测批量上限、completion元数据独立于全文。
- AI合批/输出axes相对AIHOT独立分步会改变品味；少量标注样本对照，不声称模型等价，不建过度benchmark平台。
- 事件若无occurrence层会使ROUNDUP桥接与日报/代表错误；保留最小内嵌层级与确定关系fixture。
- 新源/落后采集虚增趋势；cohort和缺失小时显式，拒绝0填充；本地不等于24/7监控。
- home registry/Agent公共contract并行领域冲突：由home拥有公共基础，本change依赖具体契约票，后续current串行执行。
- 原issue版本及路径过期，#135是否已解决需终端领域真实下载验收；不能盲修旧版本假设。

## 8. 同步规则

Ticket为status/ready/依赖/路径权威。变动递增plan_revision，重读Spec/Skill摘要并重算覆盖/父图，旧Evidence保留但标失效；不得从Map反写另造事实。

## 9. 总控与恢复

运行 <Path>{roots.workflows}/specdev/common/tools/ticket-control.mjs</Path> --map 本Map --repo 项目根，只读不实施。后续进入 <Path>{roots.workflows}/specdev/P-goal-plan/P-goal-plan.md</Path> run/resume，检查本Goal与父Goal、真实授权、依赖Evidence后再调用I。失败只阻塞相关闭包；所有票done仍必须域及整体验收。

## 整体父 Goal 约束

本change属于 <Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/implementation-map.md</Path>，调度权威为 <Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/implementation-plan.md</Path>。单独恢复本change也必须读取父图真实跨域边、Gate和全局current单writer策略；本地ready不解除父执行门。
