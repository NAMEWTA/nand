---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c8fe48347cd03367c384ca52535cc1981de658721fa82093b34c271c25d295d6","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path>","T-16 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"225d8082b4b9d96b301df2f7582166cc1e3606be3f7225c4cb8c268159018ca7","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"64f00b01fd2537b7cd04387161560e9a86e25934baa923eebf5758d799719a3f","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"e2aff3c8f7c91f7c7925cd47cc5d15ebc346bb95cd5e2267c5232a90faf8ab29","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/module-authoring.md</Path>","sha256":"add18e61df97494df0d6f0ab45a5920bc0132779e6a33d53bc6c41ff1b701aab","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/settings-and-i18n.md</Path>","sha256":"4060df9ba64b510306c301238897be1635060ff177f900d37fe36abab8100751","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"0a43258e725781151d926c4f54fd4b8eebee5d58f008cb2434b7c796b450a51d","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/licensing.md</Path>","sha256":"f0c531122eaaf014fcdf73c5ba1ffd07518b7a7a7ff29b19b3030e057791ce8f","when":"本票命中结构/数据或验证"}]},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"8c362a984536481585cceeae64d8fcc784f56451262444e0400660b19c801044","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path>","T-16 路径、合同和本次diff"],"outputs":["满足tokens/三栏/键盘/多窗/响应式的界面与真实宿主观察"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/ui/references/design-system.md</Path>","sha256":"a551e294d6818a585464fb0c391be8575ba9e92d8226c9b592fa55b8637f672a","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/shell.md</Path>","sha256":"4baa20033d66228c19eb08d807fbd7d338504fae40df7b56992f40593c3ce833","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/motion-a11y.md</Path>","sha256":"be9695c35e8e8608d50b2ac34307e4debdefad99171c1a0352aabd6149e5f7f4","when":"本票命中页面/组件或CSS"}]}]
resource_claims: ["nand:browser-ai-workbench:scoped-web-assistant","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-browser-ai-workbench"
id: "T-16"
title: "独立 opt-in 的受限网页助手与人工接管"
status: "done"
kind: "feature"
planning_depth: "deep"
planning_depth_reason: "涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。"
ready: false
risk: "high"
blocked_by: ["T-08"]
contract_ids: ["AC-025","AC-033","AC-034","AC-039"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>src/modules/browser/core/assistant/model.ts</Path>","<Path>src/modules/browser/services/assistant.ts</Path>","<Path>src/modules/browser/services/ownership.ts</Path>","<Path>src/modules/browser/ui/WebAssistant.tsx</Path>","<Path>src/modules/browser/ui/ConsequenceConfirmation.tsx</Path>","<Path>src/modules/browser/ui/workbench-page.ts</Path>","<Path>src/modules/browser/api.ts</Path>","<Path>src/modules/browser/module.ts</Path>","<Path>src/modules/browser/i18n.ts</Path>","<Path>src/modules/browser/services/assistant.test.ts</Path>","<Path>src/app/workbench/compose-workbench.ts</Path>"]
writable_paths: ["<Path>src/modules/browser/core/assistant/model.ts</Path>","<Path>src/modules/browser/services/assistant.ts</Path>","<Path>src/modules/browser/services/ownership.ts</Path>","<Path>src/modules/browser/ui/WebAssistant.tsx</Path>","<Path>src/modules/browser/ui/ConsequenceConfirmation.tsx</Path>","<Path>src/modules/browser/ui/workbench-page.ts</Path>","<Path>src/modules/browser/api.ts</Path>","<Path>src/modules/browser/module.ts</Path>","<Path>src/modules/browser/i18n.ts</Path>","<Path>src/modules/browser/services/assistant.test.ts</Path>","<Path>src/app/workbench/compose-workbench.ts</Path>","<Path>src/modules/browser/platform/desktop/bridge.ts</Path>","<Path>src/modules/browser/services/agent-run-context.ts</Path>","<Path>src/modules/browser/services/agent-run-context.test.ts</Path>","<Path>src/modules/browser/manifest.ts</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>","<Path>src/modules/browser/module.ts</Path>","<Path>src/modules/browser/i18n.ts</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-browser-ai-workbench::T-16（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-browser-ai-workbench::T-16（本票生成物专用owner；Lead从本票已审核源重建）","<Path>src/modules/browser/module.ts</Path> => 2026-10-08-browser-ai-workbench::T-16（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/browser/i18n.ts</Path> => 2026-10-08-browser-ai-workbench::T-16（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）"]
---

# Ticket T-16: 独立 opt-in 的受限网页助手与人工接管

<!-- ACCEPTANCE-20261011 -->
最终验收与授权以 [completion.md](../evidence/completion.md) 为准。原规划与原始未验证结论保留。

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查：[T-16.md](../evidence/T-16.md)。本票下文保留原规划合同与基线；当前实现、修复、验证及未验证条件以该记录为准。原“仅规划／未授权实施／必须提交”的阶段约束不适用于用户已授权的本次工作区审查；提交与远程操作仍未执行。
<!-- ACTUAL-CODE-REVIEW:END -->

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/16-scoped-web-assistant.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-16.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** 用户在指定page/profile/task范围让已有agent辅助完成网页步骤，看到结果证据并可随时同页接管。

**规划时基线：** 已有浏览器CLI/工具但无user-facing scoped task循环；home owning dispatch负责agent进程/receipt，browser拥有授权与控制，不重复底座。

**来源：** AC-025, AC-033, AC-034, AC-039；issue #142, #145；<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/reference-analysis.md</Path>。深度 deep：涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。

## 2. 决策状态

### 已锁定决策

AssistantTask{id,pageIds,profileIds,allowedOperations,goal,agentSessionId,owner,steps,state,resultEvidence}；网页文本只作为观察数据；每次控制经过scope+ownership+generation。计划步数/时间有用户可见运行上限，达到即停并说明，不无限自我重试。高后果支付/公开发布/删除需最终对象内容目的地确认，与单纯fill/普通提问区分；确认不跨对象复用。 公共AGENT_DISPATCH delivery=started/pasted/timeout/rejected不等于模型完成；fresh显式选择才自动启动，existing pasted须用户后续提交。最终输出只消费owner提供的completion/artifact capability，自动结果消费news::T-02在agent/api.ts交付的AGENT_PROMPT_RUNNER，不造新CLI解析/agent底座。 自动执行只调用一次AGENT_PROMPT_RUNNER {agentId,cwd,prompt,title,timeoutMs,signal?,reveal?,keepTerminal?,resultChannel?}，消费完整{text,status:succeeded|failed|cancelled|interrupted|timeout,usage?,terminalId,errorCode?}及running/needs-attention；不先dispatch再runner造成重复。AGENT_DISPATCH仅用于显式existing贴入/常规交付路线，existing=pasted不自动推断完成。 本票先交付最小内部scoped grant：只绑定当前页/任务和明确能力，TTL、generation、单次runId绑定，可取消/撤回，继承用户手动接管门。通过agent/api的AGENT_RUN_CONTEXTS注册browser provider，AGENT_PROMPT_RUNNER只接收runContext:{provider:browser,handle}，token仅由resolver放入该run环境，不写prompt/argv/Markdown/receipt；取消/超时/模块off最终撤权。此内部能力在T-16完成，不等待T-20；T-20只提供外部客户端授权管理和撤回UI。 在browser/manifest.ts声明本票新增provides/contributes并在module.ts真实装配；不能只导出api类型或未注册组件。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| 用户在指定page/profile/task范围让已有agent辅助完成网页步骤，看到结果证据并可随时同页接管。 | BrowserModule/page/presentation、BrowserOperationQueue、snapshot epoch:revision、debugger lease、guest permissions、Design Mode/markup、bridge/token/CLI。; 现有 workbench feature browser、NativeSurface、PanelModel、focus-mode 页面与视图生命周期；不新增 view/router/tab system。; DocumentRepository/markdown-document 保留非拥有内容；DurableState 的 flush/error/recovery；namespaced settings；Preact/primitives/tokens。; agent/api.ts 由 home 专票交付的 dispatch / normalized receipt；attachMaterial 仍仅粘贴，不能当 dispatch。automations/api.ts 既有 scheduler/run 与 home 专票 receipt。; news 的结构化 CLI 输出由 news 专票拥有；browser 如消费仅经公开 API/receipt，禁止另建 CLI provider SDK、agent 进程底座或 scheduler。 | 不实现完整日常浏览器、Chromium fork、独立云浏览器集群或企业跨环境 Grid；其参考仅记录取舍。; 不统一附件上传、模型切换、thinking 开关；站点显示不可靠的模型元数据记 unknown。; 不镜像全部官网历史/所有分支/附件，不导出 cookie/secret，不保证一键迁移 Chrome 登录、Google SSO 或 OS passkey。; 不把多模型一致当真实性验证；不自动投票，不用视觉/LLM 做固定发送的无界兜底。; 不默认开放远程端口、无人值守支付/发布/删除，不把 WebMCP early preview 当八站现有能力。 |

## 4. 要构建什么

用户在指定page/profile/task范围让已有agent辅助完成网页步骤，看到结果证据并可随时同页接管。

AssistantTask{id,pageIds,profileIds,allowedOperations,goal,agentSessionId,owner,steps,state,resultEvidence}；网页文本只作为观察数据；每次控制经过scope+ownership+generation。计划步数/时间有用户可见运行上限，达到即停并说明，不无限自我重试。高后果支付/公开发布/删除需最终对象内容目的地确认，与单纯fill/普通提问区分；确认不跨对象复用。 公共AGENT_DISPATCH delivery=started/pasted/timeout/rejected不等于模型完成；fresh显式选择才自动启动，existing pasted须用户后续提交。最终输出只消费owner提供的completion/artifact capability，自动结果消费news::T-02在agent/api.ts交付的AGENT_PROMPT_RUNNER，不造新CLI解析/agent底座。 自动执行只调用一次AGENT_PROMPT_RUNNER {agentId,cwd,prompt,title,timeoutMs,signal?,reveal?,keepTerminal?,resultChannel?}，消费完整{text,status:succeeded|failed|cancelled|interrupted|timeout,usage?,terminalId,errorCode?}及running/needs-attention；不先dispatch再runner造成重复。AGENT_DISPATCH仅用于显式existing贴入/常规交付路线，existing=pasted不自动推断完成。 本票先交付最小内部scoped grant：只绑定当前页/任务和明确能力，TTL、generation、单次runId绑定，可取消/撤回，继承用户手动接管门。通过agent/api的AGENT_RUN_CONTEXTS注册browser provider，AGENT_PROMPT_RUNNER只接收runContext:{provider:browser,handle}，token仅由resolver放入该run环境，不写prompt/argv/Markdown/receipt；取消/超时/模块off最终撤权。此内部能力在T-16完成，不等待T-20；T-20只提供外部客户端授权管理和撤回UI。 在browser/manifest.ts声明本票新增provides/contributes并在module.ts真实装配；不能只导出api类型或未注册组件。

## 5. 实现契约

- **入口、输入输出、状态和错误：** AssistantTask{id,pageIds,profileIds,allowedOperations,goal,agentSessionId,owner,steps,state,resultEvidence}；网页文本只作为观察数据；每次控制经过scope+ownership+generation。计划步数/时间有用户可见运行上限，达到即停并说明，不无限自我重试。高后果支付/公开发布/删除需最终对象内容目的地确认，与单纯fill/普通提问区分；确认不跨对象复用。 公共AGENT_DISPATCH delivery=started/pasted/timeout/rejected不等于模型完成；fresh显式选择才自动启动，existing pasted须用户后续提交。最终输出只消费owner提供的completion/artifact capability，自动结果消费news::T-02在agent/api.ts交付的AGENT_PROMPT_RUNNER，不造新CLI解析/agent底座。 自动执行只调用一次AGENT_PROMPT_RUNNER {agentId,cwd,prompt,title,timeoutMs,signal?,reveal?,keepTerminal?,resultChannel?}，消费完整{text,status:succeeded|failed|cancelled|interrupted|timeout,usage?,terminalId,errorCode?}及running/needs-attention；不先dispatch再runner造成重复。AGENT_DISPATCH仅用于显式existing贴入/常规交付路线，existing=pasted不自动推断完成。 本票先交付最小内部scoped grant：只绑定当前页/任务和明确能力，TTL、generation、单次runId绑定，可取消/撤回，继承用户手动接管门。通过agent/api的AGENT_RUN_CONTEXTS注册browser provider，AGENT_PROMPT_RUNNER只接收runContext:{provider:browser,handle}，token仅由resolver放入该run环境，不写prompt/argv/Markdown/receipt；取消/超时/模块off最终撤权。此内部能力在T-16完成，不等待T-20；T-20只提供外部客户端授权管理和撤回UI。 在browser/manifest.ts声明本票新增provides/contributes并在module.ts真实装配；不能只导出api类型或未注册组件。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** T-08；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 读browser-use/Stagehand/Nanobrowser固定代码的任务/暂停/result模式，映射现有typed tools，禁止拉入完整框架或browser自建进程。 同时依赖news::T-02的AGENT_PROMPT_RUNNER，自动综合/助手走runner一次，手动existing路径走dispatch且pasted不称执行。
2. 实现assistant section页面、范围选择/会话选择/步骤与证据UI；自动运行仅调用公共AGENT_PROMPT_RUNNER，消费真实结果与状态，existing手动贴入不自动执行。 在现有bridge实现最小内部scoped grant并注册AGENT_RUN_CONTEXTS resolver，向runner传opaque handle，清理与run绑定。
3. 实现scope检查、page执行权、pause/stop/takeover/resume；所有工具从BROWSER_CONTROL进入，陈旧refs重新observe。
4. 实现具体高后果动作最终确认和拒绝路径；web prompt injection不能产生额外授权。
5. 针对跨页越界和暂停后无新mutation各写核心测试；真实host用无外部副作用表单完成任务并人工接管，再模拟高后果确认取消。
6. build/architecture/UI检查，写清默认关闭与数据去向。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 授权/状态 | 新增assistant.test.ts后 pnpm exec vitest run src/modules/browser/services/assistant.test.ts | 网页内容不能扩权，范围越界拒绝，pause后不派发，确认取消不执行。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-16.md</Path> |
| 真实任务 | 受控网页：指定page填表并校验；暂停人工改字段继续；另一page同名元素；高后果动作预览后取消 | 只操作授权page，人工改动被重新观察，取消无mutation；步骤/receipt可见。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-16.md</Path> |
| 构建/结构 | pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle | 相关源码零类型/架构/lint错误，模块lazy与预算合规；main.js已重建。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-16.md</Path> |
| UI/规范 | node scripts/build-styles.mjs --write；pnpm run lint:css；pnpm test:i18n；真实workbench在≥960、600–960、<600宽度及亮/暗/三preset查看 | styles.css重建，界面可读可键盘操作、可见focus、无新增设计系统；移动端控制边界明确。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-16.md</Path> |
| 助手授权边界 | 同库两页/两任务授予一个scope，跨页、过期、重用handle、手动接管和cancel后请求 | 无权请求拒绝，当前run可用；token不落prompt/receipt，dispose后请求全部失效 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-16.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** required: 同页人工接管、真实guest焦点和授权交互。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

只新增明确version的数据与可选入口，保持旧普通浏览器/default profile兼容；回滚代码前停新任务、导出用户Markdown，保留未知字段和journal，不回滚官网已提交事实。错误以明确reason/状态呈现，不自动重发。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-025**：停止新mutation；已dispatch事实明确完成/unknown；resume重验identity/draft/ref，不使用过期引用；人工操作不被旧执行抢回
- [ ] **AC-033**：助手只在授权page/action执行，复用BrowserControl/ownership和公共AGENT_PROMPT_RUNNER；needs-attention/取消/结果postcondition可见，无browser自建agentprocess或CLI reader。
- [ ] **AC-034**：页面文本不授权；越界拒绝；高后果展示对象/内容/目的地最终确认，拒绝无mutation；原有普通提问不加逐步确认
- [ ] **AC-039**：无残留guest hook/listener/queue/bridge/LLM会话owned任务；诊断去敏感；不破坏其他模块与普通浏览器
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-16.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。
- ui：<Path>.agents/skills/ui/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-16.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
