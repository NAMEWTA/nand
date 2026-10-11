---
schema_version: 3
artifact: "spec"
change: "2026-10-08-browser-ai-workbench"
status: "ready"
ready_for_tickets: true
sources: ["<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/source.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/reference-analysis.md</Path>","USER-DECISION:2026-10-08/09完整规划、BUG修复票、current串行与已确认设计"]
---

<!-- ACCEPTANCE-20261011:START -->
2026-10-11 完成与归档记录：[最终验收](evidence/completion.md)。用户确认本轮以 Windows 验收为准，真实账号及其他平台保留未验证记录，不再作为本轮完成阻塞。历史规划与早期审查原文保留；当前状态、授权、提交和验收结论以本补充及正式状态为准。
<!-- ACCEPTANCE-20261011:END -->


# Spec: 浏览器快捷键修复与多 AI 工作台、受限网页助手

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查与修复：[review-index.md](evidence/review-index.md)，覆盖本 change 的 21 票、40 条 AC。下文保留原规划目标与当时基线，不能把“尚未实现／本轮只规划”当成当前代码状态。当前源码与接口以审查证据及 owner 的 `api.ts` 为准；未验证的账号或平台仍未验证，原 AC 没有删减。
<!-- ACTUAL-CODE-REVIEW:END -->

- ADR：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ADR.md</Path>
- CONTEXT：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/CONTEXT.md</Path>
- 引用对照：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/reference-analysis.md</Path>

## 1. 问题与目标

### 问题陈述

先独立修复 #142 浏览器地址栏快捷键，再在现有 Obsidian 浏览器内交付真实可用的 DeepSeek/Kimi/ChatGPT 三站 PoC，以真实宿主证据为后续 Gate，逐站补齐八站、可靠保存迁移、可选综合、受限网页助手、用户指认与复用流程、本地 scoped 外接。用户已确认完整阶段范围、三站、共享默认加可选隔离 profile、当前轮 Markdown 与模板快照/来源、maiw v3 迁移、确定发送不引额外 LLM、综合/助手 opt-in 与本地 token bridge；本轮只规划，所有实现 ticket 保留未执行，current 严格串行。

### 规划时基线

本地 HEAD 1b9121382363cc50254fbc973c24742b7742edc7。已有稳定 page id、逐页队列、epoch:revision 引用、webview 生命周期/权限/Design Mode、默认同 vault Electron partition、opt-in token IPC/CLI；BrowserModule.execute 对几乎全部命令都会 activate，后台读也抢目标焦点。无 task/turn/exchange、站点 adapter、持久 submit intent、当前轮回答采集或 profile 隔离。#142 地址栏只挂 DOM 冒泡 keydown，guest 另有 before-input-event；尚未实际运行修复或真实 AI 账号验证。只有 workbench/comments 两个注册 view；浏览器必须复用 workbench feature 与 NativeSurface。

### 目标用户与场景

- 作为浏览器用户，我在地址栏直接按平台 Mod+F/Mod+L 即可查找或选中地址，切回笔记后宿主热键正常。
- 作为比较模型回答的用户，我选择若干具体站点账号、预览最终问题、一次发送，看到每站独立进度和同一轮可溯源答案。
- 作为多账号用户，我在同一站使用共享或隔离登录环境，始终知道问题会发往哪个账号和官网会话。
- 作为反复研究的用户，我复用提示词、按轮比较与单站追问、恢复历史并迁移 maiw 数据，不丢失旧结果也不意外重问。
- 作为需要辅助操作的用户，我单独开启有范围的网页助手，随时暂停接管原页面，确认具体高后果动作后再执行。
- 作为自动化用户，我复用已验证步骤，通过既有自动化入口运行/调度，或给外部 agent 短期有限的本地访问权并可撤回。

### 成功标准

全部AC以真实用户行为和文件/接口结果判断。已有功能通过核销保持，BUG必须得到对应修复和证据；本轮产物成熟不等于功能已完成。

### 非目标

- 不实现完整日常浏览器、Chromium fork、独立云浏览器集群或企业跨环境 Grid；其参考仅记录取舍。
- 不统一附件上传、模型切换、thinking 开关；站点显示不可靠的模型元数据记 unknown。
- 不镜像全部官网历史/所有分支/附件，不导出 cookie/secret，不保证一键迁移 Chrome 登录、Google SSO 或 OS passkey。
- 不把多模型一致当真实性验证；不自动投票，不用视觉/LLM 做固定发送的无界兜底。
- 不默认开放远程端口、无人值守支付/发布/删除，不把 WebMCP early preview 当八站现有能力。

## 2. 解决方案与外部行为

入口和快捷键：#142 独立先交付。BrowserPanel 中宿主 Scope 与 guest before-input-event 复用 openFind/focusAddress，只有可见且当前焦点属于此浏览器时接管 Mod+F/L；隐藏/切换/销毁/popout 迁移释放。IME 与 Esc 现有设计/抓取/查找优先级保持。

多 AI 是 browser feature 的 section=multi-ai，网页助手是 section=assistant；两者不新增 view type。侧栏为任务列表和搜索/新任务，顶部可见 target（provider、账号标签/profile、官网 conversation、新/已有状态），中央在真实页面与当前轮结果间切换，底部最终问题/模板预览和发送。面板显示开关/顺序/刷新/最大化/宽度与发送目标集合独立；支持 select all/none、2–3 个主面板其余状态项、窄屏一个焦点面板。双语文案不能宣称未验证 provider 已稳定支持；移动端保留可读 Markdown/结果，官网控制标明 desktop only。

