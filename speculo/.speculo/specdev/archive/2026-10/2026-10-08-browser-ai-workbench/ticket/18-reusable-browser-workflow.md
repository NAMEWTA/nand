---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c8fe48347cd03367c384ca52535cc1981de658721fa82093b34c271c25d295d6","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path>","T-18 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"225d8082b4b9d96b301df2f7582166cc1e3606be3f7225c4cb8c268159018ca7","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"64f00b01fd2537b7cd04387161560e9a86e25934baa923eebf5758d799719a3f","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"e2aff3c8f7c91f7c7925cd47cc5d15ebc346bb95cd5e2267c5232a90faf8ab29","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/module-authoring.md</Path>","sha256":"add18e61df97494df0d6f0ab45a5920bc0132779e6a33d53bc6c41ff1b701aab","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/settings-and-i18n.md</Path>","sha256":"4060df9ba64b510306c301238897be1635060ff177f900d37fe36abab8100751","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"0a43258e725781151d926c4f54fd4b8eebee5d58f008cb2434b7c796b450a51d","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/licensing.md</Path>","sha256":"f0c531122eaaf014fcdf73c5ba1ffd07518b7a7a7ff29b19b3030e057791ce8f","when":"本票命中结构/数据或验证"}]},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"8c362a984536481585cceeae64d8fcc784f56451262444e0400660b19c801044","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path>","T-18 路径、合同和本次diff"],"outputs":["满足tokens/三栏/键盘/多窗/响应式的界面与真实宿主观察"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/ui/references/design-system.md</Path>","sha256":"a551e294d6818a585464fb0c391be8575ba9e92d8226c9b592fa55b8637f672a","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/shell.md</Path>","sha256":"4baa20033d66228c19eb08d807fbd7d338504fae40df7b56992f40593c3ce833","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/motion-a11y.md</Path>","sha256":"be9695c35e8e8608d50b2ac34307e4debdefad99171c1a0352aabd6149e5f7f4","when":"本票命中页面/组件或CSS"}]}]
resource_claims: ["nand:browser-ai-workbench:reusable-browser-workflow","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-browser-ai-workbench"
id: "T-18"
title: "有变量和结果证据的可复用浏览器流程"
status: "done"
kind: "feature"
planning_depth: "deep"
planning_depth_reason: "涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。"
ready: false
risk: "high"
blocked_by: ["T-16"]
contract_ids: ["AC-025","AC-034","AC-036"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>src/modules/browser/core/workflows/model.ts</Path>","<Path>src/modules/browser/core/workflows/validate.ts</Path>","<Path>src/modules/browser/platform/workflow-store.ts</Path>","<Path>src/modules/browser/services/workflows.ts</Path>","<Path>src/modules/browser/ui/WorkflowEditor.tsx</Path>","<Path>src/modules/browser/ui/WorkflowRun.tsx</Path>","<Path>src/modules/browser/api.ts</Path>","<Path>src/modules/browser/i18n.ts</Path>","<Path>src/modules/browser/services/workflows.test.ts</Path>"]
writable_paths: ["<Path>src/modules/browser/core/workflows/model.ts</Path>","<Path>src/modules/browser/core/workflows/validate.ts</Path>","<Path>src/modules/browser/platform/workflow-store.ts</Path>","<Path>src/modules/browser/services/workflows.ts</Path>","<Path>src/modules/browser/ui/WorkflowEditor.tsx</Path>","<Path>src/modules/browser/ui/WorkflowRun.tsx</Path>","<Path>src/modules/browser/api.ts</Path>","<Path>src/modules/browser/i18n.ts</Path>","<Path>src/modules/browser/services/workflows.test.ts</Path>","<Path>src/modules/browser/module.ts</Path>","<Path>src/modules/browser/ui/workbench-page.ts</Path>","<Path>src/modules/browser/ui/WebAssistant.tsx</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>","<Path>src/modules/browser/api.ts</Path>","<Path>src/modules/browser/i18n.ts</Path>","<Path>src/modules/browser/module.ts</Path>","<Path>src/modules/browser/ui/WebAssistant.tsx</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-browser-ai-workbench::T-18（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-browser-ai-workbench::T-18（本票生成物专用owner；Lead从本票已审核源重建）","<Path>src/modules/browser/api.ts</Path> => 2026-10-08-browser-ai-workbench::T-18（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/browser/i18n.ts</Path> => 2026-10-08-browser-ai-workbench::T-18（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/browser/module.ts</Path> => 2026-10-08-browser-ai-workbench::T-18（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/browser/ui/WebAssistant.tsx</Path> => 2026-10-08-browser-ai-workbench::T-18（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）"]
---

# Ticket T-18: 有变量和结果证据的可复用浏览器流程

<!-- ACCEPTANCE-20261011 -->
最终验收与授权以 [completion.md](../evidence/completion.md) 为准。原规划与原始未验证结论保留。

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查：[T-18.md](../evidence/T-18.md)。本票下文保留原规划合同与基线；当前实现、修复、验证及未验证条件以该记录为准。原“仅规划／未授权实施／必须提交”的阶段约束不适用于用户已授权的本次工作区审查；提交与远程操作仍未执行。
<!-- ACTUAL-CODE-REVIEW:END -->

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/18-reusable-browser-workflow.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-18.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** 用户把已验证的步骤保存成带变量的流程并手动运行/取消，看到每步前后条件和最终结果。

**规划时基线：** 现有浏览器操作是单次CLI/队列，无浏览器业务流程文档；automations已有全局scheduler，不能另造。

**来源：** AC-025, AC-034, AC-036；issue #142, #145；<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/reference-analysis.md</Path>。深度 deep：涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。

## 2. 决策状态

### 已锁定决策

BrowserWorkflowSpec{id,version,title,variables:[name,type,required,default?],targetScope,steps:[id,operation,args,precondition,postcondition],consequenceClass}保存在可见NAND/AI 工作台/流程/<id>.md；secret变量运行时输入不落模板。只有限typed操作与数据插值，无任意脚本/无限循环。runId关联单一shared receipt，步骤和artifact属browser，执行沿same owner/journal。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| 用户把已验证的步骤保存成带变量的流程并手动运行/取消，看到每步前后条件和最终结果。 | BrowserModule/page/presentation、BrowserOperationQueue、snapshot epoch:revision、debugger lease、guest permissions、Design Mode/markup、bridge/token/CLI。; 现有 workbench feature browser、NativeSurface、PanelModel、focus-mode 页面与视图生命周期；不新增 view/router/tab system。; DocumentRepository/markdown-document 保留非拥有内容；DurableState 的 flush/error/recovery；namespaced settings；Preact/primitives/tokens。; agent/api.ts 由 home 专票交付的 dispatch / normalized receipt；attachMaterial 仍仅粘贴，不能当 dispatch。automations/api.ts 既有 scheduler/run 与 home 专票 receipt。; news 的结构化 CLI 输出由 news 专票拥有；browser 如消费仅经公开 API/receipt，禁止另建 CLI provider SDK、agent 进程底座或 scheduler。 | 不实现完整日常浏览器、Chromium fork、独立云浏览器集群或企业跨环境 Grid；其参考仅记录取舍。; 不统一附件上传、模型切换、thinking 开关；站点显示不可靠的模型元数据记 unknown。; 不镜像全部官网历史/所有分支/附件，不导出 cookie/secret，不保证一键迁移 Chrome 登录、Google SSO 或 OS passkey。; 不把多模型一致当真实性验证；不自动投票，不用视觉/LLM 做固定发送的无界兜底。; 不默认开放远程端口、无人值守支付/发布/删除，不把 WebMCP early preview 当八站现有能力。 |

## 4. 要构建什么

用户把已验证的步骤保存成带变量的流程并手动运行/取消，看到每步前后条件和最终结果。

BrowserWorkflowSpec{id,version,title,variables:[name,type,required,default?],targetScope,steps:[id,operation,args,precondition,postcondition],consequenceClass}保存在可见NAND/AI 工作台/流程/<id>.md；secret变量运行时输入不落模板。只有限typed操作与数据插值，无任意脚本/无限循环。runId关联单一shared receipt，步骤和artifact属browser，执行沿same owner/journal。

## 5. 实现契约

- **入口、输入输出、状态和错误：** BrowserWorkflowSpec{id,version,title,variables:[name,type,required,default?],targetScope,steps:[id,operation,args,precondition,postcondition],consequenceClass}保存在可见NAND/AI 工作台/流程/<id>.md；secret变量运行时输入不落模板。只有限typed操作与数据插值，无任意脚本/无限循环。runId关联单一shared receipt，步骤和artifact属browser，执行沿same owner/journal。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** T-16；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 定义可见Markdown流程schema和有限typed步骤/变量校验，引用现有control动作，不建低层流程解释器生态。
2. 做shell内编辑/验证/保存及从已验证步骤生成流程，错误定位具体step。 在本票授权的现有页面/设置/模块装配处接入实际导航入口，用户可从工作台完成操作，不留下孤立组件。
3. 实现手动run/step前后条件/result/cancel，日志只存去敏感字段，未知动作停而非自动兜底。
4. 接入高后果动作现有最终确认、人工接管和resume；定时能力留T-19由automations接入。
5. 一个代表流程真实运行两次换变量、一次中断/接管，验证结果与run records可追溯；最少模型契约测试。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 流程契约 | 新增workflows.test.ts后 pnpm exec vitest run src/modules/browser/services/workflows.test.ts | 变量/operation越界拒绝，取消后无新步骤，高后果无确认不执行。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-18.md</Path> |
| 真实复用 | 受控网页保存三步流程，两个不同变量各运行一次；第三次暂停人工接管再恢复/取消 | 结果与变量正确，run按step显示证据，无第二scheduler。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-18.md</Path> |
| 构建/结构 | pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle | 相关源码零类型/架构/lint错误，模块lazy与预算合规；main.js已重建。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-18.md</Path> |
| UI/规范 | node scripts/build-styles.mjs --write；pnpm run lint:css；pnpm test:i18n；真实workbench在≥960、600–960、<600宽度及亮/暗/三preset查看 | styles.css重建，界面可读可键盘操作、可见focus、无新增设计系统；移动端控制边界明确。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-18.md</Path> |
| 功能入口遗漏 | 从真实工作台现有入口导航到本票UI，完成一次正常操作后返回并重载 | 入口可发现、页面由既有shell承载，数据恢复且无新view/router | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-18.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** required: 变量复用、真实page动作及暂停/取消。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

只新增明确version的数据与可选入口，保持旧普通浏览器/default profile兼容；回滚代码前停新任务、导出用户Markdown，保留未知字段和journal，不回滚官网已提交事实。错误以明确reason/状态呈现，不自动重发。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-025**：停止新mutation；已dispatch事实明确完成/unknown；resume重验identity/draft/ref，不使用过期引用；人工操作不被旧执行抢回
- [ ] **AC-034**：页面文本不授权；越界拒绝；高后果展示对象/内容/目的地最终确认，拒绝无mutation；原有普通提问不加逐步确认
- [ ] **AC-036**：有限step/variable schema、pre/postcondition与run结果可见；复用同队列/ownership；取消后不派发新动作，unknown诚实
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-18.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。
- ui：<Path>.agents/skills/ui/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-18.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
