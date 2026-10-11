本工件由G拥有，记录实际研究证据。研究过程中的建议以本change最终ADR与Spec为准；例如新闻后段功能全部保留、首页三项日期/主题/直发语义、浏览器五阶段及数据边界均已由用户明确确认。文件路径是导航，不是源码移植授权。临时研究检出不作为恢复依赖，恢复须按固定SHA/公开URL读取。

# Browser / multi-AI research for NAND issue planning

研究者：独立 G fact-exploration 子任务；2026-10-08 至 2026-10-09。全文读取 #142、#145（#145 708 行，含全部 14 章、附录；读取缓存中两条均无评论）。此文件是父代理 G/S/T/P 的研究输入；不是新产品范围获批记录，也不表示代码已实现或真实账号已验证。未修改 NAND 仓库、未修改 GitHub issue、未发送 AI 官网问题。

## 0. 最重要的结论

- **#142 是边界清晰、可立即排程的 bug**：浏览器 chrome（地址栏/工具栏）未进入 Obsidian Scope，当前组件只依赖 DOM 冒泡 keydown；guest 内另有 before-input-event，所以仅网页内成功。修复是浏览器自己的局部 Scope 与统一快捷键动作，生命周期必须随可见/焦点/窗口/销毁释放；不得全局夺取编辑器 Mod+F / Mod+L。
- **#145 自身定义为产品方案调研/评审输入**，包含三站 PoC 和需要评审决定的范围。用户要求全 issue 成熟规格，应完整保留该研究及后续能力，但不能把「阶段建议」改成已批准八站生产承诺；需要一个研究+宿主验证 change，以及明确 gate 的后续交付 ticket 条件。
- NAND **已有** ORCA 多数浏览器基础概念：稳定 page id、per-page queue、snapshot revision、guest 生命周期、Design Mode、opt-in token IPC/CLI、按 vault 登录分区。不能在新 change 另造底座、另一种 view、另一套路由或脱离 module 生命周期的浏览器服务。
- NAND 的关键实际差异：`BrowserModule.execute()` 对除 list/create/close 外每个动作都 `await activate(id)`，读快照也会激活目标；所有页共享 `persist:nand-browser-<vault-id>`；无多 AI task/turn/exchange、站点 adapter、回答采集、阶段发送及持久动作记录；现有 automation actions 无网页流程动作。
- ORCA 固定版本实际为 **desktop webview + headless hidden BrowserWindow**，不是 WebContentsView。它通过 `agent-browser ~0.27.0` + 每页 loopback CDP proxy 控制当前 guest；NAND 现在自己调用 Electron debugger，不依赖 agent-browser。应比较能力缺口，不能因参考要求就加入整个 agent-browser/Playwright 或新 daemon。
- Multi AI 固定版本有重要限制：10 分钟内存 TaskLedger 不是重启级去重；主 UI 在远端发送后才记 successful turn，不能照搬为 durable intent；新 task 只是新本地 session 和重建首页 URL，不保证官网清空旧上下文；`.maiw.jsonl` v3 只导出 sessions/turns/exchanges，未导出完整 acquisitionSnapshots 或独立提示词库。

## 1. NAND 实际基线、结构与复用位置

本次本地 HEAD：`1b9121382363cc50254fbc973c24742b7742edc7`。#142 原报告测试节点为 `21f852b`；以下源码检查仍确认其宿主快捷键机制缺口，未把静态检查当实测复现。

已读取 dev/ui SKILL、architecture/licensing/testing、ui shell/motion-a11y、ADR-0010、domain-layout 与相关源文件。

| 所属 | 现有真实文件 | 已证实行为与后续约束 |
|---|---|---|
| 模块边界 | `src/modules/browser/{api.ts,module.ts,settings.ts}` | `BROWSER_OPEN`、`BROWSER_AGENT_BRIDGE` 已是跨模块入口；浏览器只 peek `AGENT_SESSIONS`，不自动启动 agent。扩展能力只通过 owning api types/service key；module.ts 动态载入 ui。 |
| 业务宿主 | `src/modules/browser/services/index.ts` | page/presentation Map、开关 dispose、openInWindow、token bridge、所有动作激活页面。新目标绑定、后台观察或会话业务优先在 browser services 内，不越权静态引用 agent 实现。 |
| 页面 | `platform/desktop/page.ts` | DOM webview；nodeIntegration=false、contextIsolation=true、sandbox=true、webSecurity=true；稳定 state id、ready/load、页关闭及退休。不可删除安全偏好来兼容站点。 |
| 桌面桥 | `platform/desktop/electron-api.ts`、`bridge.ts`、`runtime-files.ts`、`cli-source.ts` | Obsidian renderer 借 electron/remote 能力；Unix socket/Windows named pipe+每 run token；connection JSON 不保存 token；agentAccess 默认 false。不是普通 Electron 应用主进程，WebContentsView 可用性必须实测，不可直接替换。 |
| 控制 | `platform/desktop/automation.ts`、`debugger-lease.ts`、`snapshot-engine.ts`、`core/operation-queue.ts` | CDP action+逐页队列、epoch:revision、旧引用拒绝、关闭时 caller settle；fill/type/click/wait/screenshot/console/network；目前没有正式 typed provider adapter、回答 acquisition 或任务 ownership。 |
| 登录、权限 | `platform/store.ts`、`guest-policy.ts`、ADR-0010 | `.nand/browser/<device-id>/state.json` 只有 recent history+permissions；登录在 Electron partition。弹窗同 partition；origin permission 默认拒绝。不可把 CLI provider accounts 混同官网 cookie profile。 |
| UI | `ui/BrowserPanel.tsx`、`browser-presentation.tsx`、`browser-modal.tsx`、`workbench-page.ts` | Preact chrome、find、design、grab、markup、attach material。BrowserPresentation window migration 会卸载重建，隐藏资源页保留；快捷键注册必须适配。 |
| 宿主 | `src/ui/native-surface.ts`、`src/app/workbench/workbench-leaf.ts`、`src/shell/host/workbench-pages.ts`、`workbench-surface.tsx` | NativeSurfaceContext 有 leaf/contentEl，没有专用 scope port；scope 方案可局部依赖 leaf.view.scope 或拥有局部 focus Scope，但必须实测优先级。仅注册 workbench/comments 两个 view；既有 BROWSER_PAGE_TYPE 为 surface 标识，不应注册为新 view。 |
| Agent | `src/modules/agent/api.ts` | attachMaterial 只粘贴未发送材料；多 AI 网站服务商与终端 agent session 是不同模型，不复用错对象。 |
| Automations | `src/modules/automations/core/actions/executor.ts` | 当前 action kind 为 agent/script/create-task/notify/obsidian-command/open-file/open-url；自动网页流程是后续 extension，不重造 scheduler。 |
| 已有 Scope 范例 | `src/modules/comments/ui/comments/composer.ts` | focus 编辑时 new Scope(app.scope)，pushScope/popScope，与 composing/hidden/dispose 同步；只能作为本地模式参考，不能跨模块导入实现。 |
| 验证 | `src/modules/browser/browser.test.ts`、`scripts/obsidian-acceptance/workbench-probe.mjs` | 前者已有 queue/guest policy/bridge/lifecycle meaningful coverage；后者真实 guest、tabs、module off、focus mode。#142 必须增真实键盘输入路径，dispatchEvent 不能证明绕过宿主热键。 |

硬约束：settings bind/update；UI 字符串 en/zh；文档 EN canonical + .ZH；Preact/module tokens/native dialogs；可见内容 Markdown，runtime JSON `.nand/` 按 domain/device；Node/Electron 仅 desktop；不另引 UI 库/路由；改代码需 build/lint/相关测试，结构改动 architecture+bundle，CSS 才 CSS checks；文档改动 test:docs；复制外部 permissive 实现需 pin/header/NOTICE/双语 attribution/license。

## 2. #142 成熟修复规格

来源：<https://github.com/NAMEWTA/nand/issues/142>。建议归 browser interaction / host keyboard 域；可以与其他纯浏览器 bug 同 change，但不得被 #145 长期研究 gate 阻挡。

现象：地址栏/toolbar 焦点 Mod+F / Mod+L 被 Obsidian 默认热键吞掉；guest 内 before-input-event 已正常。代码 `BrowserPanel.tsx` useLayoutEffect container.addEventListener('keydown') 与 `guest-policy.ts` 40–43 行证实两个不同路径。报告说 document capture 看不到 f 是现场观察，不需继续堆 capture listener 兜底。

### 142 AC

1. 浏览器可见且焦点在其地址栏、toolbar button、find input 时，平台 Mod+F 打开现有 FindBar 并 focus+select；随后输入 `domain` 进入 find，地址和网页 URL 不变。
2. 同范围 Mod+L 聚焦地址栏并选中完整当前地址；不切 checklist、不新建 page、不触发外部编辑器动作。
3. guest 内现有 Mod+F / Mod+L 走相同 UI actions；一次按键仅执行一次，无双重焦点跳动。Esc 保留现有优先级：design/grab/find；find 关闭清高亮并回该 guest。
4. 普通工作台、focus-mode tab/split、BrowserModal、popout 都针对该 window/该 page。多浏览器页面时仅当前焦点目标响应。
5. 隐藏 resource page、切到其他模块或笔记、关闭 modal/page、disable module、window migration 旧 window 均不得残留 scope；笔记默认 Mod+F / Mod+L 恢复正常；反复 open/close 不累积 handler。
6. 组合输入 `isComposing` 不打断 IME；非 Mod、额外未定义组合键保留宿主行为；不注册全局默认 command hotkey，也不改用户 Hotkeys 配置。
7. 不改变 FindBar 输入时的焦点稳定性、页内查找结果计数和 next/previous，按钮入口仍正常。
8. 明确 Linux/Windows Ctrl 与 macOS Cmd 区分；未跑的 OS 写为待验证，不能用 Linux Ctrl 单测宣称 macOS 通过。