新任务与目标：创建本地 task 后，为每个目标执行站点明确的新会话动作并核验 conversation identity/空上下文证据；只导航首页不等于新会话。同站不同账号用 profile 分区区分。恢复历史绑定必须核验当前 profile 可访问相同官方 conversation；不可访问只保留本地结果和重新登录/显式绑定入口。用户可主动再次提交相同问题，两次产生不同 turn，不能按文本/URL去重。

统一发送：点击预览后的发送即授权这些 target 的普通提问，无每一步额外确认。先冻结 turn.promptSnapshot/templates/target IDs，持久保存 task/turn 和 attempt intent 并 await flush；失败则不向官网写入。默认对全部选中目标只读 precheck：登录/验证码/页面身份/忙碌/原草稿/输入可用；任一未就绪都不 stage。用户明确选择“仅向就绪目标发送”才缩小本次目标快照。stage 填入并读回最终文本；任一失败只回滚仍与该 attempt 文本完全匹配且未被人工改动的已 stage 输入。commit 逐页队列执行，须有目标消息或输入消失/生成起始等站点已验证接受证据才能标 submitted。多站并非事务，某站提交失败不撤销他站官网事实。

状态分层：target binding 显示 ready/login-required/challenge/busy/identity-mismatch；每个 exchange 发送阶段为 queued/checking/staged/submitting/submitted/unknown/failed/cancelled，采集阶段为 idle/generating/complete/incomplete/failed，保存阶段为 pending/saved/save-failed。UI 汇总明确待发送、准备、已发送、生成中、已完成、不完整、失败、未知、保存失败，保留原因。点击后通道丢失无法确定结果时停在 unknown，不自动重发；先 observe 验证已存在消息，不能确定则用户自己决定“重新发送（可能重复）”。重新采集只读已绑定消息，保存重试只持久已有 capture。

采集：每站 adapter 给出 conversation/message/parent/branch identity 与终态证据，绑定当前 turn。优先使用经实际验证且仅限 allowlisted endpoint 的站点数据，其次目标回答原生复制，最后目标消息 scoped DOM；无验证的策略不启用，无全局抓取/无限回退/LLM补全文。每个 capture 仅一个来源，保留 heading/table/code/math 和来源信息，title/status-only/空/分页未终止/虚拟DOM缺段均不能 complete；当前 branch 和 terminal 信息不足则 incomplete+具体原因。原生复制不污染用户剪贴板。capture revision 单调，迟到旧 revision 不覆盖新结果；最新 partial 不能回退旧 complete 冒充当前完成。

阅读与历史：按 task→turn→target 展示，用户选2–3答案对比、复制一个答案、只追问一个目标、定位原官网消息。原文、综合结论及用户注释独立保存，模型未知不推断。提示词库新增/编辑/删除/排序、多选按顺序组合，发送前完整预览；turn 持有当时正文快照，库修改不改历史。历史搜索/改名/置顶/删除/切换/详情，删除仅本地 owned 文档需明确范围，不删除官网记录。复制/Markdown export 分当前任务/单站/最新轮。maiw v3 导入先解析预览、版本/大小/计数/域名校验，再合并；外部 ID 稳定映射，重复导入不重复建记录，冲突给结果报告；不承诺格式本来没有的完整 snapshots/独立模板库。

暂停与恢复：所有自动 mutation 绑定 task/page/profile/guest generation 与执行权。队列入队固定目标，执行前重验，页面切前台不改变目标。后台 read 不抢焦点；确需 native focus 的 input 显式调度并报告限制。pause/stop/human takeover 撤销新 mutation admission；已派发动作根据可见证据完成或 unknown，不能谎称已撤销。human 在同一页面操作，resume 必须重新观察身份、草稿、refs。关闭/替换 guest/模块关闭释放 listener/队列/bridge；重启只恢复已证实事实和待核对状态，不自动继续 submit。

后续能力：综合/网页助手均单独 opt-in，通过 agent owning API 指定可用 agent/运行目的地和材料/目标范围，不由 browser 启新进程。综合保留所选答案版本及引用，输出与原文分离；自动执行消费AGENT_PROMPT_RUNNER，existing粘贴只显示待用户提交，不当作模型完成。助手显示步骤、当前页、授权范围、结果证据；网页文字为数据不能扩大范围；支付/发布/删除等高后果动作在执行前展示具体对象/内容/目的地供本次确认，拒绝/取消即停止对应动作。元素指认复用 Design Mode，可加回答片段到比较或解释区域；用户指定 composer/submit/answer 生成候选 adapter，预览并真实单次验证后才保存为用户 override，有撤回且不改内建规则。流程为有限步骤/变量/前置/结果，运行复用同一控制和 ownership；需要计划时贡献给 automations owner，receipt 与取消行为消费已有 API。外部客户端只在用户 opt-in 后拿本地短期 scoped token，page/profile/task/action allowlist、撤回/到期、owner冲突明确，不允许绕过相同队列和高后果确认。

### 状态、失败与不变量

失败必须停在明确步骤并保留用户内容；生命周期与兼容细节遵循以下数据合同。参考事实、当前代码事实、设计选择分开记录，未实测结果不当作行为保证。

## 3. 用户故事

