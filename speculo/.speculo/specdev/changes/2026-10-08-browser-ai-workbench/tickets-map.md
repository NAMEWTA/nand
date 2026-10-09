---
schema_version: 3
plan_contract_version: 1
plan_revision: 2
requested_deliverables: [{"name":"该领域完整Spec、Tickets Map与Goal Plan","count":1}]
deliverable_policy: "用户要求所有13个open issue完整按域规划，无指定Ticket数量；数量依真实垂直切片，所有AC必须覆盖。"
artifact: "tickets-map"
change: "2026-10-08-browser-ai-workbench"
status: "ready"
---

# Tickets Map: 浏览器快捷键修复与多 AI 工作台、受限网页助手

- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/spec.md</Path>
- Goal：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/goal-plan.md</Path>

## 1. 目标与拆分策略

先独立修复 #142 浏览器地址栏快捷键，再在现有 Obsidian 浏览器内交付真实可用的 DeepSeek/Kimi/ChatGPT 三站 PoC，以真实宿主证据为后续 Gate，逐站补齐八站、可靠保存迁移、可选综合、受限网页助手、用户指认与复用流程、本地 scoped 外接。用户已确认完整阶段范围、三站、共享默认加可选隔离 profile、当前轮 Markdown 与模板快照/来源、maiw v3 迁移、确定发送不引额外 LLM、综合/助手 opt-in 与本地 token bridge；本轮只规划，所有实现 ticket 保留未执行，current 严格串行。

### 总体实施背景

本地 HEAD 1b9121382363cc50254fbc973c24742b7742edc7。已有稳定 page id、逐页队列、epoch:revision 引用、webview 生命周期/权限/Design Mode、默认同 vault Electron partition、opt-in token IPC/CLI；BrowserModule.execute 对几乎全部命令都会 activate，后台读也抢目标焦点。无 task/turn/exchange、站点 adapter、持久 submit intent、当前轮回答采集或 profile 隔离。#142 地址栏只挂 DOM 冒泡 keydown，guest 另有 before-input-event；尚未实际运行修复或真实 AI 账号验证。只有 workbench/comments 两个注册 view；浏览器必须复用 workbench feature 与 NativeSurface。

拟定新增 browser/api.ts typed 服务 BROWSER_WORKSPACE 和 BROWSER_CONTROL（通过既有 ServiceKey 模式，api 文件不静态导入 core/platform）。BROWSER_WORKSPACE 提供 listTasks/getTask/subscribe/createTask/updateDraft/send/recollect/retrySave/retrySend/pause/takeover/resume/import/export；BROWSER_CONTROL 提供显式目标 observe/execute/cancel 与 profile 管理的稳定契约。执行输入 target={pageId,profileId,taskId?,generation}、owner={kind,id}、operation 与 abort signal；输出 identity、postcondition、evidenceRef 或 typed failure(reason,retryAction)，禁止 active-page fallback/任意 renderer webContents id/任意 CDP 指令跨模块公开。使用现有逐页队列，不能另造第二全局队列。

模型：WorkspaceTask{id,title,pinned,createdAt,updatedAt,turnIds,targetBindings}；TargetBinding{id,providerId,profileId,pageId,conversationId?,officialUrl?,accountLabel,verifiedAt?,generation,status}；Turn{id,taskId,sequence,question,finalPrompt,templateSnapshots:[{id,revision,title,body}],targetIds,createdAt}，创建后 prompt/targets 冻结；Exchange{id,turnId,targetId,attempts,submitState,acquisitionState,saveState,currentCaptureId,lastError?}；Attempt{id,intentPersistedAt,expectedIdentity,promptHash,dispatchStartedAt?,acceptedMessageId?,finishedAt?,outcome,evidenceRef?}；Capture{id,exchangeId,revision,source,adapterVersion,conversationId,messageId,parentId?,branchId?,markdown,complete,completenessReasons,terminalEvidence,capturedAt}。单调 revision 不允许迟到覆盖。unknown 表示已dispatch但无法确认，不等于未发送。