### 142 技术切片 / tickets

- **B142-1 局部快捷键修复**（无依赖）：write paths `src/modules/browser/ui/BrowserPanel.tsx`、必要的 `browser-presentation.tsx`/`browser-modal.tsx` 及 browser 内局部 key-scope helper；只有确需 host scope port 时才扩 `src/ui/native-surface.ts`/shell host（需单独 architecture 审核，不默认）。统一 openFind/focusAddress actions；以 public Scope 的 Mod bindings 获取宿主优先级；scope admission 按该 page 焦点/可见性，release 随 blur/hidden/dispose/migration；无需新 settings/CSS。
- **B142-2 真实宿主回归并同步文档**（依赖 B142-1）：write paths `scripts/obsidian-acceptance/workbench-probe.mjs` + 既有 browser suite 小量 focused regression、`docs/browser.md` / `.ZH.md` 只有描述改变才改、构建 `main.js`。用真实 CDP Input.dispatchKeyEvent 或等效 native key path，测地址栏 F/L→find文字→Esc、切笔记无抢键、两页目标与 modal。单个生命周期断言比大量 mock fallback tests 更有价值。验证 build、lint、browser tests、真实 Obsidian probe，若扩结构跑 architecture+bundle，改文档 docs；无 CSS 改动无需 CSS gate。

Definition of done：原复现 3 次均成功，guest 已工作路径无回归，关闭/切换无残留；附真实 runtime/OS/evidence path；不是仅「增加 listener」或仅 build passed。

## 3. #145 全文需求追踪（防止遗漏研究正文）

| 来源部分 | 必須保留的内容 | 对应规格边界 |
|---|---|---|
| 顶部目的/建议/PoC checklist | 评审输入；三类站点；统一提问/逐站采集/比较；账号、生命周期、恢复；成功率/许可以 PoC 决定 | R-145 研究输出 + decision gate，非已批准八站发布 |
| §1 核心结论 | Multi AI 是固定业务工作台，不是任意网站代理；成熟内核；ORCA 容器+控制，MAIW 业务 | 两入口分阶段，不引自研 Chromium |
| §2 证据等级 | pin 两主参考；源码/官方声明/建议分开；无真实账号性能测试 | 每个 claim 标注 source/status，实测空缺可见 |
| §3 已有插件能力 | 八站；默认 DeepSeek/豆包/千问；面板开关/排序/刷新/最大化/宽度；tiles/adaptive；独立发送目标、select all/none；草稿；prompt CRUD/排序/多选/预览/快照；历史 search/rename/pin/delete/switch/detail；按轮阅读；多范围 copy/export；JSONL migration；external-tab 模式 | 能力 inventory 全保留，首批闭环范围另选；不能抄错误 README |
| §3 边界/README 差异 | 无统一附件/模型切换/thinking开关/综合/投票/真实性验证；同 provider 不可重复；本地 task ≠ website account；不是全部官网历史镜像；新 task 未证明新官网会话 | 明确非目标，账号/完整会话/附件/模型信息 unknown |
| §4 业务路径 | precheck只读→stage输入读回→commit；失败匹配才 rollback；非跨站事务；10min内存去重；acquire provider-data→native-copy→scoped-DOM；校验当前轮、父子/分支/分页/终态；单来源不拼接；快照修订；iframe去CSP问题 | deterministic adapter/状态机/证据+持久intent；不复制扩展头修改 |
| §5 方法 | 容器/协议/CDP/WebDriver/BiDi/extension/执行工具/MCP/agent/业务是不同层；视觉补充；WebMCP未来 | 清楚 capability map，不将框架当现成功能 |
| §6 14项目 | Playwright/Puppeteer/Selenium；MCP/DevTools/agent-browser；Browser Use/Stagehand/Skyvern/Midscene；Nanobrowser/Automa/BrowserOS/ORCA；许可/成熟度 | 见固定版本源码参考表；AGPL/混合只公开行为参考 |
| §7 内置路线 | Electron/CEF/WebView2/Tauri/Chromium差异；Electron extension不全兼容；当前 Chrome login不可假设继承；页面、身份、观察/动作、暂停/接管、结果、外部接口 | NAND是 Obsidian plugin，优先现有 guest feasibility；不能架空宿主变独立浏览器 |
| §8 ORCA | 七点：registry、explicit page、queue、agent-browser/CDP proxy、AX/refs、profile partitions、lifecycle；webview/headless；Design Mode；Google/passkey；loopback≠授权 | 现有 NAND 差异分析；不原样引入 main-process app 和 profile import |
| §9 UX | 多AI对比/网页助手分入口；side task list/top目标含账号与session/中央官网或结果/底部统一输入/逐站进度；2–3主panel+其余status；all-ready default；明确仅就绪目标；recollect≠resend；准确九种状态；2–3答案比较/单站追问/原文；unknown模型元数据；pause/takeover/resume | UI用 shell 三栏；模块不造新 router/tabs；后续外部模型综合必须独立数据发送选择 |
| §10 分层迁移 | workbench/orchestration/adapters/control/page-identity/data；迁移 site知识/质量/历史/prompts；换 extension messaging/iframe policy；持久ledger；URL恢复带身份校验；网络只受限采集 | 模块 zones write paths明确、避免 platform host依赖进core |
| §11 阶段/指标/15验收 | 3类真实站点、连续3轮/长文/新会话/重启/单站失败；5阶段；发送确认/采集/完整性/关联/重复/人工/恢复/成本；单站与全组成功率；15场景全部逐项 | 见 AC-145 及 stage tickets；不编造95%目标，66.3%只是说明算例 |
| §12 成本/数据 | 官网变化/登录/完整性/内核/AI推理/支持；官网↔本地↔外部模型数据；普通发送一次授权；发布/支付/删除最终确认；本地优先、不因 Docker 就远程部署 | 本地PoC不加LLM费用；scope gate/人接管；不持久秘密、不默认广域监听 |
| §13 功能映射 | 多站/采集/同页/独立页/账号/外接/确定流程/企业跨环境/自然语言/局部AI/视觉/可视流程/完整浏览器/指认/WebMCP | 全部保留为候选能力映射，未选不等于删除 |
| §14 七项产品选择 | 产品目标、首批站点、账号组织、保存范围、失败恢复、额外模型、外部接入 | D1–D7 决策表；高影响项不能替用户编造 |
| 附录 | 声明站点、workspace/store、background/bridge/strategy、engine/gate/network、database/migration、tests、ORCA全部browser/CLI/routing/lifecycle | 固定 SHA 链接/下载清单及本报告事实映射 |

## 4. 两个主参考的深入源码结论

### ORCA e3639ef8d69209b8278b41c0e722811960ea7ec0 — MIT, Copyright (c) 2026 Lovecast Inc.

根目录 LICENSE 已实际读取。Git clone 拉取历史后 checkout 因 408 失败；已用 GitHub immutable raw URL 完整获取 issue 引用的 21 个 ORCA files+LICENSE，所有 HTTP 成功；因此不将失败 clone 宣称有效完整检出。证据在 `临时研究检出/pinned-source/orca/`。

| 实际入口（所有路径相对上述 SHA） | 源码事实 | NAND 应用 / 不照搬点 |
|---|---|---|
| `src/main/browser/browser-manager-registration.ts` `registerGuest/unregisterGuest/registerOffscreenGuest` | page/tab id 绑定 webContents；拒绝 document id、非webview、没过policy的guest；同 id 换guest退休旧guest；关闭清context/shortcut/grab/download/maps | NAND stable id 已有，后续 target profile+generation检查；不信renderer传任意webContents |
| `agent-browser-bridge-tabs.ts` `resolveCommandTarget/resolveScopedActiveTab/tabList` | explicit page 与worktree筛选；多worktree无明确作用域的text mutation拒绝；tabList不改active；dead target清除 | NAND本就强制page参数，保留；解决后台read必激活；不继承active fallback |
| `agent-browser-bridge-queue.ts` `enqueueTargetedCommand/executeQueuedCommand` | 每 page named-session队列；admission时固定page id；执行时重新解析live guest | NAND现有BrowserOperationQueue复用；增加任务绑定/暂停的可见语义，无需第二队列体系 |
| `package.json` + `agent-browser-bridge-execution.ts` | `agent-browser: ~0.27.0`；每次带`--session ... --cdp ... --json`，daemon退后重初始化；stale owner关闭失败时停止；contenteditable special path | 不能依赖当前最新版行为等价；NAND没有该daemon，只有证明必要才引依赖 |
| `cdp-ws-proxy.ts` / `cdp-debugger-channel.ts` | 127.0.0.1随机port；lease debugger；映射synthetic session；截图/PDF/native focus特殊处理；普通evaluate不强行focus | localhost不是完整auth；NANDtoken IPC已更合现有owner；webview screenshot/input需PoC验证 |
| `agent-browser-bridge-core-commands.ts` / `snapshot-engine.ts` / `cdp-ref-resolution.ts` | 主要snapshot走agent-browser；另有AX+cursor-interactive+iframe refs；direct路径role/name/nth恢复；旧navigation拒绝 | 不误称全部runtime同一snapshot pipeline；NAND旧ref明确失败更适合避免误发，不引heuristic自动猜元素作为强制兜底 |
| `browser-session-registry.ts` | profiles独立partition、allowlist、persist非默认profile；cookie导入stage；删除profile清storage | 与NAND ADR-0010一vault一profile不同，需迁移/默认策略决策；不暗改旧cookie位置 |
| `agent-browser-bridge-lifecycle.ts` | creation/destruction互斥；close drain queued；kill running；process swap重建session并更新active；bounded cleanup | NAND已有abort/retire；只补可证明缺口，不能把源码测试存在当账号兼容实证 |
| `browser-backend.ts` / `offscreen-browser-backend.ts` | 统一createTab/closeTab；desktop webview；headless BrowserWindow(show:false)，policy和registry统一 | 不称WebContentsView已采用；不部署headless，不建云集群 |
| `browser-manager-grab.ts` / design-mode.mdx | renderer ownership验证、取消旧grab、overlay抓取、cropped截图；DOM/computed style/source位置有条件 | NAND现有design/markup/agent材料可复用；用户站点适配编辑是新产品需验证，不自动永久写规则 |
| profiles.mdx | Google cookie不导入需直接登录；清理UA不等价Chrome；平台passkey尚不支持，仅external FIDO flow | 登录/SSO/WebAuthn是PoC真实验证项，不能宣传无缝迁移 |
| 两组 routing/lifecycle tests | explicit snapshot不换active；tabList无副作用；session关闭/creation竞态/process swap/旧队列拒绝 | 仅说明测试覆盖设计；未运行，不当实测结果 |
| CLI browser-interact/capture | 明确page/worktree动作target；click/fill/type/select/upload；网络/console opt-in capture/intercept | 多AI首版只要受控最小动作+采集，不要默认all-network recorder |

