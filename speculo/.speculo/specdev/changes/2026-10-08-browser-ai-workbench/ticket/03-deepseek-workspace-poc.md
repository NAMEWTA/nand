---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path>","T-03 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"94a69cfa15eefec76596e82b3a37b34b2acc2cebef7df129879b609bad9a909b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"a073cad17a5bb3d782eae6157e7e110683ae6a8dbfca4c54970c8ab275252978","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"185a8191984ecb4fadf8d1d39f197ed05d56398b78ccf8ac43f87ca01e049193","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/module-authoring.md</Path>","sha256":"dfec45b11d78296560406f2808cf3824b271ea803b59d8d1ff87e105d12327b1","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/settings-and-i18n.md</Path>","sha256":"9d0c10748081b092c0f133949ff572a6414824eec625deaf724773ad2c9b9804","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"c515700efbe2ea4d57f58852e9225beb7ee17ad58484328450112068de13de7b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/licensing.md</Path>","sha256":"309783d96aca6bdf6287ae9a7e84619286300e06c3a08c776576c613387ccfbb","when":"本票命中结构/数据或验证"}]},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path>","T-03 路径、合同和本次diff"],"outputs":["满足tokens/三栏/键盘/多窗/响应式的界面与真实宿主观察"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/ui/references/design-system.md</Path>","sha256":"3320b960e15b308a2f5fa0573e00c80ec91bef911bbc5497f4bbc8d7dc10d59c","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/shell.md</Path>","sha256":"7331476350f3b0bb8dfa25186b7557914a4ad34c21410c60a95e152ff680c128","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/motion-a11y.md</Path>","sha256":"afc7b79fc9844989f7d295acdcbe5b4a6c31f5cb7add3b1e53e51c2a75f1980c","when":"本票命中页面/组件或CSS"}]}]
resource_claims: ["nand:browser-ai-workbench:deepseek-workspace-poc","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-browser-ai-workbench"
id: "T-03"
title: "交付 DeepSeek 任务到当前轮答案的源码 PoC"
status: "ready"
kind: "feature"
planning_depth: "deep"
planning_depth_reason: "涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。"
ready: true
risk: "high"
blocked_by: ["T-02"]
contract_ids: ["AC-005","AC-007","AC-010","AC-012","AC-016","AC-026"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>src/modules/browser/core/workspace/model.ts</Path>","<Path>src/modules/browser/core/providers/contracts.ts</Path>","<Path>src/modules/browser/services/workspace.ts</Path>","<Path>src/modules/browser/platform/workspace-store.ts</Path>","<Path>src/modules/browser/ui/MultiAiWorkspace.tsx</Path>","<Path>src/modules/browser/core/providers/deepseek.ts</Path>","<Path>src/modules/browser/platform/desktop/providers/deepseek.ts</Path>","<Path>src/modules/browser/platform/desktop/providers/network-capture.ts</Path>","<Path>src/modules/browser/ui/workbench-page.ts</Path>","<Path>src/modules/browser/api.ts</Path>","<Path>src/modules/browser/module.ts</Path>","<Path>src/modules/browser/i18n.ts</Path>","<Path>src/app/workbench/compose-workbench.ts</Path>","<Path>src/modules/browser/styles/ai-workspace.css</Path>","<Path>src/styles.json</Path>"]
writable_paths: ["<Path>src/modules/browser/core/workspace/model.ts</Path>","<Path>src/modules/browser/core/providers/contracts.ts</Path>","<Path>src/modules/browser/services/workspace.ts</Path>","<Path>src/modules/browser/platform/workspace-store.ts</Path>","<Path>src/modules/browser/ui/MultiAiWorkspace.tsx</Path>","<Path>src/modules/browser/core/providers/deepseek.ts</Path>","<Path>src/modules/browser/platform/desktop/providers/deepseek.ts</Path>","<Path>src/modules/browser/platform/desktop/providers/network-capture.ts</Path>","<Path>src/modules/browser/ui/workbench-page.ts</Path>","<Path>src/modules/browser/api.ts</Path>","<Path>src/modules/browser/module.ts</Path>","<Path>src/modules/browser/i18n.ts</Path>","<Path>src/app/workbench/compose-workbench.ts</Path>","<Path>src/modules/browser/styles/ai-workspace.css</Path>","<Path>src/styles.json</Path>","<Path>src/modules/browser/manifest.ts</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-browser-ai-workbench::T-03（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-browser-ai-workbench::T-03（本票生成物专用owner；Lead从本票已审核源重建）"]
---

# Ticket T-03: 交付 DeepSeek 任务到当前轮答案的源码 PoC

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查：[T-03.md](../evidence/T-03.md)。本票下文保留原规划合同与基线；当前实现、修复、验证及未验证条件以该记录为准。原“仅规划／未授权实施／必须提交”的阶段约束不适用于用户已授权的本次工作区审查；提交与远程操作仍未执行。
<!-- ACTUAL-CODE-REVIEW:END -->

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/03-deepseek-workspace-poc.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-03.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** 第一条真实可交付闭环：新task→DeepSeek真实新会话→输入预览→持久intent→发送确认→当前轮Markdown结果。

**规划时基线：** 当前只普通browser页面，无工作台业务和answer capture；既有CDP/page/profile可用。上游MAIW远端发送后记turn与内存ledger不可直接照搬。

**来源：** AC-005, AC-007, AC-010, AC-012, AC-016, AC-026；issue #142, #145；<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/reference-analysis.md</Path>。深度 deep：涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。

## 2. 决策状态

### 已锁定决策

建立本文task/turn/exchange/attempt/capture最小schema，DocumentRepository写可见Markdown，DurableState flush先于任何stage。DeepSeek adapter返回只读readiness/newConversation/输入读回/acceptedMessage/parent-child/current answer/terminal。若采集无法证完整则incomplete；同问题第二次是新turn。workspace服务durable，UI只订阅/发action；browser section状态由shell恢复。 在browser/manifest.ts声明本票新增provides/contributes并在module.ts真实装配；不能只导出api类型或未注册组件。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| 第一条真实可交付闭环：新task→DeepSeek真实新会话→输入预览→持久intent→发送确认→当前轮Markdown结果。 | BrowserModule/page/presentation、BrowserOperationQueue、snapshot epoch:revision、debugger lease、guest permissions、Design Mode/markup、bridge/token/CLI。; 现有 workbench feature browser、NativeSurface、PanelModel、focus-mode 页面与视图生命周期；不新增 view/router/tab system。; DocumentRepository/markdown-document 保留非拥有内容；DurableState 的 flush/error/recovery；namespaced settings；Preact/primitives/tokens。; agent/api.ts 由 home 专票交付的 dispatch / normalized receipt；attachMaterial 仍仅粘贴，不能当 dispatch。automations/api.ts 既有 scheduler/run 与 home 专票 receipt。; news 的结构化 CLI 输出由 news 专票拥有；browser 如消费仅经公开 API/receipt，禁止另建 CLI provider SDK、agent 进程底座或 scheduler。 | 不实现完整日常浏览器、Chromium fork、独立云浏览器集群或企业跨环境 Grid；其参考仅记录取舍。; 不统一附件上传、模型切换、thinking 开关；站点显示不可靠的模型元数据记 unknown。; 不镜像全部官网历史/所有分支/附件，不导出 cookie/secret，不保证一键迁移 Chrome 登录、Google SSO 或 OS passkey。; 不把多模型一致当真实性验证；不自动投票，不用视觉/LLM 做固定发送的无界兜底。; 不默认开放远程端口、无人值守支付/发布/删除，不把 WebMCP early preview 当八站现有能力。 |

## 4. 要构建什么

第一条真实可交付闭环：新task→DeepSeek真实新会话→输入预览→持久intent→发送确认→当前轮Markdown结果。

建立本文task/turn/exchange/attempt/capture最小schema，DocumentRepository写可见Markdown，DurableState flush先于任何stage。DeepSeek adapter返回只读readiness/newConversation/输入读回/acceptedMessage/parent-child/current answer/terminal。若采集无法证完整则incomplete；同问题第二次是新turn。workspace服务durable，UI只订阅/发action；browser section状态由shell恢复。 在browser/manifest.ts声明本票新增provides/contributes并在module.ts真实装配；不能只导出api类型或未注册组件。

## 5. 实现契约

- **入口、输入输出、状态和错误：** 建立本文task/turn/exchange/attempt/capture最小schema，DocumentRepository写可见Markdown，DurableState flush先于任何stage。DeepSeek adapter返回只读readiness/newConversation/输入读回/acceptedMessage/parent-child/current answer/terminal。若采集无法证完整则incomplete；同问题第二次是新turn。workspace服务durable，UI只订阅/发action；browser section状态由shell恢复。 在browser/manifest.ts声明本票新增provides/contributes并在module.ts真实装配；不能只导出api类型或未注册组件。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** T-02；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 读MAIW固定deepseek definition/selectors/strategy/acquisition/runtime-acquisition/native-copy及legacy/fragments fixtures；参考只确定策略，现场核验真实DOM。
2. 定义最小纯core adapter/turn类型及DocumentRepository存储，补intent flush失败零mutation的关键行为测试。
3. 实现desktop DeepSeek adapter和限站点网络采集，绑定profile/page/generation，确认新官网会话及当前消息父子关系。
4. 实现BROWSER_WORKSPACE服务单站流程与最小shell侧栏/任务/输入/结果纵向UI；接入existing page，写own i18n/styles。
5. 在真实已登录DeepSeek跑三轮与重复问题/长结构Markdown，记录接受证据/当前轮完整性；失败保持原page可人工操作。
6. 运行相关单元/build/architecture/UI检查；将PoC状态与未验证限制写执行证据，不宣称八站已支持。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 关键边界 | 新增workspace.test.ts（最近先例 browser.test.ts）后 pnpm exec vitest run src/modules/browser/services/workspace.test.ts | persist失败没有fill/click；相同问题第二次为新turn；消息身份错配不能complete。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-03.md</Path> |
| 真实单站 | 真实Obsidian+DeepSeek已登录：新task、连续三轮、一轮要求标题/表格/代码/公式、一次重复问题、手工接管 | 确认新官网上下文/提交与当前轮Markdown，未完成答案明确incomplete。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-03.md</Path> |
| 构建/结构 | pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle | 相关源码零类型/架构/lint错误，模块lazy与预算合规；main.js已重建。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-03.md</Path> |
| UI/规范 | node scripts/build-styles.mjs --write；pnpm run lint:css；pnpm test:i18n；真实workbench在≥960、600–960、<600宽度及亮/暗/三preset查看 | styles.css重建，界面可读可键盘操作、可见focus、无新增设计系统；移动端控制边界明确。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-03.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** required: 此票是可运行代码PoC，真实账号流程与fixture证据分别记录。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

只新增明确version的数据与可选入口，保持旧普通浏览器/default profile兼容；回滚代码前停新任务、导出用户Markdown，保留未知字段和journal，不回滚官网已提交事实。错误以明确reason/状态呈现，不自动重发。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-005**：沿用shell侧栏/page/focus-mode，不增view/router；目标含账号/会话，2–3主面板其余状态，窄屏单焦点；结果可读
- [ ] **AC-007**：逐target执行并验证真正新官网上下文；仅home URL不算成功；保留旧任务；失败目标显式阻止提交
- [ ] **AC-010**：持久失败时官网零mutation；成功flush后每attempt才允许一次commit；重复相同问题主动第二次提交生成新turn
- [ ] **AC-012**：正确输入读回、提交确认、当前parent-child answer、Markdown与terminal；页面可人工接管；非仅打开站点
- [ ] **AC-016**：选单个合格来源；source/version/identity可查；heading/table/code/math保存；空/title/status-only、缺页或无终态不标complete；原生copy不污染剪贴板
- [ ] **AC-026**：仅该provider allowlist/该task采必要字段；token/cookie/password被剔除，默认无全网HAR；卸载或取消移除hook
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-03.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。
- ui：<Path>.agents/skills/ui/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-03.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