- **US-001**：作为浏览器用户，我在地址栏直接按平台 Mod+F/Mod+L 即可查找或选中地址，切回笔记后宿主热键正常。
- **US-002**：作为比较模型回答的用户，我选择若干具体站点账号、预览最终问题、一次发送，看到每站独立进度和同一轮可溯源答案。
- **US-003**：作为多账号用户，我在同一站使用共享或隔离登录环境，始终知道问题会发往哪个账号和官网会话。
- **US-004**：作为反复研究的用户，我复用提示词、按轮比较与单站追问、恢复历史并迁移 maiw 数据，不丢失旧结果也不意外重问。
- **US-005**：作为需要辅助操作的用户，我单独开启有范围的网页助手，随时暂停接管原页面，确认具体高后果动作后再执行。
- **US-006**：作为自动化用户，我复用已验证步骤，通过既有自动化入口运行/调度，或给外部 agent 短期有限的本地访问权并可撤回。

## 4. 验收合同

| ID | 前置条件 | 动作或事件 | 可观察结果 | 验证接缝 |
|---|---|---|---|---|
| AC-001 | 真实Obsidian浏览器地址栏/toolbar/find获得焦点 | 按平台 Mod+F、输入domain，再Mod+L | F打开并聚焦find；文字不进地址；L选中完整地址；无宿主checklist动作，每按一次只响应一次 | #142 native key path；BrowserPanel Scope |
| AC-002 | guest、普通workbench/focus-mode split、modal、popout各有浏览器 | 在各处使用F/L/Esc并切到笔记或关闭/移窗/disable模块 | guest既有行为保持；只当前page响应；Esc顺序保持；hidden/旧window不抢键，无handler累积；IME不打断 | 真实Obsidian多窗口/切页；Scope生命周期 |
| AC-003 | 旧vault已有默认浏览器登录 | 升级后创建isolated profile并同站登录另一账号，重启 | 旧default partition不变；两账号target标识可辨且登录隔离保持；未验证账号身份不自动猜 | BrowserStore/profile API + 真实guest partition |
| AC-004 | 两个profile和活动target | 尝试切profile或删除isolated profile | 切换创建新guest并重新绑定；删除先展示受影响对象再关闭guest撤权清本地登录；default标识不可删除；官网历史不删 | profile service/原生dialog/guest lifecycle |
| AC-005 | browser模块开启 | 打开multi-ai/assistant与普通浏览器并切窄宽屏 | 沿用shell侧栏/page/focus-mode，不增view/router；目标含账号/会话，2–3主面板其余状态，窄屏单焦点；结果可读 | compose-workbench section/stateKeys + host截图 |
| AC-006 | 已有多个官网page | 改面板显示/排序/宽度/最大化，select all/none发送目标 | 显示面板集合与发送集合互不隐式改变；草稿跨切页保留；刷新或外部原文入口不偷偷创建submit | Workspace UI + service订阅 |
| AC-007 | 三站已登录有现成官网会话 | 新建本地task并发送前观察 | 逐target执行并验证真正新官网上下文；仅home URL不算成功；保留旧任务；失败目标显式阻止提交 | provider newConversation contract + live三站 |
| AC-008 | 一个target未登录/验证码/忙碌/存在未授权草稿 | 默认统一send；再显式选择仅就绪目标 | 默认无target被stage/submit；逐站原因可见；仅就绪动作冻结新的明确目标集，未就绪不被写入 | workspace precheck boundary |
| AC-009 | 全部precheck通过且已stage部分target | 其余stage失败或用户改动已有stage文本 | 只清仍与该attempt写入完全相同的owned draft；用户新草稿保留；没有commit；原因与retry入口准确 | stage/readback/rollback contract |
| AC-010 | 发送问题已预览且选择目标 | 记录intent时模拟持久写失败，然后恢复重试 | 持久失败时官网零mutation；成功flush后每attempt才允许一次commit；重复相同问题主动第二次提交生成新turn | DurableState flush + BrowserControl mutation admission |
| AC-011 | 一个target提交后通道断开，其余成功 | 等待结果并点击重新采集/保存重试 | 断开target是unknown，成功答案保留；不自动整组重发；recollect只读同消息，retry-save不发送；明确重发才新attempt | exchange state machine + observed message identity |
| AC-012 | DeepSeek真实账号、实现adapter | 执行三轮含重复问题/长结构化答案、新会话及单站流程 | 正确输入读回、提交确认、当前parent-child answer、Markdown与terminal；页面可人工接管；非仅打开站点 | 真实Obsidian DeepSeek PoC证据 |
| AC-013 | Kimi真实账号、实现adapter | 执行三轮richtext/跨页消息与长答案 | 正确会话/消息链、分页到终止或明确incomplete、当前轮Markdown；提交与采集证据可查 | 真实Obsidian Kimi PoC + pinned两页fixture |
| AC-014 | ChatGPT真实账号、实现adapter | 执行三轮并使用分支/切会话情境 | 只采当前branch节点的当前轮；登录/防护停在可操作页，不绕过；确认新会话及真实提交 | 真实Obsidian ChatGPT PoC + branch fixture |
| AC-015 | 三站实现闭环已存在 | 在真实宿主跑连续三轮、长文、新会话、重启、单站失败并汇总 | 每站和全组各有分母/发送确认/采集/完整性/关联/重复/人工/恢复/耗时；账号/OS缺失标未验证；无已知错发/自动重发/假complete才开后续Gate | PoC执行记录与去敏感证据，不能fixture替代 |
| AC-016 | 采集同turn多个候选来源或长回答 | 执行data→copy→DOM已验证策略 | 选单个合格来源；source/version/identity可查；heading/table/code/math保存；空/title/status-only、缺页或无终态不标complete；原生copy不污染剪贴板 | acquisition engine + adapter质量契约 |
| AC-017 | 新capture已生成，旧capture迟到或新capture不完整 | 刷新/重新采集 | 旧revision不覆盖新结果；latest partial不显示旧complete冒充；历史完成快照仍可明确查看；save-failed内容可恢复 | capture revision/store |
| AC-018 | 同轮已有2–3答案 | 选择比较、复制一个、单站追问、打开原文 | 按轮/目标对齐，追问只发所选站；打开对应会话/消息；unknown模型不编造；原文与综合独立 | AnswerComparison/Workspace service |
| AC-019 | 有不同模板及历史轮次 | CRUD/排序/多选模板，预览提交，再改模板 | finalPrompt顺序与预览一致；历史turn保留当时模板id/version/title/body不可变快照；未发草稿保留 | PromptLibrary + Turn snapshot |
| AC-020 | 持久历史与登录状态存在 | 搜索/改名/置顶/切换/查看详情/删除本地任务 | 稳定ID不变、结果按轮；删本地不删官网，owned边界明确；profile无权限/失效则只读本地并提示重绑 | task repository + history UI |
| AC-021 | 已选任务/站点/最新轮 | 复制或导出Markdown | 导出范围与选择一致，含问题/答案/来源/完整性；不含cookies/token/原始网络包 | export pure serializer |
| AC-022 | 真实maiw v3 .maiw.jsonl样本 | 预览并导入、重复导入、导出再导入 | session/turn/exchange映射正确，统计匹配、重复不倍增；非法版本/超50MiB/孤儿/非官方URL拒绝且无部分污染；缺snapshots/templates限制明确 | history-transfer pure boundary + real reference fixture |
| AC-023 | 交换已派发/采集中/保存失败 | 关闭guest、替换guest、重启或disable模块后恢复 | 已证实结果恢复，未确认保留unknown，不自动submit；capture恢复后retry-save可成功；listener/queue/bridge释放 | real guest lifecycle + journal reload |
| AC-024 | 两页各有目标与队列 | 读后台页、切前台、操作旧ref/关闭目标 | read不抢焦点；执行仍绑定显式page/profile/generation；旧ref明确失败；关闭后queued settle且无迟到mutation | BrowserControl + existing per-page queue |
| AC-025 | 自动执行中 | pause/takeover人工同页操作，再resume | 停止新mutation；已dispatch事实明确完成/unknown；resume重验identity/draft/ref，不使用过期引用；人工操作不被旧执行抢回 | ownership service + native page |
| AC-026 | adapter在目标页面采集 | 观察network instrumentation与诊断导出 | 仅该provider allowlist/该task采必要字段；token/cookie/password被剔除，默认无全网HAR；卸载或取消移除hook | desktop provider network capture |
| AC-027 | Claude真实账号和单站adapter | 三轮、新会话、长答案、重启/单站失败；重点稳定message identity/terminal/richtext | 实际提交与当前轮采集通过，共用profile/turn/状态UI；不完整诚实显示；源码fixture不替代支持证据 | claude adapter API + 真实Obsidian单站记录 |
| AC-028 | 通义千问真实账号和单站adapter | 三轮、新会话、长答案、重启/单站失败；重点detail/alternate/partial形态与branch | 实际提交与当前轮采集通过，共用profile/turn/状态UI；不完整诚实显示；源码fixture不替代支持证据 | qwen adapter API + 真实Obsidian单站记录 |
| AC-029 | 豆包真实账号和单站adapter | 三轮、新会话、长答案、重启/单站失败；重点消息链分页终止及同轮关联 | 实际提交与当前轮采集通过，共用profile/turn/状态UI；不完整诚实显示；源码fixture不替代支持证据 | doubao adapter API + 真实Obsidian单站记录 |
| AC-030 | Coze真实账号和单站adapter | 三轮、新会话、长答案、重启/单站失败；重点经验证的目标native copy→scoped DOM而非虚构API | 实际提交与当前轮采集通过，共用profile/turn/状态UI；不完整诚实显示；源码fixture不替代支持证据 | coze adapter API + 真实Obsidian单站记录 |
| AC-031 | MiniMax真实账号和单站adapter | 三轮、新会话、长答案、重启/单站失败；重点chat/agent官方host和目标native copy→scoped DOM | 实际提交与当前轮采集通过，共用profile/turn/状态UI；不完整诚实显示；源码fixture不替代支持证据 | minimax adapter API + 真实Obsidian单站记录 |
| AC-032 | 本地有多站答案且未启用综合 | 普通统一发送；再opt-in选会话与材料范围执行综合 | 普通send零额外LLM；综合显示材料/目标agent，自动路线仅调用AGENT_PROMPT_RUNNER一次得到完整结果；existing路线仅dispatch/pasted等待提交；结果与capture版本关联且不改原文。 | agent/api公共AGENT_PROMPT_RUNNER（news owner）/AGENT_DISPATCH（home owner） + Synthesis UI |
| AC-033 | 用户opt-in网页助手并选page/profile/action范围 | 给任务、看步骤/结果、暂停/停止/接管 | 助手只在授权page/action执行，复用BrowserControl/ownership和公共AGENT_PROMPT_RUNNER；needs-attention/取消/结果postcondition可见，无browser自建agentprocess或CLI reader。 | assistant controller + shared agent receipt |
| AC-034 | 网页含恶意扩大权限文本或助手拟支付/发布/删除 | 尝试执行越界/高后果动作 | 页面文本不授权；越界拒绝；高后果展示对象/内容/目的地最终确认，拒绝无mutation；原有普通提问不加逐步确认 | typed scope admission + consequence dialog |
| AC-035 | Design Mode可选元素/区域 | 选答案段加入比较或解释；指定composer/submit/answer | 用户选择和来源保留；候选adapter可预览、单次真实验证后才保存override；验证失败不启用，撤回回内建规则 | existing grab/design + user adapter service |
| AC-036 | 已有验证步骤与变量 | 保存、编辑、运行复用流程并取消/查看记录 | 有限step/variable schema、pre/postcondition与run结果可见；复用同队列/ownership；取消后不派发新动作，unknown诚实 | browser workflow runner + BrowserControl |
| AC-037 | 流程可手动跑，home共享automations receipt已交付 | 从现有automations选择浏览器流程并手动或定时运行 | 通过公开contribution API注册，run receipt/取消/打开结果统一；无第二scheduler，后台高后果确认不能绕过 | automations/api公共source/action/receipt |
| AC-038 | agentAccess默认关闭 | opt-in创建scoped grant，外部请求允许/越界/过期/撤回操作 | 默认不接入；token只本地安全通道展示，范围按task/page/profile/op验证；越界/过期撤回拒绝，owner冲突明确；同一高后果gate | existing bridge IPC + scoped grant API |
| AC-039 | 模块开启且跨多窗口运行 | disable/enable并查看resources、导出诊断 | 无残留guest hook/listener/queue/bridge/LLM会话owned任务；诊断去敏感；不破坏其他模块与普通浏览器 | module dispose + acceptance probe |
| AC-040 | 功能实现准备交付 | 运行规定检查并对照八站/OS支持表与双语文档 | lazy/boundary/bundle/i18n/CSS/docs通过；仅实测项写支持；参考来源/NOTICE准确，main.js/styles.css随源重建；无本轮规划冒充实现 | pnpm build/lint/test:architecture/check:bundle/test:i18n/test:docs + host evidence |