固定主源码入口：<https://github.com/stablyai/orca/tree/e3639ef8d69209b8278b41c0e722811960ea7ec0/src/main/browser>。

### Multi AI b6b83ca90f0f67fbf25a676e7a8f6b8b34327800 — MIT, Copyright (c) 2026 NAMEWTA

实际 clone checkout 成功，LICENSE 已读，声明0.0.3。所有 issue pinned links 的 23 个 MAIW 文件另存 raw evidence。只移植业务知识/语义，不搬 WXT/React/Zustand/Dexie 运行时。

| 入口 | 核心事实 / 更成熟规格应补什么 |
|---|---|
| wxt.config.ts / built-in-sites.ts / workspace-store.ts | MV3 host白名单八provider；实际默认 DeepSeek/豆包/千问；panel provider去重；selection独立；保存配置覆盖默认。不能把任意URL认为自动支持。 |
| workspace-app.tsx `submitPrompt` | 先发WORKSPACE_SUBMIT，然后若任何submitted才recordSuccessfulTurn；earlyResponses buffer；本地保存失败与远端已发送有真实时间窗。NAND需先 durable intent 再提交，失败归类save-failed，不能重新提问。 |
| `background.ts` 365–438 | 全target precheck→全target stage→全target commit；precheck失败只清内存准备；stage失败rollback已stage；每站result；不是跨网站事务。 |
| `provider-bridge.content.ts` | 站点bridge接收PRECHECK/STAGE/COMMIT/ROLLBACK，绑定provider/panel/session/turn，capture updates独立上报；NAND替换extension通信而保留identity。 |
| `base-dom-strategy.ts` 81–168 | 只读检查login/challenge/draft/busy；固定composer存活；stage写入并找对应submit；rollback仅相同内容；submit观察input/url/button变化，不只是click返回即成功；失证SUBMIT_UNCONFIRMED。 |
| `task-ledger.ts` | Map + default TTL=10min；running/succeeded/failed；重启无记录，不能承诺 exactly-once。 |
| engine.ts / quality-gate.ts | 优先尝试策略，逐候选质量检查，选择单一snapshot；provider/source/strategy一致；reject empty/title-only/status-only、缺message/chars、完整边界、分页未终止、branch/current node缺失。不要为了可用性无限自动修复。 |
| native-copy.ts | 目标回答自身copy；suppressSystemClipboard=true；拒绝prompt文本/复制提示/短缺/末尾anchor缺失；source单一。NAND保留系统剪贴板既有内容。 |
| acquisition-network-main.content.ts | 仅适配endpoint观察fetch/XHR，最多24 observations；敏感key过滤；带凭据request保持page-local；不是保存全部网络请求。 |
| database.ts / acquisition-snapshot-service.ts | task/session→turn→provider exchange；immutable revision含conversation/message/parent/branch/source/completeness/evidence/adapterVersion；最新partial不回退旧final冒充新final。 |
| response-revision.ts | captureId相等+revision递增；terminal后不再旧消息覆盖；NAND recapture需要新capture与明确revision策略，不能永远无法更正。 |
| history-transfer.ts | v3 `.maiw.jsonl` manifest counts、sessions、turns、exchanges；official HTTPS URL校验、50MiB限制；不含cookies、全部snapshot表或独立模板库。 |
| workspace-app.tsx `startNewTask` | createFreshWorkspace+createSession+restoreSnapshot，不调用START_NEW_CONVERSATION；真正新官网context须站点验收。 |
| prompt-library-store.ts / session-history-detail.tsx | 模板CRUD/order/multiselect/snapshot；统一按轮Markdown阅读、多范围copy/export；NAND改用可见Markdown+本地runtime。 |
| frame-policy-manager.ts | 对工作台tab白名单sub_frame删X-Frame-Options与整个CSP；NAND webview不可复制这种策略。 |
| base-dom-strategy.test.ts / tests/live/real-sites.spec.ts | 前者涵盖draft/nearestbutton/terminal/native-copy；live suite主要验证8网站可加载与记录composer存在，临时空profile，**不等价8站真实登录发送/采集通过**。 |

固定主源码：<https://github.com/NAMEWTA/multi-ai-browser-extension/tree/b6b83ca90f0f67fbf25a676e7a8f6b8b34327800>。

## 5. 成熟研究/PoC规格（R-145，当前可承诺交付）

**R1 证据包**：输出每一引用项目的固定SHA+license+实际file locator+可借鉴行为+NAND映射+局限；区分原issue中的源码结论、如今官方资料、产品建议；保存参考覆盖表、source checksum/抓取状态。主参考失败路径不得藏掉。

**R2 宿主可行性**：在目标Obsidian版本、Linux/Windows/macOS各自标记available/tested/unverified；验证现有webview/CDP真实输入、richtext、popup/SSO、partition持久、hidden guest是否继续生成、截图、页面替换、模块off清理。不预先承诺WebContentsView替换；若为更大宿主变更，写决策而非默默落地。

**R3 代表性站点计划**：三类：简单composer、复杂richtext、严格登录/防护。候选DeepSeek/Kimi/ChatGPT/Claude，仅在用户确认/可用真实账号条件下锁定名单；不自动创建账号、不声称已验证。页面内用户手动登录/验证；不绕过challenge。

**R4 最小业务PoC**：一次统一问题→三个明确site/page/profile target→read-only precheck→stage读回→commit逐站状态→当前轮答案保存→原文入口。单站失败保留其他站，重采集与重发独立。固定业务不调用额外LLM。不先做完整8站/市场/云服务。

**R5 真实闭环记录**：首登录、连续3轮、同问重复两次、长文含table/code/math、官网新session、应用重启、单站失败。记录source artifacts、steps、expected/actual、site/account tier、app/electron/OS/adapter版本、发生时间；秘密/完整token/私密无关对话不进入报告。

**R6 故障边界**：原issue §11.4全部15场景有对应计划和观测项；最小有意义样本足够，不大量mock模拟每个browser内部异常。没有真实账号的行标blocked-on-account，不替换成stub并声称完成。

**R7 指标定义**：以本次样本测send-confirmed、acquired、completeness正确、identity关联、重复/误发/串账号、人工、恢复、资源和时间。每个指标写分母；记录单站与整组；无既定成功率门槛，PoC后评审，零误发/串账号/重复是规定样本门槛而非全站保证。

**R8 决策输出**：回答D1–D7，推荐值可附理由但status=proposed；PoC未知与用户产品选择分开。只依赖工程调查能决定的事项由实现人决定；首批用户/站点账号/外部模型数据/产品范围不能假装已获授权。

**R9 NAND集成方案**：六层具体映射到browser zones；必要跨模块api；使用shell panel/page/现有tabs；不搬React/Zustand/Dexie，不改agent账号系统，不新建旁路scheduler；白名单网络采集/现有isolation。

**R10 退出条件**：研究change可在完整证据+可重复PoC方案+明确可行性结论（含不通过或缺账号）+条件化产品spec/tickets时交付研究结果，但不得把未执行PoC标passed/把生产实现tickets标ready。需要真实实测后才能声称阶段一发布门槛满足。

## 6. 后续多AI产品成熟行为规格（条件化，保留全部需求）

以下供 S 写产品方案的详细约束，不表示当次研究已批准实现全部。以 D1–D7 定范围；有条件项在ticket ready条件注明。

### 域对象和状态