用户数据默认可见目录 NAND/AI 工作台/，browser namespaced setting workspaceFolder 可更改：<task-id>/任务.md 保存 task metadata/摘要；<task-id>/轮次/<turn-id>.md 保存问题/模板快照/target snapshot；<task-id>/回答/<exchange-id>.md 保存当前答案与来源/修订说明；提示词/<template-id>.md 保存模板。采用 DocumentRepository/MarkdownDocument 的 owned 字段/块保留用户未知 frontmatter 与块外笔记；稳定 UUID 文件名避免改名移动导致引用失效。原文 body 是用户内容，不藏为 runtime-only JSON；capture 历史仅保存有意义的完成/重采集修订，不每个 token 写一次。导出不包含 token/profile cookies/临时网络原始响应。

运行时 .nand/browser/<device-id>/workspace.json schemaVersion=1：持久 attempt journal、page bindings、未落盘 capture recovery reference、UI 恢复索引；使用 DurableState flush 作为 submit admission gate；读坏文件不给默认空对象覆盖，展示修复/备份入口。现有 state.json 保留 history/permissions 不改名。profiles.json schemaVersion=1 存 profileId/label/isDefault/createdAt，绝不存密码/cookies。default 分区保持 persist:nand-browser-<vault-id>；isolated 分区 persist:nand-browser-<vault-id>-profile-<profile-id>，profileId 为内部 UUID。删除 isolated profile 先显示受影响 target 并关闭 guest/撤权，明确删除本地登录数据；不可删除 default 标识。cookie store 在 Electron userData，不随 vault Markdown 复制。

BrowserSettings 扩 workspaceFolder、显式 feature opt-ins、profile UI preference，使用 settings.bind/update。跨窗口恢复只保存稳定 task/page/section/selected-turn/panel display keys，compose-workbench 的 stateKeys 显式扩展；组件不持有 durable task。新 UI 字符串迁入/使用模块 own i18n.ts 并在 module 加载注册，启动仍需的共享字典键保留到其 owner；不是新建重复翻译源。

maiw .maiw.jsonl v3 上限沿参考 50 MiB，UTF-8 逐行；允许的类型和关系以 pinned history-transfer.ts 为准，采用真实 export fixture 锁定。支持 sessions/turns/exchanges 的映射与官方 HTTPS URL allowlist，拒绝未知版本、孤儿关系、重复冲突 ID 和非官方来源链接；先预览范围，导入完成计数/跳过/冲突明确。export 写 v3 能表达的字段，NAND profile/task 扩展不假装可无损表达；本地完整 Markdown export 另入口。

集成所有权：home change 提供 agent/api.ts dispatch 与 automations/api.ts receipt 的共享合同，browser ticket 仅依赖和消费，具体依赖 home::T-07：AGENT_DISPATCH 请求 {invocationId,source:{kind,path,id},agentId,destination:{kind:fresh,cwd}|{kind:existing,sessionId},finalPrompt,files}；返回 delivery=started|pasted|timeout|rejected 与 runId/terminalId/error。started只表示启动，pasted仅粘贴待用户提交；completion/output 必须从owner receipt明确能力取得，不能解析整屏终端假装结构化输出或另建receipt。news 的结构化 CLI 输出也只由 news 交付。browser 自己拥有 BrowserWorkflowSpec 和适配器，contrib 经 automations public API 注册 source/action；共享 SourceRef/action 联合和 receipt 改动交 owner 票，不深导入实现。

外部授权 ScopedGrant{id,tokenHash,expiresAt,taskId?,allowedPageIds,allowedProfileIds,allowedOperations,revokedAt?}，token 只在创建时给调用方且只存 hash/内存必要材料，不写 connection.json/日志。现有 agentAccess=false 默认保留；grant 不替代 page ownership 或最终高后果确认。

综合/助手的共享派发限制：默认用户选择具备所需capability的既有配置agent；destination=fresh 才按公共合同自动启动，existing 的 pasted 状态明确“材料已粘贴，等待你提交”。模型任务完成与最终输出由 owning runtime/receipt 提供；结构化结果能力由 news::T-02 在 agent/api.ts 交付 AGENT_PROMPT_RUNNER，browser只消费；缺失则 capability-unavailable，不以终端整屏文本冒充最终输出。网页工具访问只通过当前本地 bridge 的安全运行环境/短期grant，token不得写finalPrompt、可见Markdown或receipt。browser向home owner提出需要的browser-workflow source/action贡献扩展，由home::T-07负责公开typed合同；browser本票仅实现contrib/runner，不改owner实现。