用户故事覆盖：上述故事分别由同类正常/边界AC共同验证，逐AC唯一负责票见Tickets Map。

## 5. 范围

### IN

- #142 浏览器 chrome/guest 两条输入路径统一动作、局部 Scope 生命周期及真实宿主回归。
- browser feature 下 multi-ai 与 assistant 页面，shell 侧栏任务/历史、目标账号/会话、官网与结果切换、统一输入与逐站进度；2–3 主视图及窄屏单焦点。
- 共享默认及隔离 profile，同 provider 多 target、登录与新官网会话验证、明确页面绑定、可见暂停/接管/恢复。
- 全 ready 默认的 precheck→stage/readback→commit；精确回滚；durable intent；部分成功和 unknown；重采集、重发、保存重试分离。
- 全部八站适配及真实支持矩阵；source 选择、当前消息/分支/分页/终态、Markdown 原文、快照修订与质量说明。
- prompt CRUD/排序/多选/预览/冻结；task history search/rename/pin/delete/switch/detail；按轮阅读/2–3答案比较/单站追问/原文定位；明确范围复制导出和 maiw v3 迁移。
- 可靠 Markdown 保存与重启恢复、局部保存失败可恢复；非伪 exactly-once，不自动重新发送不确定操作。
- 可选综合、受限网页助手、元素/区域指认、经单次验证的用户 adapter、可复用 steps/variables/runs、自动化贡献和本地 scoped 外接。
- 全文十四章/附录及所有指定参考的固定来源映射、许可证/来源归属、源码与真实运行证据区分。