- `WorkspaceTask`（任务名/created/activity/pin）、`Turn`（序号/原问题/不可变模板快照/最终发送文本）、`TargetBinding`（providerId/pageId/profileId/providerConversationId/guest generation）、`Exchange`（submit状态/answer状态/来源/官网链接/时间）、`AcquisitionRevision`（provider messageId/parent/branch/adapterVersion/content blocks/Markdown/completeness/evidence/source/revision）概念分开；不把 URL 当身份。
- 提交状态至少区分 draft、checking、needs-login、needs-human-verification、occupied-draft、busy、staged、submitting、submitted、submission-unknown、aborted/failed。回答状态区分 waiting/generating/complete/incomplete/acquisition-failed/save-failed。UI可合并展示，但事实层不能把unknown=failed=unsent。
- 用户内容Markdown在可见目录（例如配置folder下的task/turn文档），runtime/indices/动作journal在`.nand/browser/<device-id>/...`，具体名称D4/ADR后定。cookies仍Electron，不入vault。若持久格式新增要schema/version+最小golden reader/writer证明，不能用庞大备份/迁移平台替代功能。

### AC-145

1. 明确site/当前账号环境/官网会话/选中本轮目标；open panel不等于send；全选/清空只作用本轮选择；未能可靠获取model/version/web/tools则显示「未确认」。
2. 草稿只留workbench；模板CRUD/顺序/多选；发送前可查看final content与目标数；每轮snapshot不可变，后续改模板不改历史。
3. 首批多AI入口使用shell side panel任务列表、page的官网/回答区域、bottom composer、可展开逐站状态。≥960可2–3主视图，其余status；窄窗focus一个站+保留状态导航；不造第二tabs/router，不要求八等分。
4. 默认全部只读precheck通过才写任何站点；一个未登录/验证/busy/已有draft则本轮不提交；用户可明确改为仅ready目标并看到新目标集，无静默缩减。
5. Stage验证读回与final prompt一致且submit可用；失败只回滚仍属于该attempt且文本未被用户改的输入；不覆盖新草稿；目标navigation/identity变化停止该站重新检查。
6. 提交前持久记录task/turn/target/action意图；commit只针对该绑定页，并确认站点接受的可见/消息证据。点击返回不等于已提交；部分成功不是整体失败。
7. 按站记录submitted/generating/complete/unknown；连接断于click后标unknown，保留page及成功答案，不自动整组重发；重发需用户明确选该站，重新采集只读现有答案，retry-save不发送。
8. 同一问题连续问两次产生两个turn并绑定新message identity；URL/文本相同不可当去重条件。journal只避免重复执行同attempt，不能阻止用户主动第二次提问。
9. 采集当前turn/current branch答案；provider adapter证明conversation/message/parent/branch；分页/虚拟DOM不完整标incomplete；不要选到前轮旧答案或拼多个候选。
10. source选择受限：已验证站点data→native copy→scoped DOM。可只交付经PoC证明的策略；失败明确给原因与recollect，不启无限fallback。默认不引视觉/LLM重试。native-copy不污染剪贴板。
11. body含heading/table/code/math尽量保留Markdown结构；只有title/status/空body不能标complete；completeness检查依据站点和实际source，不能用字符串长度单独断言真实完整。
12. revisions不被迟到旧capture覆盖；latest partial不能以old complete冒充；重采集保留source/version与更新关系；保存失败有本地可恢复内容，不重问。
13. 统一阅读按轮；选择2–3答案并排；单答案复制、指定站追问、对应官网消息；原始答案与未来综合结论独立，不能把一致性当事实验证。
14. 新task保留旧task记录并确认各站新官网上下文；恢复历史只恢复仍属于当前profile且可访问的official session；导入历史不重建官网会话、不登录。
15. 历史search/rename/pin/delete/switch/detail；Markdown export明确current task/one provider/latest turn；删除本地不删官网。`.maiw.jsonl`迁移只承诺已映射字段，版本/counts/official-domain校验，重复导入策略明确；缺snapshots/templates写清楚。
16. human takeover留同页；pause/我来操作阻止后续mutation并处理已dispatch动作的未知状态；resume重新observe/校验身份与草稿，旧refs不用；无需每次fill再弹批准。
17. 所有动作绑page/profile/task；切前台不重定位到别的页；后台read不抢焦点（如host不能保证，PoC明确限制并安排调度，不假装并行）。same-page queue串行，different-page不共享输入焦点；同时运行上限与资源由实测定。
18. 页面关闭、guest替换、重启都能恢复已知事实；unknown保留unknown直到观察/人工确认；禁止自动重发。off/module dispose释放listener/queue/bridge和guest。
19. 若多profile获批：独立Electron partitions，default旧partition兼容；profile切换需新guest并重新绑定，不在活动guest改partition；同一provider多账号不串；不承诺Chrome cookies可一键导入/Google/passkey兼容。
20. 受限网络采集仅allowlisted provider endpoints、task范围、去敏感字段；日志不含token/cookies/password，无默认全网HAR；prompt/答案到哪些官网、本地与外部模型的去向可见。
21. webpage文本是数据，不能扩大authorized targets/actions；普通统一send按钮一次授权足够；后期agent发布/支付/删除最终展示具体对象和内容再执行。
22. 后期网页助手单独入口：指定page和scope→可见步骤→pause/stop/takeover→观察验证结果；调用现有typed控制能力，不绕开journal/ownership。
23. 后期可复用workflow：步骤+变量+run records；需要调度时用automations贡献点/服务，不第二scheduler；外部接入同页ownership仲裁和撤回入口，opt-in。
24. 后期元素指认：可把回答段加入比较，框选解释；用户指定composer生成的adapter先展示、单次真实验证才保存，不自动替换内建规则。
25. 保持NAND module/i18n/storage/lazy/UI/a11y规范；真实登录数据/OS兼容未验证逐项标记，公开支持名单仅包含已通过目标场景的provider；不能因为页面能打开就发布八站支持。

### 需要真实决策的 D1–D7（不能编造为已批准）

| 决策 | 推荐供评审 | 不能擅自承诺的项 | 依赖 |
|---|---|---|---|
| D1 产品目标 | 多AI协作→受限网页助手的分阶段路线 | 完整日常浏览器/Chromium fork/云集群 | 新产品入口与release scope |
| D2 首批用户/站点 | 三类代表站点PoC，按可用账号锁定 | 直接八站稳定/账号创建或使用某付费账号 | 实际登录PoC及provider适配ready |
| D3 账号组织 | 明确当前vault共享环境作为现基线，PoC对比isolated profile | 改ADR-0010默认、账号迁移、同provider多账号 | partition/UI/数据migration |
| D4 保存范围 | 工作台当前轮原文+模板snapshot+来源，visible Markdown | 官网完整历史/附件/所有分支/全数据库备份 | persist schema、导入导出、清理语义 |
| D5 失败恢复 | 保留部分成功，unknown核对、recollect≠resend | exactly-once across websites、自动整组重发 | 状态机/journal；安全事实可直接定约束 |
| D6 额外模型 | 固定发送不需要；综合/agent独立opt-in | 默认把全部页面送外部LLM、API key来源/成本 | 外部数据/额外服务license预算 |
| D7 外部助手接入 | 先复用已有opt-in本地bridge，需求明确后scoped tools | 默认开放MCP/远端端口、自动调度/无人值守高后果动作 | 权限/任务仲裁/进程owner |

## 7. 推荐的 vertical tickets、write paths 和 goal-plan

此表按可独立验收的纵向业务切片，避免「先巨型框架、最后拼UI」及过度测试。R-145 与 B142 不互相阻塞。产品ticket为 conditional，父workflow应在未决字段未关闭时保持blocked/未ready，而非删除需求。

| Ticket | 交付切片/验收 | Writes（候选，不是已写） | 依赖/状态 |
|---|---|---|---|
| R145-1 固定证据与决策包 | 覆盖全文/所有参考；NAND gap；licenses；明确D1–D7/假设/否决 | change `research/`, CONTEXT/SPEC中来源映射（父G owner写）；用户guide暂不改成已支持 | 本研究已提供输入；父G可整合 |
| R145-2 宿主三类站点PoC | 现有guest+CDP，登录保持/输入/3轮/长文/新会话/重启/部分失败；真实结果表 | 优先 `scripts/obsidian-acceptance/`复用场景；必要小量`browser/platform/desktop/`实验入口受change限制，实验不得默认启用/扰动生产 | D2账号&目标host；没有账号仍可做local fixture/host无账号能力，不能标真实站点passed |
| R145-3 范围与发布gate裁定 | 六层owner、存储profile决策、支持名单、指标分母/阈值、阶段选项 | change decision record/SPEC更新；未来ADR仅经owner gateway | R145-1/2；用户高影响D项未确定则只完成review package |
| P145-1 单站垂直闭环 | 一个核定provider：task草稿→precheck/stage/submit→bound current answer→Markdown结果，真实page可接管 | `browser/core/workspace/`模型+`core/providers/`纯规则；DOM/CDP实际在`platform/desktop/providers/`；`platform/workspace-store.ts`；`services/workspace.ts`；`ui/MultiAiWorkspace.tsx`；`module.ts`lazy页面、i18n、ownstyles/compose-workbench必要映射 | R145-3范围批准；复用page，不改变view types；只做所需schema |
| P145-2 多目标协调与可见状态 | 三站选中target集；全ready再stage；部分commit；target/card/status；不会抢错page；同问两轮 | `core/workspace/turn.ts`/submission policy；`services/workspace.ts`/`services/index.ts`；provider adapters；UI target/progress | P145-1 + D2；核心测试1条stage失败rollback不清新草稿，1条unknown不重发 |
| P145-3 完整采集/统一比较 | current message/branch/pagination、head/table/code/math、两三答案comparison、原文/单站追问 | `core/acquisition/`质量/identity；`platform/desktop/providers/`受限采集；`platform/workspace-store.ts`；`ui/AnswerComparison.tsx` | P145-2 + D4；复用三类真实fixture；不加未验证视觉fallback |
| P145-4 重启恢复/本地失败恢复 | durable intent+postcondition证据，recollect/save retry；refresh/restart/close状态不误重发 | `platform/workspace-store.ts`、`core/workspace/`、`services/workspace.ts`、UI actions | 关键persist intent从P145-1即开始，此ticket深化完整restart；不能把首版重发风险留到以后 |
| P145-5 历史/提示词/迁移 | search/rename/pin/delete、prompt CRUD/snapshot、范围export、maiw v3 import明边界 | `core/workspace/history-transfer.ts`、visible Markdown store、`ui/WorkspaceHistory.tsx`/`PromptLibrary.tsx`、双语docs | P145-3/4 + D4；1个真实v3 roundtrip fixture即可，不复制Dexie |
| P145-6 profile隔离（条件） | default保留、可选isolated profile、explicit page绑定、登录/重启/同站不同号不串 | browser `core/model.ts`、`platform/store.ts`、`platform/desktop/page.ts`/guest policy、settings/UI/api；ADR-0010新决策 | D3 explicit；可与后半业务并行但共享model/store需串行集成 |
| P145-7 受限网页助手/人工接管（后续） | scope/步骤/result验证/暂停-接管-继续；已dispatch结果未知诚实；不扩权 | browser service API；browser UI/controller；agent via api；可选模型adapter在所属owner | 核心站点闭环+恢复通过 + D6；不默认开启 |
| P145-8 工作流/外接（后续） | 可复用steps/vars/runs、既有automations可选调度、外接scope/token/stop | browser/api.ts + contrib；automations/api.ts contracts/own services；existing bridge | P145-7 + D7；远端/完整浏览器另决策 |