固定源证据：ORCA MIT https://github.com/stablyai/orca/tree/e3639ef8d69209b8278b41c0e722811960ea7ec0 ，必读 src/main/browser/browser-manager-registration.ts、agent-browser-bridge-tabs.ts、agent-browser-bridge-queue.ts、agent-browser-bridge-execution.ts、browser-session-registry.ts、agent-browser-bridge-lifecycle.ts、cdp-ws-proxy.ts、browser-manager-grab.ts；实际webview+hidden BrowserWindow，不是WebContentsView，agent-browser依赖~0.27.0。MAIW MIT https://github.com/NAMEWTA/multi-ai-browser-extension/tree/b6b83ca90f0f67fbf25a676e7a8f6b8b34327800 ，必读 src/entrypoints/background.ts、src/core/providers/base-dom-strategy.ts、src/core/acquisition/{engine,quality-gate}.ts、src/db/history-transfer.ts、八个 src/providers/<id>/ 全相关文件；参考的10分钟内存ledger和发送后落turn不是NAND可靠实现。详细已读文件/44条原issue immutable source+checksum、其他14项固定SHA/源码与官方平台资料见本change reference-analysis.md §§4/10/11/12；CONTEXT只保留规范术语。

共享自动结果合同（news::T-02 owner，位于agent公共API而非news业务）：AGENT_PROMPT_RUNNER 请求 {agentId,cwd,prompt,title,timeoutMs,signal?,reveal?,keepTerminal?,resultChannel?}；结果 {text,status:succeeded|failed|cancelled|interrupted|timeout,usage?,terminalId,errorCode?}，状态变化含running/needs-attention。browser的自动综合/助手只执行runner一次，不先AGENT_DISPATCH再runner；显式已有会话只粘贴走AGENT_DISPATCH。scope token通过现有browser安全运行环境传入，绝不写prompt；取消/timeout遵循runner真实进程停止语义，不停止无关手动terminal。用于browser-workflow的公开contribution接口由home::T-07拥有，browser T-19只注册自身runner。

执行上下文闭环：news T-02拥有agent/api AGENT_RUN_CONTEXTS contribution和runner可选runContext:{provider,handle}，browser T-16拥有内部scoped grant、resolver及bridge绑定，返回仅该run使用的env与dispose。T-20消费已完成内部scope能力构建外接授权管理；T-16不依赖T-20。grantId不是可重用长期token，权限检查仍在浏览器服务端。

本图只投影Ticket。功能优先，纵向交付，只有真实产物前置才建边；共享文件重叠由current全局串行和父serialization处理，不把排期偏好造为依赖。每票复用验证；成熟Ready表示合同完备，不代表依赖已实现或本轮有执行授权。

### 项目 Skill 读取矩阵

先完整读取Map，再读取对应Skill入口与ALL/本票命中reference，最后读取Ticket。矩阵是最低必读集合，不是allowlist；真正调用绑定见每票。

| Applies To | Project Skill | Trigger / Scope | Read Timing | Purpose |
|---|---|---|---|---|
| ALL | <Path>.agents/skills/dev/SKILL.md</Path> | 模块/源码/存储/构建/验证 | Map后、Ticket前 | 约束结构、真实Skill调用和验证 |
| T-01, T-02, T-03, T-04, T-05, T-06, T-07, T-08, T-09, T-10, T-11, T-12, T-13, T-14, T-15, T-16, T-17, T-18, T-19, T-20, T-21 | <Path>.agents/skills/ui/SKILL.md</Path> | 页面/组件/样式/交互 | Map后、Ticket前 | 三栏、tokens、焦点与真实宿主 |

## 2. 执行清单