### REUSE

- BrowserModule/page/presentation、BrowserOperationQueue、snapshot epoch:revision、debugger lease、guest permissions、Design Mode/markup、bridge/token/CLI。
- 现有 workbench feature browser、NativeSurface、PanelModel、focus-mode 页面与视图生命周期；不新增 view/router/tab system。
- DocumentRepository/markdown-document 保留非拥有内容；DurableState 的 flush/error/recovery；namespaced settings；Preact/primitives/tokens。
- agent/api.ts 由 home 专票交付的 dispatch / normalized receipt；attachMaterial 仍仅粘贴，不能当 dispatch。automations/api.ts 既有 scheduler/run 与 home 专票 receipt。
- news 的结构化 CLI 输出由 news 专票拥有；browser 如消费仅经公开 API/receipt，禁止另建 CLI provider SDK、agent 进程底座或 scheduler。

### OUT

- **OOS-001**：不实现完整日常浏览器、Chromium fork、独立云浏览器集群或企业跨环境 Grid；其参考仅记录取舍。
- **OOS-002**：不统一附件上传、模型切换、thinking 开关；站点显示不可靠的模型元数据记 unknown。
- **OOS-003**：不镜像全部官网历史/所有分支/附件，不导出 cookie/secret，不保证一键迁移 Chrome 登录、Google SSO 或 OS passkey。
- **OOS-004**：不把多模型一致当真实性验证；不自动投票，不用视觉/LLM 做固定发送的无界兜底。
- **OOS-005**：不默认开放远程端口、无人值守支付/发布/删除，不把 WebMCP early preview 当八站现有能力。

## 6. 已锁定实现约束

