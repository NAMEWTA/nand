---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path>","T-19 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"94a69cfa15eefec76596e82b3a37b34b2acc2cebef7df129879b609bad9a909b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"a073cad17a5bb3d782eae6157e7e110683ae6a8dbfca4c54970c8ab275252978","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"185a8191984ecb4fadf8d1d39f197ed05d56398b78ccf8ac43f87ca01e049193","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/module-authoring.md</Path>","sha256":"dfec45b11d78296560406f2808cf3824b271ea803b59d8d1ff87e105d12327b1","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/settings-and-i18n.md</Path>","sha256":"9d0c10748081b092c0f133949ff572a6414824eec625deaf724773ad2c9b9804","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"c515700efbe2ea4d57f58852e9225beb7ee17ad58484328450112068de13de7b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/licensing.md</Path>","sha256":"309783d96aca6bdf6287ae9a7e84619286300e06c3a08c776576c613387ccfbb","when":"本票命中结构/数据或验证"}]},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path>","T-19 路径、合同和本次diff"],"outputs":["满足tokens/三栏/键盘/多窗/响应式的界面与真实宿主观察"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/ui/references/design-system.md</Path>","sha256":"3320b960e15b308a2f5fa0573e00c80ec91bef911bbc5497f4bbc8d7dc10d59c","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/shell.md</Path>","sha256":"7331476350f3b0bb8dfa25186b7557914a4ad34c21410c60a95e152ff680c128","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/motion-a11y.md</Path>","sha256":"afc7b79fc9844989f7d295acdcbe5b4a6c31f5cb7add3b1e53e51c2a75f1980c","when":"本票命中页面/组件或CSS"}]}]
resource_claims: ["nand:browser-ai-workbench:automation-browser-contribution","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-browser-ai-workbench"
id: "T-19"
title: "接入既有自动化调度与统一运行回执"
status: "ready"
kind: "feature"
planning_depth: "deep"
planning_depth_reason: "涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。"
ready: true
risk: "high"
blocked_by: ["T-18"]
contract_ids: ["AC-037"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>src/modules/browser/contrib/automations.ts</Path>","<Path>src/modules/browser/services/workflows.ts</Path>","<Path>src/modules/browser/api.ts</Path>","<Path>src/modules/browser/module.ts</Path>","<Path>src/modules/browser/i18n.ts</Path>","<Path>docs/browser.md</Path>","<Path>docs/browser.ZH.md</Path>"]
writable_paths: ["<Path>src/modules/browser/contrib/automations.ts</Path>","<Path>src/modules/browser/services/workflows.ts</Path>","<Path>src/modules/browser/api.ts</Path>","<Path>src/modules/browser/module.ts</Path>","<Path>src/modules/browser/i18n.ts</Path>","<Path>docs/browser.md</Path>","<Path>docs/browser.ZH.md</Path>","<Path>src/modules/browser/manifest.ts</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>","<Path>src/modules/browser/api.ts</Path>","<Path>src/modules/browser/module.ts</Path>","<Path>src/modules/browser/i18n.ts</Path>","<Path>docs/browser.md</Path>","<Path>docs/browser.ZH.md</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-browser-ai-workbench::T-19（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-browser-ai-workbench::T-19（本票生成物专用owner；Lead从本票已审核源重建）","<Path>src/modules/browser/api.ts</Path> => 2026-10-08-browser-ai-workbench::T-19（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/browser/module.ts</Path> => 2026-10-08-browser-ai-workbench::T-19（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/browser/i18n.ts</Path> => 2026-10-08-browser-ai-workbench::T-19（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>docs/browser.md</Path> => 2026-10-08-browser-ai-workbench::T-19（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>docs/browser.ZH.md</Path> => 2026-10-08-browser-ai-workbench::T-19（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）"]
---

# Ticket T-19: 接入既有自动化调度与统一运行回执

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/ticket/19-automation-browser-contribution.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-19.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** 在现有automations页面选浏览器流程、运行/可选调度，并用同一receipt查看取消/结果。

**当前事实：** automations现有SourceRef/action尚无browser流程，home专票负责共享receipt与typed贡献合同；本票消费owner已交付API，不修改其实现。 父确认home::T-07将补typed workflow runner/source/action contribution，本票只消费。

**来源：** AC-037；issue #142, #145；<Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/reference-analysis.md</Path>。深度 deep：涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。

## 2. 决策状态

### 已锁定决策

由browser contrib注册workflow source/action到automations/api公开扩展点，传workflowId/version/variables/scope；runId和receipt由automations owner产生，browser只回step结果/失败/unknown/artifact。scheduled运行无登录/需要最终确认时blocked/interrupted明确提示，不跨过确认、不偷选active page。 上游home::T-07必须先提供typed browser-workflow runner/source/action contribution注册口；动态agent prompt invocation本身不能代替流程执行合同。 在browser/manifest.ts声明本票新增provides/contributes并在module.ts真实装配；不能只导出api类型或未注册组件。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| 在现有automations页面选浏览器流程、运行/可选调度，并用同一receipt查看取消/结果。 | BrowserModule/page/presentation、BrowserOperationQueue、snapshot epoch:revision、debugger lease、guest permissions、Design Mode/markup、bridge/token/CLI。; 现有 workbench feature browser、NativeSurface、PanelModel、focus-mode 页面与视图生命周期；不新增 view/router/tab system。; DocumentRepository/markdown-document 保留非拥有内容；DurableState 的 flush/error/recovery；namespaced settings；Preact/primitives/tokens。; agent/api.ts 由 home 专票交付的 dispatch / normalized receipt；attachMaterial 仍仅粘贴，不能当 dispatch。automations/api.ts 既有 scheduler/run 与 home 专票 receipt。; news 的结构化 CLI 输出由 news 专票拥有；browser 如消费仅经公开 API/receipt，禁止另建 CLI provider SDK、agent 进程底座或 scheduler。 | 不实现完整日常浏览器、Chromium fork、独立云浏览器集群或企业跨环境 Grid；其参考仅记录取舍。; 不统一附件上传、模型切换、thinking 开关；站点显示不可靠的模型元数据记 unknown。; 不镜像全部官网历史/所有分支/附件，不导出 cookie/secret，不保证一键迁移 Chrome 登录、Google SSO 或 OS passkey。; 不把多模型一致当真实性验证；不自动投票，不用视觉/LLM 做固定发送的无界兜底。; 不默认开放远程端口、无人值守支付/发布/删除，不把 WebMCP early preview 当八站现有能力。 |

## 4. 要构建什么

在现有automations页面选浏览器流程、运行/可选调度，并用同一receipt查看取消/结果。

由browser contrib注册workflow source/action到automations/api公开扩展点，传workflowId/version/variables/scope；runId和receipt由automations owner产生，browser只回step结果/失败/unknown/artifact。scheduled运行无登录/需要最终确认时blocked/interrupted明确提示，不跨过确认、不偷选active page。 上游home::T-07必须先提供typed browser-workflow runner/source/action contribution注册口；动态agent prompt invocation本身不能代替流程执行合同。 在browser/manifest.ts声明本票新增provides/contributes并在module.ts真实装配；不能只导出api类型或未注册组件。

## 5. 实现契约

- **入口、输入输出、状态和错误：** 由browser contrib注册workflow source/action到automations/api公开扩展点，传workflowId/version/variables/scope；runId和receipt由automations owner产生，browser只回step结果/失败/unknown/artifact。scheduled运行无登录/需要最终确认时blocked/interrupted明确提示，不跨过确认、不偷选active page。 上游home::T-07必须先提供typed browser-workflow runner/source/action contribution注册口；动态agent prompt invocation本身不能代替流程执行合同。 在browser/manifest.ts声明本票新增provides/contributes并在module.ts真实装配；不能只导出api类型或未注册组件。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** T-18；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 依赖home::T-07，核验其公开typed browser-workflow source/action/runner注册与receipt/cancel合同；这是owner交付先决条件，browser不深import或本票私建scheduler。
2. 实现browser contrib随module生命周期注册/注销，流程列表和参数校验由browser API提供。
3. 连接手动/计划触发、取消与打开结果，映射browser known/unknown/interrupted到共享receipt。
4. 真实现有automations创建一个无外部副作用流程计划，跑成功/无page阻塞/取消各一次，查看统一历史。
5. 更新双语说明调度前提与需要人工确认行为，build/architecture/docs。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 集成 | 现有automations UI：选择已保存browser流程，手动运行、设置一次近期触发，禁用browser再触发，取消运行 | receipt唯一且可打开结果；无重复scheduler；缺page/模块关闭清楚失败/blocked，不偷偷重新登录或提交。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-19.md</Path> |
| 构建/结构 | pnpm run build；pnpm run lint；pnpm test:architecture；pnpm run check:bundle | 相关源码零类型/架构/lint错误，模块lazy与预算合规；main.js已重建。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-19.md</Path> |
| 文档 | pnpm test:docs | 调度与人工边界双语一致。 | <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-19.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** required: 真实automation owner调度/receipt链路。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

注销contribution只禁用新触发，历史receipt/artifact保留；已执行官网事实不撤销。旧自动化其他action不改语义。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-037**：通过公开contribution API注册，run receipt/取消/打开结果统一；无第二scheduler，后台高后果确认不能绕过
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-19.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。
- ui：<Path>.agents/skills/ui/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-browser-ai-workbench/evidence/T-19.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