| ID | Ticket | 可观察产出 | Blocked By | Depth | Risk | Ready | Owner | Contract IDs | Wave/Gate | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| T-01 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/01-browser-host-shortcuts.md</Path> | #142独立第一票；真实宿主地址栏按F立即输入查找、L选中地址，guest/笔记无回归。 | — | standard | medium | yes | Lead | AC-001, AC-002 | G-T-01 | ready |
| T-02 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/02-profile-page-control.md</Path> | 用户可保持旧登录并新增同站隔离账号；后续工作台可显式读/控某page而不抢前台或控制错页。 | — | deep | high | yes | Lead | AC-003, AC-004, AC-024, AC-026, AC-039 | G-T-02 | ready |
| T-03 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/03-deepseek-workspace-poc.md</Path> | 第一条真实可交付闭环：新task→DeepSeek真实新会话→输入预览→持久intent→发送确认→当前轮Markdown结果。 | T-02 | deep | high | yes | Lead | AC-005, AC-007, AC-010, AC-012, AC-016, AC-026 | G-T-03 | ready |
| T-04 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/04-kimi-workspace-poc.md</Path> | Kimi在既有任务/模板快照/持久intent/结果UI中完成真实发送与当前轮采集，作为三站PoC之一。 | T-03 | deep | high | yes | Lead | AC-013, AC-007, AC-016, AC-026 | G-T-04 | ready |
| T-05 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/05-chatgpt-workspace-poc.md</Path> | ChatGPT在既有任务/模板快照/持久intent/结果UI中完成真实发送与当前轮采集，作为三站PoC之一。 | T-03 | deep | high | yes | Lead | AC-014, AC-007, AC-016, AC-026 | G-T-05 | ready |
| T-06 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/06-multitarget-poc-gate.md</Path> | 用户对DeepSeek/Kimi/ChatGPT一次统一发送并看独立结果；gate由这套生产路径真实运行证明，后续八站票依赖其通过。 | T-03, T-04, T-05 | deep | high | yes | Lead | AC-006, AC-008, AC-009, AC-010, AC-011, AC-015, AC-024, AC-025 | G-T-06 | ready |
| T-07 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/07-current-answer-comparison.md</Path> | 同轮2–3答案可读比较、复制与单站追问，采集来源/完整性透明，迟到旧答案不会覆盖。 | T-06 | deep | high | yes | Lead | AC-016, AC-017, AC-018 | G-T-07 | ready |
| T-08 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/08-workspace-restart-recovery.md</Path> | 进程/guest退出、保存失败后可恢复事实和答案，无隐式重问；人工接管后可安全继续。 | T-07 | deep | high | yes | Lead | AC-011, AC-017, AC-020, AC-023, AC-025, AC-039 | G-T-08 | ready |
| T-09 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/09-claude-provider.md</Path> | Claude成为完整工作台目标，使用同一profile/turn/模板/结果/恢复契约，实际证明后加入支持表。 | T-06 | deep | high | yes | Lead | AC-027, AC-007, AC-016, AC-023, AC-026 | G-T-09 | ready |
| T-10 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/10-qwen-provider.md</Path> | 通义千问成为完整工作台目标，使用同一profile/turn/模板/结果/恢复契约，实际证明后加入支持表。 | T-06 | deep | high | yes | Lead | AC-028, AC-007, AC-016, AC-023, AC-026 | G-T-10 | ready |
| T-11 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/11-doubao-provider.md</Path> | 豆包成为完整工作台目标，使用同一profile/turn/模板/结果/恢复契约，实际证明后加入支持表。 | T-06 | deep | high | yes | Lead | AC-029, AC-007, AC-016, AC-023, AC-026 | G-T-11 | ready |
| T-12 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/12-coze-provider.md</Path> | Coze成为完整工作台目标，使用同一profile/turn/模板/结果/恢复契约，实际证明后加入支持表。 | T-06 | deep | high | yes | Lead | AC-030, AC-007, AC-016, AC-023, AC-026 | G-T-12 | ready |
| T-13 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/13-minimax-provider.md</Path> | MiniMax成为完整工作台目标，使用同一profile/turn/模板/结果/恢复契约，实际证明后加入支持表。 | T-06 | deep | high | yes | Lead | AC-031, AC-007, AC-016, AC-023, AC-026 | G-T-13 | ready |
| T-14 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/14-prompt-history-migration.md</Path> | 用户管理并复用问题模板，搜索/整理历史，明确范围导出并从MAIW v3可靠迁移。 | T-08 | deep | high | yes | Lead | AC-006, AC-019, AC-020, AC-021, AC-022 | G-T-14 | ready |
| T-15 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/15-optin-answer-synthesis.md</Path> | 用户明确选择答案/版本与既有agent会话后得到独立综合文档，普通官网统一发送仍零额外模型调用。 | T-07 | deep | high | yes | Lead | AC-018, AC-032 | G-T-15 | ready |
| T-16 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/16-scoped-web-assistant.md</Path> | 用户在指定page/profile/task范围让已有agent辅助完成网页步骤，看到结果证据并可随时同页接管。 | T-08 | deep | high | yes | Lead | AC-025, AC-033, AC-034, AC-039 | G-T-16 | ready |
| T-17 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/17-element-guidance-user-adapter.md</Path> | 用户可指认回答片段加入比较或解释区域，并把验证过的composer/submit/answer规则保存为明确override。 | T-07, T-15 | deep | high | yes | Lead | AC-018, AC-035 | G-T-17 | ready |
| T-18 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/18-reusable-browser-workflow.md</Path> | 用户把已验证的步骤保存成带变量的流程并手动运行/取消，看到每步前后条件和最终结果。 | T-16 | deep | high | yes | Lead | AC-025, AC-034, AC-036 | G-T-18 | ready |
| T-19 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/19-automation-browser-contribution.md</Path> | 在现有automations页面选浏览器流程、运行/可选调度，并用同一receipt查看取消/结果。 | T-18 | deep | high | yes | Lead | AC-037 | G-T-19 | ready |
| T-20 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/20-scoped-local-external-bridge.md</Path> | 外部agent在明确opt-in后获得短期page/profile/task/action有限权限，通过已有本地IPC操作同一guest并能撤回。 | T-16 | deep | high | yes | Lead | AC-024, AC-025, AC-034, AC-038, AC-039 | G-T-20 | ready |
| T-21 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/21-browser-delivery-evidence.md</Path> | 在已逐票功能完成基础上收束公开支持表、真实宿主使用指南、来源许可与产物一致性；不以这票替代前面真实验收。 | T-01, T-09, T-10, T-11, T-12, T-13, T-14, T-17, T-19, T-20 | standard | medium | yes | Lead | AC-002, AC-015, AC-027, AC-028, AC-029, AC-030, AC-031, AC-039, AC-040 | G-T-21 | ready |