- **DEC-001**：按可交付源码三站 PoC → 八站完整适配 → 可靠历史与迁移 → 可选综合/受限助手 → 用户指认/可复用流程与本地外接推进；最终不缩为研究或三站。PoC Gate 只决定后续 readiness，不删除后续票。 来源：LOG-001；用户本轮五项推荐全部确认；#145 §§9–14。
- **DEC-002**：DeepSeek、Kimi、ChatGPT；真实登录三轮、长回答、新会话、重启、单站失败必须测。账号由用户在受控测试 vault 登录，不创建付费账号、不抓取现有个人 Chrome 凭据。 来源：LOG-002；用户本轮明确选择；#145 §11。
- **DEC-003**：保留现有 default shared profile；首版加入显式 isolated profiles 支持同站多账号。隔离 profile 创建新 guest 分区，禁止对运行中 guest 换 partition；当前change ADR扩展可选能力，永久 ADR-0010 只读，实施后再按 A 流程提升。 来源：LOG-003；用户本轮明确选择；ORCA session registry；NAND ADR-0010。
- **DEC-004**：可见 Markdown 保存 task/turn 问题、模板不可变快照、当前轮原文及来源；maiw v3 映射导入导出。默认不镜像全部官网历史、附件、全部分支或 cookies。 来源：LOG-004；用户本轮明确选择；#145 §§3/10/14。
- **DEC-005**：保留已成功结果；unknown 只观察核对或人工确认，不自动整组重发。recollect/save retry/resend 为不同明确动作；持久 intent 成功后才能提交。 来源：LOG-005；#145 §9/§11；本轮用户接受推荐。
- **DEC-006**：统一发送/站点采集不调用额外模型；综合和助手独立 opt-in，显式选择 agent 会话/能力与材料范围。复用 home owner 提供的 agent dispatch / automation receipt API；外接走现有本地 token IPC 的 scoped grant。 来源：LOG-006；用户本轮明确选择；父任务跨 change owner 合同。
- **DEC-007**：按 dev/ui 技能与目录规则实施，运行时规划中文由用户特批；产品 en/zh 和双语文档继续遵守。主参考固定 SHA 的 MIT 代码可按许可适配；AGPL/混合许可仅公开行为比较。依赖引入必须证明现有 CDP 不够，不能因参考就捆绑整个浏览器框架。 来源：LOG-007；用户原始约束、dev/ui SKILL、已读参考许可证。
- **DEC-008**：browser-ai-research.md先于用户确认，其中“未决/条件/仅研究”是当时状态；本JSON用户已确认的完整产品阶段与五项选择覆盖旧建议，不把旧报告文字当缩scope授权。研究事实/固定源码证据继续有效，真实运行仍未完成。 来源：LOG-008；用户确认与父任务2026-10-09指令。


遵循 <Path>.agents/skills/dev/SKILL.md</Path> 和 <Path>.agents/skills/ui/SKILL.md</Path> 的目录、模块、lazy、api跨模块、settings namespace、数据位置与设计系统。仅规划工件中文的本轮例外不改变产品文案/用户文档双语要求。

## 7. 数据、接口与兼容

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

## 8. 非功能要求

- **NFR-001**：结构：browser 按 core/platform/services/contrib/ui；pure core 无 host 包，Node/Electron 仅 desktop；模块 lazy，UI lazy；cross-module 只 api；只两个 view；新 owning i18n en/zh，docs EN+ZH。
- **NFR-002**：安全：保留 sandbox/contextIsolation/webSecurity、Node禁用、origin权限策略；采集只 task绑定的 provider allowlist；日志不含cookie/token/password；页面内容不能改变 scope，local IPC 仍认证与撤权。
- **NFR-003**：可靠性：intent 持久先于 submit；一次 attempt 不重复派发；跨站不承诺事务/官网 exactly-once；unknown 诚实，重采集和保存重试不发送；dispose 后无活动控制。
- **NFR-004**：性能：默认呈现2–3主要 guest，其他目标是状态项且只按需观察；单页动作串行，跨页并发上限由真实PoC报告确定，不预设成功率；无每token全文件重写/无背景无限poll。记录每站和全组的发送确认、采集成功、完整性、关联准确、重复、人工介入、恢复、耗时与模型调用成本，指标带分母。
- **NFR-005**：UX/a11y：使用 shell 槽位/primitives/tokens；keyboard 可达、accessible names、focus-visible、32px desktop/44px touch、reduced-motion；三宽度/亮暗/三preset可读；popout 用 el.win/doc。
- **NFR-006**：验证：功能第一，测试只覆盖有代价的身份错发、持久/unknown、采集关联、迁移损坏、scope泄漏；不建立镜像实现的泛用恢复框架。真实登录/OS未测注明，支持列表基于真实验收。
- **NFR-007**：许可：主参考 ORCA e3639ef8d69209b8278b41c0e722811960ea7ec0 MIT；MAIW b6b83ca90f0f67fbf25a676e7a8f6b8b34327800 MIT；复制/改编注明源SHA/路径/许可并维护NOTICE/THIRD-PARTY双语。其他14项目固定来源见研究报告，不导入AGPL实现。
- **NFR-008**：计划DAG仅表达真实数据/API/验证Gate依赖，不把逐站串行偏好伪造为技术边；执行current单writer串行由父goal-plan serialization保证。

## 9. 验证策略