最小goal-plan：`B142-1 → B142-2` 独立快速修复；`R145-1 → R145-2 → R145-3` 研究路；条件获批后 `P145-1 → P145-2 → P145-3 → P145-4 → P145-5`，P145-6按D3插入且不能误用默认profile；后期 P145-7→P145-8。账号/产品范围gate只阻止对应新产品实施，不阻塞全部bug。

各slice都交可运行用户闭环、最少相关测试、真实host必要证据，再下一slice；不先搭大量recovery/cache/telemetry框架；不添加为镜像实现而写的测试。所有生产变更最终build/lint/architecture/bundle、i18n、必要styles/docs，最后main.js/styles.css同步。研究文件本身只需docs/links/schema验证，不无意义运行整套代码测试。

## 8. 尚未完成的事实验证

- 未向任何真实AI账号发送；所有目标站点的当日登录/防护/长回答/三轮/重启表现未验证。
- 未执行本地Obsidian #142 复现/修复或其他代码；本报告只定义可实现修复。
- WebContentsView在Obsidian宿主中的安全能力、hidden guest输入/截图、跨平台SSO均不能依据Electron官网直接宣布可用。
- 不把源仓库tests存在或readme宣传视为运行通过；不把GitHub HEAD活跃视为生产成功率。
- AGPL/mixed项目仅用README/license等公开行为资料；未读取其实现用于NAND编码，未复制任何代码。


## 9. 给父 workflow 的范围补充与完整阶段编排

父代理已明确：**本轮只交付完整规划，不进入实现**；采用 `2026-10-08-browser-ai-workbench`，current Works 严格串行。上述 R/P 是同一 change 内的研究、PoC 与产品阶段标识，不要求实际另建研究 change 或省略产品。#142 可在同 change 中作为无产品依赖的第一实现 ticket，也可由总体 bug change 纳入；不可重复计数。

完整产品规划必须覆盖全部八站：DeepSeek、Kimi、Coze、ChatGPT、Claude、通义千问、MiniMax、豆包。三站只是 PoC Gate，不是最终默认为三站的产品范围。PoC后根据用户选择确定首批正式支持，其余站点各有完整适配 ticket，不能用「未来看看」替代 tickets。

在 P145-3 和 P145-4 后添加 **P145-3b 每个尚未核定站点的垂直接入**：每个 provider 一个 ticket，覆盖官方host白名单、login/challenge/busy/draft识别、simple/rich composer写入与读回、提交后确认、conversation/message/current branch、完整采集与重新采集、3轮/新会话/重启、失败保留；写 `browser/core/providers/<provider>.ts` 纯模型和 `browser/platform/desktop/providers/<provider>.ts` DOM/CDP适配、对应 fixtures、一处支持列表和双语文案；使用同一 workspace orchestration/UI，不能每站造一套管理器。已选PoC三站的正式化也需该AC，源码原有selectrors不能直接宣称live passed。

- **DeepSeek**：上游 `src/providers/deepseek/{definition,selectors,strategy,acquisition,runtime-acquisition,native-copy}.ts`，存在legacy/fragments acquisition fixtures；重点parent-child消息链与会话identity。
- **Kimi**：对应kimi目录，有list-messages第1/2页fixtures；重点richtext、分页终止、消息链与生成终态。
- **ChatGPT**：对应chatgpt目录；重点current branch/node、conversation identity、受保护登录；不能采其他分支。
- **Claude**：对应claude目录；重点稳定message身份、终态与richtext；新会话不要只相信首页URL。
- **通义千问**：代码provider id=`qwen`（不是任意自行命名qianwen）；目录含detail/alternate/partial会话fixture；来源字段形态适配必须明确。
- **豆包**：doubao目录含chain-page-1/2；重点分页结束、同轮answer关联。
- **Coze**：coze目录没有已配置provider-api acquisition.ts；以目标原生copy→scoped DOM验证；禁止承诺与六站相同API采集。
- **MiniMax**：minimax目录同样没有已配置provider-api acquisition.ts；chat/agent两官方host范围需按definition验证；copy→scoped DOM。

所有上游provider目录 pin `b6b83ca90f0f67fbf25a676e7a8f6b8b34327800`；已查看目录、各 index.ts、registry，重点通用strategy/acquisition深读。正式实施每个具体站点的selector、网站当日DOM及adapter需在对应ticket进一步验证；本轮未假装真实使用过八站。

Goal顺序建议：#142独立bug闭环 → reference/decision整合 → host+3类PoC → 范围与账号/数据decision gate → core multiAI闭环（P1–P4关键durability从首次submit即有）→ 八站逐个正式化（可执行顺序由支持名单决定，实际current一次一个）→ history/prompts/migration → profiles条件化 → 受限网页助手 → reusable workflows → local external integration。每阶段保持原issue退出条件；更广泛remote执行与完整浏览器战略保留独立decision，不假装已选中。

## 10. 其他参考的固定版本与实际代码/公开行为阅读

这张表覆盖 issue §6 的全部项目（ORCA见§4），额外列WebMCP。以下SHA是本轮GitHub默认分支解析的固定提交，只用于本轮参考，不与主issue pin或ORCA `agent-browser ~0.27.0`依赖混同。许可来自实际下载LICENSE及API元数据；NOASSERTION已进一步看文件。