## 3. 依赖 DAG

```text
T-01 <- ROOT
T-02 <- ROOT
T-03 <- T-02
T-04 <- T-03
T-05 <- T-03
T-06 <- T-03, T-04, T-05
T-07 <- T-06
T-08 <- T-07
T-09 <- T-06
T-10 <- T-06
T-11 <- T-06
T-12 <- T-06
T-13 <- T-06
T-14 <- T-08
T-15 <- T-07
T-16 <- T-08
T-17 <- T-07, T-15
T-18 <- T-16
T-19 <- T-18
T-20 <- T-16
T-21 <- T-01, T-09, T-10, T-11, T-12, T-13, T-14, T-17, T-19, T-20
```

## 4. 合同覆盖矩阵

| Contract ID | 覆盖 Ticket | 验证接缝 | 状态 | 说明 |
|---|---|---|---|---|
| AC-001 | T-01 | #142 native key path；BrowserPanel Scope | covered | 每条必须有真实Evidence；无deferred |
| AC-002 | T-01, T-21 | 真实Obsidian多窗口/切页；Scope生命周期 | covered | 每条必须有真实Evidence；无deferred |
| AC-003 | T-02 | BrowserStore/profile API + 真实guest partition | covered | 每条必须有真实Evidence；无deferred |
| AC-004 | T-02 | profile service/原生dialog/guest lifecycle | covered | 每条必须有真实Evidence；无deferred |
| AC-005 | T-03 | compose-workbench section/stateKeys + host截图 | covered | 每条必须有真实Evidence；无deferred |
| AC-006 | T-06, T-14 | Workspace UI + service订阅 | covered | 每条必须有真实Evidence；无deferred |
| AC-007 | T-03, T-04, T-05, T-09, T-10, T-11, T-12, T-13 | provider newConversation contract + live三站 | covered | 每条必须有真实Evidence；无deferred |
| AC-008 | T-06 | workspace precheck boundary | covered | 每条必须有真实Evidence；无deferred |
| AC-009 | T-06 | stage/readback/rollback contract | covered | 每条必须有真实Evidence；无deferred |
| AC-010 | T-03, T-06 | DurableState flush + BrowserControl mutation admission | covered | 每条必须有真实Evidence；无deferred |
| AC-011 | T-06, T-08 | exchange state machine + observed message identity | covered | 每条必须有真实Evidence；无deferred |
| AC-012 | T-03 | 真实Obsidian DeepSeek PoC证据 | covered | 每条必须有真实Evidence；无deferred |
| AC-013 | T-04 | 真实Obsidian Kimi PoC + pinned两页fixture | covered | 每条必须有真实Evidence；无deferred |
| AC-014 | T-05 | 真实Obsidian ChatGPT PoC + branch fixture | covered | 每条必须有真实Evidence；无deferred |
| AC-015 | T-06, T-21 | PoC执行记录与去敏感证据，不能fixture替代 | covered | 每条必须有真实Evidence；无deferred |
| AC-016 | T-03, T-04, T-05, T-07, T-09, T-10, T-11, T-12, T-13 | acquisition engine + adapter质量契约 | covered | 每条必须有真实Evidence；无deferred |
| AC-017 | T-07, T-08 | capture revision/store | covered | 每条必须有真实Evidence；无deferred |
| AC-018 | T-07, T-15, T-17 | AnswerComparison/Workspace service | covered | 每条必须有真实Evidence；无deferred |
| AC-019 | T-14 | PromptLibrary + Turn snapshot | covered | 每条必须有真实Evidence；无deferred |
| AC-020 | T-08, T-14 | task repository + history UI | covered | 每条必须有真实Evidence；无deferred |
| AC-021 | T-14 | export pure serializer | covered | 每条必须有真实Evidence；无deferred |
| AC-022 | T-14 | history-transfer pure boundary + real reference fixture | covered | 每条必须有真实Evidence；无deferred |
| AC-023 | T-08, T-09, T-10, T-11, T-12, T-13 | real guest lifecycle + journal reload | covered | 每条必须有真实Evidence；无deferred |
| AC-024 | T-02, T-06, T-20 | BrowserControl + existing per-page queue | covered | 每条必须有真实Evidence；无deferred |
| AC-025 | T-06, T-08, T-16, T-18, T-20 | ownership service + native page | covered | 每条必须有真实Evidence；无deferred |
| AC-026 | T-02, T-03, T-04, T-05, T-09, T-10, T-11, T-12, T-13 | desktop provider network capture | covered | 每条必须有真实Evidence；无deferred |
| AC-027 | T-09, T-21 | claude adapter API + 真实Obsidian单站记录 | covered | 每条必须有真实Evidence；无deferred |
| AC-028 | T-10, T-21 | qwen adapter API + 真实Obsidian单站记录 | covered | 每条必须有真实Evidence；无deferred |
| AC-029 | T-11, T-21 | doubao adapter API + 真实Obsidian单站记录 | covered | 每条必须有真实Evidence；无deferred |
| AC-030 | T-12, T-21 | coze adapter API + 真实Obsidian单站记录 | covered | 每条必须有真实Evidence；无deferred |
| AC-031 | T-13, T-21 | minimax adapter API + 真实Obsidian单站记录 | covered | 每条必须有真实Evidence；无deferred |
| AC-032 | T-15 | agent/api公共AGENT_PROMPT_RUNNER（news owner）/AGENT_DISPATCH（home owner） + Synthesis UI | covered | 每条必须有真实Evidence；无deferred |
| AC-033 | T-16 | assistant controller + shared agent receipt | covered | 每条必须有真实Evidence；无deferred |
| AC-034 | T-16, T-18, T-20 | typed scope admission + consequence dialog | covered | 每条必须有真实Evidence；无deferred |
| AC-035 | T-17 | existing grab/design + user adapter service | covered | 每条必须有真实Evidence；无deferred |
| AC-036 | T-18 | browser workflow runner + BrowserControl | covered | 每条必须有真实Evidence；无deferred |
| AC-037 | T-19 | automations/api公共source/action/receipt | covered | 每条必须有真实Evidence；无deferred |
| AC-038 | T-20 | existing bridge IPC + scoped grant API | covered | 每条必须有真实Evidence；无deferred |
| AC-039 | T-02, T-08, T-16, T-20, T-21 | module dispose + acceptance probe | covered | 每条必须有真实Evidence；无deferred |
| AC-040 | T-21 | pnpm build/lint/test:architecture/check:bundle/test:i18n/test:docs + host evidence | covered | 每条必须有真实Evidence；无deferred |