| 接缝 | 层级 | 覆盖合同 | 现有先例或命令 | Evidence 类型 |
|---|---|---|---|---|
| T-01所列稳定入口 | 真实host/系统集成或定向单元 | AC-001, AC-002 | pnpm exec vitest run src/modules/browser/browser.test.ts; 真实Obsidian1.13.x：地址栏Ctrl+F输入domain三次；Ctrl+L；guest重复；modal/split/popout；切笔记、关闭、disable；Windows Ctrl/macOS Cmd列独立运行状态; pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-01.md</Path> |
| T-02所列稳定入口 | 真实host/系统集成或定向单元 | AC-003, AC-004, AC-024, AC-026, AC-039 | pnpm exec vitest run src/modules/browser/browser.test.ts；新增profile-store.test.ts后 pnpm exec vitest run src/modules/browser/platform/profile-store.test.ts; 受控Obsidian vault：default登录一个账号，isolated登录同站另一账号，重启并分别打开/关闭/删除isolated; pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-02.md</Path> |
| T-03所列稳定入口 | 真实host/系统集成或定向单元 | AC-005, AC-007, AC-010, AC-012, AC-016, AC-026 | 新增workspace.test.ts（最近先例 browser.test.ts）后 pnpm exec vitest run src/modules/browser/services/workspace.test.ts; 真实Obsidian+DeepSeek已登录：新task、连续三轮、一轮要求标题/表格/代码/公式、一次重复问题、手工接管; pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle; node scripts/build-styles.mjs --write；pnpm run lint:css；pnpm test:i18n；真实workbench在≥960、600–960、<600宽度及亮/暗/三preset查看 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-03.md</Path> |
| T-04所列稳定入口 | 真实host/系统集成或定向单元 | AC-013, AC-007, AC-016, AC-026 | 新增 kimi.test.ts 后 pnpm exec vitest run src/modules/browser/platform/desktop/providers/kimi.test.ts; Obsidian已登录Kimi：连续3轮、长答案、新会话、至少一次受控单站失败及人工接管; pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-04.md</Path> |
| T-05所列稳定入口 | 真实host/系统集成或定向单元 | AC-014, AC-007, AC-016, AC-026 | 新增 chatgpt.test.ts 后 pnpm exec vitest run src/modules/browser/platform/desktop/providers/chatgpt.test.ts; Obsidian已登录ChatGPT：连续3轮、长答案、新会话、至少一次受控单站失败及人工接管; pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-05.md</Path> |
| T-06所列稳定入口 | 真实host/系统集成或定向单元 | AC-006, AC-008, AC-009, AC-010, AC-011, AC-015, AC-024, AC-025 | pnpm exec vitest run src/modules/browser/services/workspace.test.ts; 真实Obsidian内三站各连续3轮；长结构答案、新会话、重启、断开一站、pause/takeover/resume；记录每站与全组分母及证据路径; pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-06.md</Path> |
| T-07所列稳定入口 | 真实host/系统集成或定向单元 | AC-016, AC-017, AC-018 | 新增quality-gate.test.ts后 pnpm exec vitest run src/modules/browser/core/acquisition/quality-gate.test.ts; 三站同轮生成heading/table/code/math，选2–3比较、复制一个、单站追问并定位官网当前消息; pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle; node scripts/build-styles.mjs --write；pnpm run lint:css；pnpm test:i18n；真实workbench在≥960、600–960、<600宽度及亮/暗/三preset查看 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-07.md</Path> |
| T-08所列稳定入口 | 真实host/系统集成或定向单元 | AC-011, AC-017, AC-020, AC-023, AC-025, AC-039 | 新增workspace-store.test.ts后 pnpm exec vitest run src/modules/browser/platform/workspace-store.test.ts; 已登录三站：提交接受后结束宿主并重开；已完整答案模拟vault不可写→恢复写权限→retry-save；人工改草稿后resume; pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-08.md</Path> |
| T-09所列稳定入口 | 真实host/系统集成或定向单元 | AC-027, AC-007, AC-016, AC-023, AC-026 | 新增 claude.test.ts 后 pnpm exec vitest run src/modules/browser/platform/desktop/providers/claude.test.ts; 真实ObsidianClaude账号：3轮+新task+长文+重启+部分失败；与已过站点共同发送; pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle; pnpm test:docs | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-09.md</Path> |
| T-10所列稳定入口 | 真实host/系统集成或定向单元 | AC-028, AC-007, AC-016, AC-023, AC-026 | 新增 qwen.test.ts 后 pnpm exec vitest run src/modules/browser/platform/desktop/providers/qwen.test.ts; 真实Obsidian通义千问账号：3轮+新task+长文+重启+部分失败；与已过站点共同发送; pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle; pnpm test:docs | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-10.md</Path> |
| T-11所列稳定入口 | 真实host/系统集成或定向单元 | AC-029, AC-007, AC-016, AC-023, AC-026 | 新增 doubao.test.ts 后 pnpm exec vitest run src/modules/browser/platform/desktop/providers/doubao.test.ts; 真实Obsidian豆包账号：3轮+新task+长文+重启+部分失败；与已过站点共同发送; pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle; pnpm test:docs | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-11.md</Path> |
| T-12所列稳定入口 | 真实host/系统集成或定向单元 | AC-030, AC-007, AC-016, AC-023, AC-026 | 新增 coze.test.ts 后 pnpm exec vitest run src/modules/browser/platform/desktop/providers/coze.test.ts; 真实ObsidianCoze账号：3轮+新task+长文+重启+部分失败；与已过站点共同发送; pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle; pnpm test:docs | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-12.md</Path> |
| T-13所列稳定入口 | 真实host/系统集成或定向单元 | AC-031, AC-007, AC-016, AC-023, AC-026 | 新增 minimax.test.ts 后 pnpm exec vitest run src/modules/browser/platform/desktop/providers/minimax.test.ts; 真实ObsidianMiniMax账号：3轮+新task+长文+重启+部分失败；与已过站点共同发送; pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle; pnpm test:docs | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-13.md</Path> |
| T-14所列稳定入口 | 真实host/系统集成或定向单元 | AC-006, AC-019, AC-020, AC-021, AC-022 | 新增history-transfer.test.ts后 pnpm exec vitest run src/modules/browser/core/workspace/history-transfer.test.ts; 从MAIW导出v3，NAND预览导入；改模板后查旧turn；搜索改名置顶；按三范围导出；删一个本地task再看官网; pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle; node scripts/build-styles.mjs --write；pnpm run lint:css；pnpm test:i18n；真实workbench在≥960、600–960、<600宽度及亮/暗/三preset查看; pnpm test:docs; 从真实工作台现有入口导航到本票UI，完成一次正常操作后返回并重载 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-14.md</Path> |
| T-15所列稳定入口 | 真实host/系统集成或定向单元 | AC-018, AC-032 | 新增synthesis.test.ts后 pnpm exec vitest run src/modules/browser/services/synthesis.test.ts; 选两站两个capture、预览后向用户已配置agent会话执行，取消一次、成功一次; pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-15.md</Path> |
| T-16所列稳定入口 | 真实host/系统集成或定向单元 | AC-025, AC-033, AC-034, AC-039 | 新增assistant.test.ts后 pnpm exec vitest run src/modules/browser/services/assistant.test.ts; 受控网页：指定page填表并校验；暂停人工改字段继续；另一page同名元素；高后果动作预览后取消; pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle; node scripts/build-styles.mjs --write；pnpm run lint:css；pnpm test:i18n；真实workbench在≥960、600–960、<600宽度及亮/暗/三preset查看; 同库两页/两任务授予一个scope，跨页、过期、重用handle、手动接管和cancel后请求 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-16.md</Path> |
| T-17所列稳定入口 | 真实host/系统集成或定向单元 | AC-018, AC-035 | 新增user-adapter.test.ts后 pnpm exec vitest run src/modules/browser/core/providers/user-adapter.test.ts; 受控表单选择输入/按钮/结果，预览规则、单次验证、启用再撤回；选一段真实答案加入比较; pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle; node scripts/build-styles.mjs --write；pnpm run lint:css；pnpm test:i18n；真实workbench在≥960、600–960、<600宽度及亮/暗/三preset查看 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-17.md</Path> |
| T-18所列稳定入口 | 真实host/系统集成或定向单元 | AC-025, AC-034, AC-036 | 新增workflows.test.ts后 pnpm exec vitest run src/modules/browser/services/workflows.test.ts; 受控网页保存三步流程，两个不同变量各运行一次；第三次暂停人工接管再恢复/取消; pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle; node scripts/build-styles.mjs --write；pnpm run lint:css；pnpm test:i18n；真实workbench在≥960、600–960、<600宽度及亮/暗/三preset查看; 从真实工作台现有入口导航到本票UI，完成一次正常操作后返回并重载 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-18.md</Path> |
| T-19所列稳定入口 | 真实host/系统集成或定向单元 | AC-037 | 现有automations UI：选择已保存browser流程，手动运行、设置一次近期触发，禁用browser再触发，取消运行; pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle; pnpm test:docs | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-19.md</Path> |
| T-20所列稳定入口 | 真实host/系统集成或定向单元 | AC-024, AC-025, AC-034, AC-038, AC-039 | pnpm exec vitest run src/modules/browser/browser.test.ts；新增scoped-grant.test.ts后 pnpm exec vitest run src/modules/browser/core/scoped-grant.test.ts; 启用grant仅pageA只读→CLI读A成功/写A失败/读B失败；新授权写A后执行；human takeover冲突；revoke后再请求; pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle; pnpm test:docs; 从真实工作台现有入口导航到本票UI，完成一次正常操作后返回并重载 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-20.md</Path> |
| T-21所列稳定入口 | 真实host/系统集成或定向单元 | AC-002, AC-015, AC-027, AC-028, AC-029, AC-030, AC-031, AC-039, AC-040 | pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle; node scripts/build-styles.mjs --write；pnpm run lint:css；pnpm test:i18n；真实workbench在≥960、600–960、<600宽度及亮/暗/三preset查看; pnpm test:i18n；pnpm test:docs；如有源码改编 pnpm run notices 和 pnpm run check:notices; 在受控Obsidian vault执行上述组合场景并保存去敏感证据；按平台分开列Ctrl/Cmd shortcut与profile登录验证 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-21.md</Path> |