| 项目与固定 SHA | 已读源码/资料 locator | 可借鉴与NAND边界 | 许可 |
|---|---|---|---|
| microsoft/playwright `b28411b105a25fcd97014111764a1cf76f0c6bb0` | [packages/playwright-core/src/server/dom.ts](https://github.com/microsoft/playwright/blob/b28411b105a25fcd97014111764a1cf76f0c6bb0/packages/playwright-core/src/server/dom.ts)；[packages/playwright-core/src/server/chromium/crBrowser.ts](https://github.com/microsoft/playwright/blob/b28411b105a25fcd97014111764a1cf76f0c6bb0/packages/playwright-core/src/server/chromium/crBrowser.ts) | dom的wait-for-visible/stable/enabled、hit-target动作条件；已有browser CDP连接上下文。借鉴可交互条件，不因引用就bundle整个runner。 | Apache-2.0 |
| puppeteer/puppeteer `7005ffa3f185c0cfc2dce9b96852f45a03ed4cf1` | [packages/puppeteer-core/src/cdp/BrowserConnector.ts](https://github.com/puppeteer/puppeteer/blob/7005ffa3f185c0cfc2dce9b96852f45a03ed4cf1/packages/puppeteer-core/src/cdp/BrowserConnector.ts)；[packages/puppeteer-core/src/api/locators/locators.ts](https://github.com/puppeteer/puppeteer/blob/7005ffa3f185c0cfc2dce9b96852f45a03ed4cf1/packages/puppeteer-core/src/api/locators/locators.ts) | connect获取BrowserContexts并建立CdpBrowser；locator等待能力。必须验证Obsidian guest支持的方法；不是自主任务规划器。 | Apache-2.0 |
| SeleniumHQ/selenium `55c6cb973cb7e769f30f5287ac830444687230d1` | [py/selenium/webdriver/support/wait.py](https://github.com/SeleniumHQ/selenium/blob/55c6cb973cb7e769f30f5287ac830444687230d1/py/selenium/webdriver/support/wait.py)；[py/selenium/webdriver/remote/webdriver.py](https://github.com/SeleniumHQ/selenium/blob/55c6cb973cb7e769f30f5287ac830444687230d1/py/selenium/webdriver/remote/webdriver.py) | 条件轮询有deadline/失败；WebDriver/远端session通道。企业多环境验证候选，不给NAND加Grid服务。 | Apache-2.0 |
| microsoft/playwright-mcp `b8b4183e099f136cbec0388a6088d4aa2f6b9685` | [src/README.md](https://github.com/microsoft/playwright-mcp/blob/b8b4183e099f136cbec0388a6088d4aa2f6b9685/src/README.md)；[index.js](https://github.com/microsoft/playwright-mcp/blob/b8b4183e099f136cbec0388a6088d4aa2f6b9685/index.js)；[cli.js](https://github.com/microsoft/playwright-mcp/blob/b8b4183e099f136cbec0388a6088d4aa2f6b9685/cli.js)；[tests/click.spec.ts](https://github.com/microsoft/playwright-mcp/blob/b8b4183e099f136cbec0388a6088d4aa2f6b9685/tests/click.spec.ts) | 此仓库入口委托playwright-core工具；源码已迁monorepo，详见下一行。不能用README代替实现。 | Apache-2.0 |
| microsoft/playwright `b28411b105a25fcd97014111764a1cf76f0c6bb0` | [packages/playwright-core/src/tools/mcp/browserModel.ts](https://github.com/microsoft/playwright/blob/b28411b105a25fcd97014111764a1cf76f0c6bb0/packages/playwright-core/src/tools/mcp/browserModel.ts)；[packages/playwright-core/src/tools/mcp/extensionContextFactory.ts](https://github.com/microsoft/playwright/blob/b28411b105a25fcd97014111764a1cf76f0c6bb0/packages/playwright-core/src/tools/mcp/extensionContextFactory.ts)；[packages/playwright-core/src/tools/backend/snapshot.ts](https://github.com/microsoft/playwright/blob/b28411b105a25fcd97014111764a1cf76f0c6bb0/packages/playwright-core/src/tools/backend/snapshot.ts) | MCP实现在此：chrome tab↔CDP session注册、已允许后extension握手；typed snapshot/element target/click，最新snapshot及waitForCompletion。外接借鉴tool契约，用户授权仍由NAND定义。 | Apache-2.0 |
| ChromeDevTools/chrome-devtools-mcp `2744afa8922e2f28a3c512a7aaf6f72d88bbd9a0` | [src/tools/input.ts](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/2744afa8922e2f28a3c512a7aaf6f72d88bbd9a0/src/tools/input.ts)；[src/tools/snapshot.ts](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/2744afa8922e2f28a3c512a7aaf6f72d88bbd9a0/src/tools/snapshot.ts)；[src/tools/network.ts](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/2744afa8922e2f28a3c512a7aaf6f72d88bbd9a0/src/tools/network.ts) | UID snapshot、locator action与dialog interruption区分；target page network filter/pagination。用于诊断模型，不能默认采集所有请求。 | Apache-2.0 |
| vercel-labs/agent-browser `0207911f1bd4d0393eddaa90f2e50f96e0fb8974` | [cli/src/native/snapshot.rs](https://github.com/vercel-labs/agent-browser/blob/0207911f1bd4d0393eddaa90f2e50f96e0fb8974/cli/src/native/snapshot.rs)；[packages/@agent-browser/eve/extension/tools/fill.ts](https://github.com/vercel-labs/agent-browser/blob/0207911f1bd4d0393eddaa90f2e50f96e0fb8974/packages/@agent-browser/eve/extension/tools/fill.ts)；[packages/@agent-browser/eve/extension/tools/tabs.ts](https://github.com/vercel-labs/agent-browser/blob/0207911f1bd4d0393eddaa90f2e50f96e0fb8974/packages/@agent-browser/eve/extension/tools/tabs.ts) | 当前HEAD已Rust native snapshot/document+session身份及ref失效；fill与append命令分开；不代表ORCA0.27代码，NAND保留strict snapshot revision。 | Apache-2.0 |
| browser-use/browser-use `c75e8476e26d18b7617643bc2ae082fae8eae431` | [browser_use/agent/service.py](https://github.com/browser-use/browser-use/blob/c75e8476e26d18b7617643bc2ae082fae8eae431/browser_use/agent/service.py)；[browser_use/browser/session.py](https://github.com/browser-use/browser-use/blob/c75e8476e26d18b7617643bc2ae082fae8eae431/browser_use/browser/session.py) | step=prepare context→model action→execute→postprocess/finalize；pause/stop检查。只作后期网页助手循环参考，不为固定多站发送引LLM；其托管服务不随MIT代码自动免费提供。 | MIT |
| browserbase/stagehand `2d605b099996e10c3e3ab0dcf293db8d482a2c97` | [packages/extension/handlers/handlerUtils/actHandlerUtils.ts](https://github.com/browserbase/stagehand/blob/2d605b099996e10c3e3ab0dcf293db8d482a2c97/packages/extension/handlers/handlerUtils/actHandlerUtils.ts)；[packages/integrations/core/src/facade/tools.ts](https://github.com/browserbase/stagehand/blob/2d605b099996e10c3e3ab0dcf293db8d482a2c97/packages/integrations/core/src/facade/tools.ts)；[packages/cli/src/lib/driver/commands/elements.ts](https://github.com/browserbase/stagehand/blob/2d605b099996e10c3e3ab0dcf293db8d482a2c97/packages/cli/src/lib/driver/commands/elements.ts) | 方法handler map/跨frame locator/Progress和source记录，facade snapshot id与session loss；确定动作+局部AI思路。当前HEAD目录不同于旧v3示例，按pin实施。 | MIT |
| web-infra-dev/midscene `de4124e16c9e88a657a872afe8287c0c00d174eb` | [packages/core/src/agent/agent.ts](https://github.com/web-infra-dev/midscene/blob/de4124e16c9e88a657a872afe8287c0c00d174eb/packages/core/src/agent/agent.ts)；[packages/web-integration/src/playwright/agent.ts](https://github.com/web-infra-dev/midscene/blob/de4124e16c9e88a657a872afe8287c0c00d174eb/packages/web-integration/src/playwright/agent.ts) | aiTap/aiAssert/aiWaitFor与报告/abort；视觉结果检查候选，成本和误定位另验证。首版不引视觉无限fallback。 | MIT |
| nanobrowser/nanobrowser `ad47282a17ecdfb894745af093e0f7332fc1f71a` | [src/background/agent/executor.ts](https://github.com/nanobrowser/nanobrowser/blob/ad47282a17ecdfb894745af093e0f7332fc1f71a/src/background/agent/executor.ts)；[src/background/agent/agents/navigator.ts](https://github.com/nanobrowser/nanobrowser/blob/ad47282a17ecdfb894745af093e0f7332fc1f71a/src/background/agent/agents/navigator.ts) | planner/navigator、maxSteps、follow-up、execution事件、planner确认done。多模型配置不是多AI官网同时提问；借鉴可见任务状态。 | Apache-2.0 |
| Skyvern-AI/skyvern `5cd25fc6f0aba9eaed01761ee0597c96e4a24fb9` | [README.md](https://github.com/Skyvern-AI/skyvern/blob/5cd25fc6f0aba9eaed01761ee0597c96e4a24fb9/README.md)；[LICENSE](https://github.com/Skyvern-AI/skyvern/blob/5cd25fc6f0aba9eaed01761ee0597c96e4a24fb9/LICENSE) | 只读公开产品/许可：SDK+no-code workflow、live viewport、local/cloud边界，cloud另含基础设施/防护服务。未读实现，NAND不复制AGPL代码。 | AGPL-3.0 |
| AutomaApp/automa `a4cbe34a60c92873c48c2470ca8ab1d96c22c7a0` | [README.md](https://github.com/AutomaApp/automa/blob/a4cbe34a60c92873c48c2470ca8ab1d96c22c7a0/README.md)；[LICENSE.txt](https://github.com/AutomaApp/automa/blob/a4cbe34a60c92873c48c2470ca8ab1d96c22c7a0/LICENSE.txt) | 只读公开产品/许可：可视blocks、表单/重复步骤/定时；business目录commercial其余AGPL。借鉴用户能理解的step/input/result，不复制实现。 | AGPL + Automa Commercial |
| browseros-ai/BrowserOS `0e3fd7dd1f7b17b38815fd3f228ec2578cc4f028` | [README.md](https://github.com/browseros-ai/BrowserOS/blob/0e3fd7dd1f7b17b38815fd3f228ec2578cc4f028/README.md)；[LICENSE](https://github.com/browseros-ai/BrowserOS/blob/0e3fd7dd1f7b17b38815fd3f228ec2578cc4f028/LICENSE) | 只读公开产品/许可：当前README主推neo作为给agent的第二浏览器、live dashboard与回放；不是NAND需要fork Chromium的证据，也不承诺其登录导入宣传在NAND成立。 | AGPL-3.0 |
| webmachinelearning/webmcp `b206dae8bad34ea8e6ff7213b417b50b14a37e9a` | [README.md](https://github.com/webmachinelearning/webmcp/blob/b206dae8bad34ea8e6ff7213b417b50b14a37e9a/README.md)；[index.bs](https://github.com/webmachinelearning/webmcp/blob/b206dae8bad34ea8e6ff7213b417b50b14a37e9a/index.bs)；[LICENSE.md](https://github.com/webmachinelearning/webmcp/blob/b206dae8bad34ea8e6ff7213b417b50b14a37e9a/LICENSE.md) | 网站主动注册结构化tool，human协作；属于前端site能力，与backend MCP不同。AI官网支持必须实际探测，不能假设已有。 | W3C Software and Document License |


## 11. 官方平台资料核验

- Electron webview官方指出其稳定性/事件路由在变化并建议评估替代容器；这不能跨越Obsidian宿主权限直接当迁移指令。[webview](https://www.electronjs.org/docs/latest/api/webview-tag)、[WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view)。
- Electron支持Chrome扩展API子集，不能原样安装任意商店扩展；MAIW WXT background/navigation/DNR必须重新映射到NAND。[extension支持](https://www.electronjs.org/docs/latest/api/extensions)。
- Playwright连接既有Chromium CDP的能力完整性低于其原生连接，因此「能接上」不是richtext/跨frame/截图/download全部通过。[connectOverCDP](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp)。
- Chrome136后的默认profile远程调试限制否定「开调试端口直接接管日常Chrome」的默认路线。[Chrome官方变更](https://developer.chrome.com/blog/remote-debugging-port)。
- 保留Electron网页隔离、权限决策，不能为兼容性关sandbox/webSecurity。[Electron安全](https://www.electronjs.org/docs/latest/tutorial/security)。
- WebMCP官方为early preview，实际目标Electron版本/网站实现必须核实；不是现在八家AI网站已经有tool接口的证据。[Chrome WebMCP](https://developer.chrome.com/blog/webmcp-epp)。
- WebDriver BiDi/跨浏览器协议属于工具底层路线，用于需要跨浏览器的后期验证，不是当前Obsidian UI实现方式。[Selenium BiDi](https://www.selenium.dev/documentation/webdriver/bidi/)。

## 12. 原 issue 全部 immutable 源链接与抓取审计

以下44个原issue固定blob链接均成功获取。目录= `pinned-source/<repo>/...`；清单 `pinned-source-files.json`。源码阅读聚焦相关方法/关键路径、测试场景与UI状态；未声称所有项目全仓库逐行读完。

实际计数：{'NAMEWTA/multi-ai-browser-extension': 23, 'stablyai/orca': 21}。

| Repository | Immutable source locator | Local SHA-256 |
|---|---|---|
| NAMEWTA/multi-ai-browser-extension | [README.md](https://github.com/NAMEWTA/multi-ai-browser-extension/blob/b6b83ca90f0f67fbf25a676e7a8f6b8b34327800/README.md) | `261de7bcd52a6a9e0788efce93598df36ce9b77d91dfbb1eb94b02625bc35f65` |
| NAMEWTA/multi-ai-browser-extension | [docs/changes/2026-09-01-provider-conversation-acquisition-v2/design.md](https://github.com/NAMEWTA/multi-ai-browser-extension/blob/b6b83ca90f0f67fbf25a676e7a8f6b8b34327800/docs/changes/2026-09-01-provider-conversation-acquisition-v2/design.md) | `d4727fed0aec37e32339c6f6330ade10c46c1f2816354d802eea28668f8731f0` |
| NAMEWTA/multi-ai-browser-extension | [src/core/acquisition/engine.ts](https://github.com/NAMEWTA/multi-ai-browser-extension/blob/b6b83ca90f0f67fbf25a676e7a8f6b8b34327800/src/core/acquisition/engine.ts) | `5a88d55032cf2af222da9b64cf08c6c4376cb1799918f0f218bb1417004257ac` |
| NAMEWTA/multi-ai-browser-extension | [src/core/acquisition/quality-gate.ts](https://github.com/NAMEWTA/multi-ai-browser-extension/blob/b6b83ca90f0f67fbf25a676e7a8f6b8b34327800/src/core/acquisition/quality-gate.ts) | `623fc264b6f88965e1386a081e508de1100e8258032224c8ffdae1191c7b4b62` |
| NAMEWTA/multi-ai-browser-extension | [src/core/messaging/response-revision.ts](https://github.com/NAMEWTA/multi-ai-browser-extension/blob/b6b83ca90f0f67fbf25a676e7a8f6b8b34327800/src/core/messaging/response-revision.ts) | `e954108069daf965099cf48fd680907ecec803bfb95429a29663d6be525b98f9` |
| NAMEWTA/multi-ai-browser-extension | [src/core/orchestration/task-ledger.ts](https://github.com/NAMEWTA/multi-ai-browser-extension/blob/b6b83ca90f0f67fbf25a676e7a8f6b8b34327800/src/core/orchestration/task-ledger.ts) | `1969dd841dc3b8fd3747be8ebe91860239a7c5428b76d65abd45295979f9f00e` |
| NAMEWTA/multi-ai-browser-extension | [src/core/permissions/frame-policy-manager.ts](https://github.com/NAMEWTA/multi-ai-browser-extension/blob/b6b83ca90f0f67fbf25a676e7a8f6b8b34327800/src/core/permissions/frame-policy-manager.ts) | `aa9e411834932d3518cca2d3d7cbc4669e6b594bd43b6e6d8ec9eea1925ab391` |
| NAMEWTA/multi-ai-browser-extension | [src/core/providers/base-dom-strategy.test.ts](https://github.com/NAMEWTA/multi-ai-browser-extension/blob/b6b83ca90f0f67fbf25a676e7a8f6b8b34327800/src/core/providers/base-dom-strategy.test.ts) | `880eb41e7d7bbc3771ac1cd83050ecc33b55ae7320bb9592b2b7cbcc668f4b6c` |
| NAMEWTA/multi-ai-browser-extension | [src/core/providers/base-dom-strategy.ts](https://github.com/NAMEWTA/multi-ai-browser-extension/blob/b6b83ca90f0f67fbf25a676e7a8f6b8b34327800/src/core/providers/base-dom-strategy.ts) | `f8d05b664c4513630f0f3d69ddb62910192b3376149331fa2035732cd15fda3b` |
| NAMEWTA/multi-ai-browser-extension | [src/core/providers/built-in-sites.ts](https://github.com/NAMEWTA/multi-ai-browser-extension/blob/b6b83ca90f0f67fbf25a676e7a8f6b8b34327800/src/core/providers/built-in-sites.ts) | `2256d155c47389d7e51cd8989286644502a9432b3841c298ac340b8419cbd5a2` |
| NAMEWTA/multi-ai-browser-extension | [src/core/providers/native-copy.ts](https://github.com/NAMEWTA/multi-ai-browser-extension/blob/b6b83ca90f0f67fbf25a676e7a8f6b8b34327800/src/core/providers/native-copy.ts) | `36ce4624fe1e21860dbcafb05760e72f44f845a26b79c14308b11de30718d902` |
| NAMEWTA/multi-ai-browser-extension | [src/db/acquisition-snapshot-service.ts](https://github.com/NAMEWTA/multi-ai-browser-extension/blob/b6b83ca90f0f67fbf25a676e7a8f6b8b34327800/src/db/acquisition-snapshot-service.ts) | `378daa2455d2847567e467edb21c3ffaf122af2fc7c531a1f44284c565c93ee6` |
| NAMEWTA/multi-ai-browser-extension | [src/db/database.ts](https://github.com/NAMEWTA/multi-ai-browser-extension/blob/b6b83ca90f0f67fbf25a676e7a8f6b8b34327800/src/db/database.ts) | `4f242c97dd3d69d2ca33165faec5a71c19707a373b5cedff0dbacb074fcd7412` |
| NAMEWTA/multi-ai-browser-extension | [src/db/history-transfer.ts](https://github.com/NAMEWTA/multi-ai-browser-extension/blob/b6b83ca90f0f67fbf25a676e7a8f6b8b34327800/src/db/history-transfer.ts) | `0e925fabe111412f69a5365aeb7b80afc1c15012cda68bccd197e40e19321f87` |
| NAMEWTA/multi-ai-browser-extension | [src/entrypoints/acquisition-network-main.content.ts](https://github.com/NAMEWTA/multi-ai-browser-extension/blob/b6b83ca90f0f67fbf25a676e7a8f6b8b34327800/src/entrypoints/acquisition-network-main.content.ts) | `8cc1d82d1f15d128c3f8ca6b3ef4d4a568f0bdcd1e6f8e2f6171b84e0005e4e9` |
| NAMEWTA/multi-ai-browser-extension | [src/entrypoints/background.ts](https://github.com/NAMEWTA/multi-ai-browser-extension/blob/b6b83ca90f0f67fbf25a676e7a8f6b8b34327800/src/entrypoints/background.ts) | `f636811b6e03812187d2cc8c5f9af698833f153d2d9a25efd37587a5f9ee129e` |
| NAMEWTA/multi-ai-browser-extension | [src/entrypoints/provider-bridge.content.ts](https://github.com/NAMEWTA/multi-ai-browser-extension/blob/b6b83ca90f0f67fbf25a676e7a8f6b8b34327800/src/entrypoints/provider-bridge.content.ts) | `c24a8be5d8856a5b70a90bd5d328a8244f2d745ac390994f54b5626cf4903662` |
| NAMEWTA/multi-ai-browser-extension | [src/entrypoints/workspace/prompt-library-store.ts](https://github.com/NAMEWTA/multi-ai-browser-extension/blob/b6b83ca90f0f67fbf25a676e7a8f6b8b34327800/src/entrypoints/workspace/prompt-library-store.ts) | `079d0eb675d25fc262cc39a40450ace7805754d7ecd28279c0f19409fd16a0d1` |
| NAMEWTA/multi-ai-browser-extension | [src/entrypoints/workspace/session-history-detail.tsx](https://github.com/NAMEWTA/multi-ai-browser-extension/blob/b6b83ca90f0f67fbf25a676e7a8f6b8b34327800/src/entrypoints/workspace/session-history-detail.tsx) | `1d8afa893f9ef5631642370e8d1c227a2849ef5f42f9f68c0a4f37b3ca6e9eb9` |
| NAMEWTA/multi-ai-browser-extension | [src/entrypoints/workspace/workspace-app.tsx](https://github.com/NAMEWTA/multi-ai-browser-extension/blob/b6b83ca90f0f67fbf25a676e7a8f6b8b34327800/src/entrypoints/workspace/workspace-app.tsx) | `4611dd2290a580337a2ef8c7333076b75e24a004e6a1175bbc994b0c11d33703` |
| NAMEWTA/multi-ai-browser-extension | [src/entrypoints/workspace/workspace-store.ts](https://github.com/NAMEWTA/multi-ai-browser-extension/blob/b6b83ca90f0f67fbf25a676e7a8f6b8b34327800/src/entrypoints/workspace/workspace-store.ts) | `5d114254a5db8076b313ce349d4e5c464645edd6c98702bfe7a46fbf3652f7fa` |
| NAMEWTA/multi-ai-browser-extension | [tests/live/real-sites.spec.ts](https://github.com/NAMEWTA/multi-ai-browser-extension/blob/b6b83ca90f0f67fbf25a676e7a8f6b8b34327800/tests/live/real-sites.spec.ts) | `e8cb0785dc63d95d9a21f93c2912ab689576e7d8214e1e5d0c505a277329b815` |
| NAMEWTA/multi-ai-browser-extension | [wxt.config.ts](https://github.com/NAMEWTA/multi-ai-browser-extension/blob/b6b83ca90f0f67fbf25a676e7a8f6b8b34327800/wxt.config.ts) | `66da6589d913e1b810282b333a6ca2e4271b0aeab69c499244274fa5cb082967` |
| stablyai/orca | [docs/site/content/docs/browser/design-mode.mdx](https://github.com/stablyai/orca/blob/e3639ef8d69209b8278b41c0e722811960ea7ec0/docs/site/content/docs/browser/design-mode.mdx) | `4e6c8d177cd228a44840b823e7f6051348d6f09de3e9e5d5a1bd7577f55679f1` |
| stablyai/orca | [docs/site/content/docs/browser/profiles.mdx](https://github.com/stablyai/orca/blob/e3639ef8d69209b8278b41c0e722811960ea7ec0/docs/site/content/docs/browser/profiles.mdx) | `619aade7f65ce1d8c4bf8e77e0bb880c1aafb44b7c4618573a2361ae6bb8099e` |
| stablyai/orca | [package.json](https://github.com/stablyai/orca/blob/e3639ef8d69209b8278b41c0e722811960ea7ec0/package.json) | `794d77ff5d5127bfd1881a8d0d2554accd253b90c2a3cd135c9edd4cbd483c23` |
| stablyai/orca | [src/cli/handlers/browser-capture.ts](https://github.com/stablyai/orca/blob/e3639ef8d69209b8278b41c0e722811960ea7ec0/src/cli/handlers/browser-capture.ts) | `172ad59350524a6fdebeb17a27239eeee0d0cfbaa6d221520c81006d7d303625` |
| stablyai/orca | [src/cli/handlers/browser-interact.ts](https://github.com/stablyai/orca/blob/e3639ef8d69209b8278b41c0e722811960ea7ec0/src/cli/handlers/browser-interact.ts) | `e2c3ddbdfca82279889d482729d655cc795112c61f104e133d40888e2d63ef9e` |
| stablyai/orca | [src/main/browser/agent-browser-bridge-core-commands.ts](https://github.com/stablyai/orca/blob/e3639ef8d69209b8278b41c0e722811960ea7ec0/src/main/browser/agent-browser-bridge-core-commands.ts) | `d587a7e7c3bd368c9003802607edd20def98e64442cd6d5914779c633feebd03` |
| stablyai/orca | [src/main/browser/agent-browser-bridge-execution.ts](https://github.com/stablyai/orca/blob/e3639ef8d69209b8278b41c0e722811960ea7ec0/src/main/browser/agent-browser-bridge-execution.ts) | `ad2d61eee8c18273c472a28e07f0858b98eea3ba133472cca20a0fe59984f399` |
| stablyai/orca | [src/main/browser/agent-browser-bridge-lifecycle.ts](https://github.com/stablyai/orca/blob/e3639ef8d69209b8278b41c0e722811960ea7ec0/src/main/browser/agent-browser-bridge-lifecycle.ts) | `56aad9b4ca6ca0fbec8a669e2aeabd23c805c9188d6234e88ba441fcf07fed11` |
| stablyai/orca | [src/main/browser/agent-browser-bridge-queue.ts](https://github.com/stablyai/orca/blob/e3639ef8d69209b8278b41c0e722811960ea7ec0/src/main/browser/agent-browser-bridge-queue.ts) | `2dfd7c740a33e0f8eabb3638d8d9ed9ead06715759a0fba037087b4d9dde4541` |
| stablyai/orca | [src/main/browser/agent-browser-bridge-session-lifecycle.test.ts](https://github.com/stablyai/orca/blob/e3639ef8d69209b8278b41c0e722811960ea7ec0/src/main/browser/agent-browser-bridge-session-lifecycle.test.ts) | `c725ae4509484b3d5caf7e496c223e7eb6231e5bbc4c487a0bf30183bad73e6b` |
| stablyai/orca | [src/main/browser/agent-browser-bridge-tab-routing.test.ts](https://github.com/stablyai/orca/blob/e3639ef8d69209b8278b41c0e722811960ea7ec0/src/main/browser/agent-browser-bridge-tab-routing.test.ts) | `70befd8919bb3f69259cbefe5f4b01c10f9f48b9de20fcc07630b37c998a000a` |
| stablyai/orca | [src/main/browser/agent-browser-bridge-tabs.ts](https://github.com/stablyai/orca/blob/e3639ef8d69209b8278b41c0e722811960ea7ec0/src/main/browser/agent-browser-bridge-tabs.ts) | `2aaebf4546fbb2ccadc57b3736ff2096e1ec1948d14374f973f656ad740ea357` |
| stablyai/orca | [src/main/browser/browser-backend.ts](https://github.com/stablyai/orca/blob/e3639ef8d69209b8278b41c0e722811960ea7ec0/src/main/browser/browser-backend.ts) | `c476fea3351a21dbc57b5c5d70db3aa8cd408a634694b7315c89b6c9055882bb` |
| stablyai/orca | [src/main/browser/browser-manager-grab.ts](https://github.com/stablyai/orca/blob/e3639ef8d69209b8278b41c0e722811960ea7ec0/src/main/browser/browser-manager-grab.ts) | `0028d7eb64b230c2daa8e4e9eaa3c648c492a0867bc2f10e16e2ee08f7e0dc9f` |
| stablyai/orca | [src/main/browser/browser-manager-registration.ts](https://github.com/stablyai/orca/blob/e3639ef8d69209b8278b41c0e722811960ea7ec0/src/main/browser/browser-manager-registration.ts) | `94c358e76debf0a0bba427ff6fd731481013a7489ca18d8157c529e294d48a81` |
| stablyai/orca | [src/main/browser/browser-session-registry.ts](https://github.com/stablyai/orca/blob/e3639ef8d69209b8278b41c0e722811960ea7ec0/src/main/browser/browser-session-registry.ts) | `d17e1328fb0b824e91c588678a09f4e3e49910f1878c22bebb6e2dcaf77f4256` |
| stablyai/orca | [src/main/browser/cdp-debugger-channel.ts](https://github.com/stablyai/orca/blob/e3639ef8d69209b8278b41c0e722811960ea7ec0/src/main/browser/cdp-debugger-channel.ts) | `9d4f246732457d3e19f16604276ef142d263e7b436deb8ad1471ed5ea2f2dd42` |
| stablyai/orca | [src/main/browser/cdp-ref-resolution.ts](https://github.com/stablyai/orca/blob/e3639ef8d69209b8278b41c0e722811960ea7ec0/src/main/browser/cdp-ref-resolution.ts) | `286a3ea0b0255fdc06758cac036b86e30757003f85c02e4df71eacb438ca2121` |
| stablyai/orca | [src/main/browser/cdp-ws-proxy.ts](https://github.com/stablyai/orca/blob/e3639ef8d69209b8278b41c0e722811960ea7ec0/src/main/browser/cdp-ws-proxy.ts) | `45c7deb0bfcd08df4025481669d5abf6c6cfad14d64c694544b17e0fab1b8367` |
| stablyai/orca | [src/main/browser/offscreen-browser-backend.ts](https://github.com/stablyai/orca/blob/e3639ef8d69209b8278b41c0e722811960ea7ec0/src/main/browser/offscreen-browser-backend.ts) | `8b95881c0ee96155fa8f7b9026c46be5232c09b4a9646a189e029b65da47d326` |
| stablyai/orca | [src/main/browser/snapshot-engine.ts](https://github.com/stablyai/orca/blob/e3639ef8d69209b8278b41c0e722811960ea7ec0/src/main/browser/snapshot-engine.ts) | `ff59d0de4c620300eb89e57761dc306e4e2162ec668d50d2f91a96e53896fb46` |

## 本次最终核对

重新读取GitHub仍为原13个open issue，updated_at无漂移。上述研究中候选票数/未决偏好为探索轨迹；最终权威为当前Spec与61票整体清单，用户已明确确认全部G设计分支。权限writer覆盖及每级symlink；Git库外unstage-all与实际push target；档案准确字节规模工具；终端五平台资产验证；HOME_WIDGETS每模块provider bundle；dispatch交付与prompt结果严格分离；自动化typed workflow装配、编辑器和receipt；browser内部scope与短期runContext env仅最终spawn合并、不进入accountKey；浏览器manifest和真正UI入口；永久ADR保持只读；站点/历史等虚假串行依赖已移除。