## 5. 并行与路径所有权

用户选择current/direct-parent，所有票与其它change全局严格串行。每次唯一implementation writer，Lead独占SpecDev状态、Evidence、父分支与E2E。main.js/styles.css为Lead生成物；根路由/共享API只能由父计划登记的owner票修改，消费者只读。

路径或语义资源交集只建立serialization，不能冒充功能依赖。父组合图列出所有无依赖对的串行锁；当前运行无实现owner、无worktree、无candidate。

## 6. Gate、Wave 与集成点

逐票Gate G-T-NN核对对应AC；域终验核对全部合同、真实host/平台、参考/迁移和数据保持；详见 <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/goal-plan.md</Path>。推荐顺序优先BUG，后共享接口，再产品消费者，但执行前读取父DAG。

## 7. 横切契约与风险

- AI官网DOM/网络格式/防护随时变化：每站adapter带version/能力支持表，失败明确原因，停留原页供人工操作，不删除安全隔离或新增猜测兜底。
- Obsidian guest隐藏输入、SSO/passkey可能不可行：真实三站源码PoC gate记录限制；阻塞对应adapter后续readiness，不伪造passed、不换独立浏览器架构而不更新决策。
- 发送后进程崩溃无法证明官网exactly-once：先journal、事后消息identity、unknown不自动重发；用户明确重发显示可能重复。
- isolated profile与旧默认登录迁移：default partition字节保持，新增隔离不复制cookie，活动page不可原地换partition；删除必须用户明确选择。
- 保存失败或用户编辑文档：DocumentRepository保留未知内容，flush失败不发/已发答案保存到recovery，retry-save不重问；坏文件不覆盖。
- 共享owner并行演化：home dispatch/receipt 与 browser消费者以公共API契约锁定；current严格串行，父计划插入外部依赖，不各自造agent scheduler。
- 研究资料不代表真实通过：PoC/每站验收有真实host版本/账号label/轮次/时间/证据路径，截图去敏感；当前规划不得改用户支持文档为已实现。

## 8. 同步规则

Ticket为status/ready/依赖/路径权威。变动递增plan_revision，重读Spec/Skill摘要并重算覆盖/父图，旧Evidence保留但标失效；不得从Map反写另造事实。

## 9. 总控与恢复

运行 <Path>{roots.workflows}/specdev/common/tools/ticket-control.mjs</Path> --map 本Map --repo 项目根，只读不实施。后续进入 <Path>{roots.workflows}/specdev/P-goal-plan/P-goal-plan.md</Path> run/resume，检查本Goal与父Goal、真实授权、依赖Evidence后再调用I。失败只阻塞相关闭包；所有票done仍必须域及整体验收。

## 整体父 Goal 约束

本change属于 <Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/implementation-map.md</Path>，调度权威为 <Path>{roots.state}/specdev/changes/2026-10-08-all-open-issues/implementation-plan.md</Path>。单独恢复本change也必须读取父图真实跨域边、Gate和全局current单writer策略；本地ready不解除父执行门。