测试预算以功能与真实风险为准：复用既有测试；仅为新增算法/协议/数据边界或已复现BUG补最短必要验证。简单布局不造镜像DOM套件，不为覆盖率扩全平台矩阵，不以大量fallback掩盖失败。结构性门禁仍执行build/lint和命中architecture/bundle/CSS/i18n/docs。未运行宿主/账号/平台留在执行Gate，不能写已通过。

## 10. 风险、假设与未决问题

### 风险

- AI官网DOM/网络格式/防护随时变化：每站adapter带version/能力支持表，失败明确原因，停留原页供人工操作，不删除安全隔离或新增猜测兜底。
- Obsidian guest隐藏输入、SSO/passkey可能不可行：真实三站源码PoC gate记录限制；阻塞对应adapter后续readiness，不伪造passed、不换独立浏览器架构而不更新决策。
- 发送后进程崩溃无法证明官网exactly-once：先journal、事后消息identity、unknown不自动重发；用户明确重发显示可能重复。
- isolated profile与旧默认登录迁移：default partition字节保持，新增隔离不复制cookie，活动page不可原地换partition；删除必须用户明确选择。
- 保存失败或用户编辑文档：DocumentRepository保留未知内容，flush失败不发/已发答案保存到recovery，retry-save不重问；坏文件不覆盖。
- 共享owner并行演化：home dispatch/receipt 与 browser消费者以公共API契约锁定；current严格串行，父计划插入外部依赖，不各自造agent scheduler。
- 研究资料不代表真实通过：PoC/每站验收有真实host版本/账号label/轮次/时间/证据路径，截图去敏感；当前规划不得改用户支持文档为已实现。

### 已采用的低影响假设

当前可维护源码路径是导航依据；实现前按固定基线和依赖产物重读，新增局部文件可按现有命名规则命名。文件预测可小范围调整，行为/接口/数据/授权改变必须重开相应决策。

### 未决问题

无。
