---
schema_version: 3
plan_contract_version: 1
skill_scan: "已扫描 .agents/skills/dev 与 ui 的真实入口、AGENTS和命中reference；下列绑定是实际适用项，不是allowlist。"
skill_bindings: [{"id":"dev","path":"<Path>.agents/skills/dev/SKILL.md</Path>","sha256":"c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/tickets-map.md</Path>","T-07 路径、合同和本次diff"],"outputs":["符合分层/生命周期/存储/双语/构建要求的实现和可回读验证记录"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/dev/references/architecture.md</Path>","sha256":"94a69cfa15eefec76596e82b3a37b34b2acc2cebef7df129879b609bad9a909b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/testing.md</Path>","sha256":"a073cad17a5bb3d782eae6157e7e110683ae6a8dbfca4c54970c8ab275252978","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/build-and-release.md</Path>","sha256":"185a8191984ecb4fadf8d1d39f197ed05d56398b78ccf8ac43f87ca01e049193","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/module-authoring.md</Path>","sha256":"dfec45b11d78296560406f2808cf3824b271ea803b59d8d1ff87e105d12327b1","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/settings-and-i18n.md</Path>","sha256":"9d0c10748081b092c0f133949ff572a6414824eec625deaf724773ad2c9b9804","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/obsidian-api.md</Path>","sha256":"c515700efbe2ea4d57f58852e9225beb7ee17ad58484328450112068de13de7b","when":"本票命中结构/数据或验证"},{"path":"<Path>.agents/skills/dev/references/licensing.md</Path>","sha256":"309783d96aca6bdf6287ae9a7e84619286300e06c3a08c776576c613387ccfbb","when":"本票命中结构/数据或验证"}]},{"id":"ui","path":"<Path>.agents/skills/ui/SKILL.md</Path>","sha256":"f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723","phase":"implement","operation":"apply-project-rules","inputs":["<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/tickets-map.md</Path>","T-07 路径、合同和本次diff"],"outputs":["满足tokens/三栏/键盘/多窗/响应式的界面与真实宿主观察"],"required":true,"on_failure":"block-ticket","references":[{"path":"<Path>.agents/skills/ui/references/design-system.md</Path>","sha256":"3320b960e15b308a2f5fa0573e00c80ec91bef911bbc5497f4bbc8d7dc10d59c","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/shell.md</Path>","sha256":"7331476350f3b0bb8dfa25186b7557914a4ad34c21410c60a95e152ff680c128","when":"本票命中页面/组件或CSS"},{"path":"<Path>.agents/skills/ui/references/motion-a11y.md</Path>","sha256":"afc7b79fc9844989f7d295acdcbe5b4a6c31f5cb7add3b1e53e51c2a75f1980c","when":"本票命中页面/组件或CSS"}]}]
resource_claims: ["nand:home-grid-rebuild:shared-agent-shortcut-dispatch","repository:NAMEWTA/nand:current-single-writer"]
artifact: "ticket"
change: "2026-10-08-home-grid-rebuild"
id: "T-07"
title: "建立公共技能模板、可编辑预览与新会话派发"
status: "ready"
kind: "feature"
planning_depth: "deep"
planning_depth_reason: "涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。"
ready: true
risk: "high"
blocked_by: ["T-03"]
contract_ids: ["AC-024","AC-025","AC-026","AC-027","AC-028","AC-029","AC-030"]
owner: "Lead（current串行；执行时可动态分配单writer）"
expected_changes: ["<Path>src/shared/agent-prompt.ts</Path>","<Path>src/modules/agent/api.ts</Path>","<Path>src/modules/agent/services/prompt-dispatch.ts</Path>","<Path>src/modules/automations/api.ts</Path>","<Path>src/modules/home/ui/skills/SkillWidget.tsx</Path>","<Path>src/modules/home/ui/skills/AgentPromptPanel.tsx</Path>"]
writable_paths: ["<Path>src/shared/agent-prompt.ts</Path>","<Path>src/shared/agent-prompt.test.ts</Path>","<Path>src/shared/automation/types.ts</Path>","<Path>src/modules/agent/api.ts</Path>","<Path>src/modules/agent/module.ts</Path>","<Path>src/modules/agent/services/prompt-dispatch.ts</Path>","<Path>src/modules/agent/services/agent-runtime.ts</Path>","<Path>src/modules/automations/api.ts</Path>","<Path>src/modules/automations/core/</Path>","<Path>src/modules/automations/services/runtime.ts</Path>","<Path>src/modules/home/core/board/types/model.ts</Path>","<Path>src/modules/home/core/board/parser/</Path>","<Path>src/modules/home/services/skill-shortcuts.ts</Path>","<Path>src/modules/home/contrib/widgets.ts</Path>","<Path>src/modules/home/ui/skills/SkillWidget.tsx</Path>","<Path>src/modules/home/ui/skills/AgentPromptPanel.tsx</Path>","<Path>src/modules/home/ui/skills/skill-config.ts</Path>","<Path>src/modules/home/i18n.ts</Path>","<Path>src/modules/agent/i18n.ts</Path>","<Path>src/modules/automations/i18n.ts</Path>","<Path>test/golden/</Path>","<Path>docs/agent-workbench.md</Path>","<Path>docs/agent-workbench.ZH.md</Path>","<Path>src/modules/automations/module.ts</Path>","<Path>src/modules/automations/manifest.ts</Path>","<Path>src/modules/automations/ui/editor.ts</Path>","<Path>src/modules/automations/ui/AutomationRunList.tsx</Path>","<Path>src/shared/i18n/lazy/automation.ts</Path>"]
read_only_paths: ["<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/spec.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ADR.md</Path>","<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/reference-analysis.md</Path>"]
shared_paths: ["<Path>main.js</Path>","<Path>styles.css</Path>","<Path>src/modules/home/core/board/types/model.ts</Path>","<Path>src/modules/home/core/board/parser/</Path>","<Path>src/modules/home/i18n.ts</Path>","<Path>test/golden/</Path>"]
shared_path_owners: ["<Path>main.js</Path> => 2026-10-08-home-grid-rebuild::T-07（本票生成物专用owner；Lead从本票已审核源重建）","<Path>styles.css</Path> => 2026-10-08-home-grid-rebuild::T-07（本票生成物专用owner；Lead从本票已审核源重建）","<Path>src/modules/home/core/board/types/model.ts</Path> => 2026-10-08-home-grid-rebuild::T-07（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/home/core/board/parser/</Path> => 2026-10-08-home-grid-rebuild::T-07（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>src/modules/home/i18n.ts</Path> => 2026-10-08-home-grid-rebuild::T-07（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）","<Path>test/golden/</Path> => 2026-10-08-home-grid-rebuild::T-07（本功能阶段专用owner；current串行交接，消费者只读该票已冻结合同）"]
---

# Ticket T-07: 建立公共技能模板、可编辑预览与新会话派发

<!-- ACTUAL-CODE-REVIEW:START -->
2026-10-11 实际代码审查：[T-07.md](../evidence/T-07.md)。本票下文保留原规划合同与基线；当前实现、修复、验证及未验证条件以该记录为准。原“仅规划／未授权实施／必须提交”的阶段约束不适用于用户已授权的本次工作区审查；提交与远程操作仍未执行。
<!-- ACTUAL-CODE-REVIEW:END -->

- Ticket：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/ticket/07-shared-agent-shortcut-dispatch.md</Path>
- 总控Map：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/tickets-map.md</Path>
- Spec：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/spec.md</Path>
- Evidence：<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-07.md</Path>

实现者必须先完整读取Tickets Map，再读取项目Skill入口与适用ALL/本票reference，最后读取本票与依赖Evidence。Skill矩阵是最低必读集合；新增命中项先由Lead重绑并验证。

## 1. 战略与来源

**目标与可观察产出：** 从一个可配置技能小组件生成精确prompt，经预览编辑或直发创建真实新agent会话并可追踪结果；公共能力供news/browser复用。

**规划时基线：** 当前runAction仅saved id，agent/api无公共shortcut dispatch；上游preview实际readonly，不能满足issue可编辑要求。runtime.start和运行日志已有，必须复用。

**来源：** AC-024, AC-025, AC-026, AC-027, AC-028, AC-029, AC-030；issue #137, #141；<Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/reference-analysis.md</Path>。深度 deep：涉及持久数据/公共接口/进程或权限的跨边界合同，必须记录恢复与兼容。

## 2. 决策状态

### 已锁定决策

本change拥有AGENT_DISPATCH及受约束automation invocation/receipt接口。请求携带invocationId/source/destination/finalPrompt/files，响应区分started/pasted/timeout/rejected，不把交付当完成。fresh最终走已有runtime.start；先记录再启动。buildAgentPrompt纯共享单次变量替换且literal value不可再展开。对话框真正编辑finalPrompt，确认不重新计算覆盖；默认预览、每按钮directSend明确、10s交付等待，模块off不自动激活。 automations/api公开typed browser-workflow source/action runner注册与可撤回dispose，输入workflowId/variables/scope和AbortSignal，返回统一receipt；scheduler仍由automations持有，browser只提供执行器，不新增timer。receipt区分交付与业务完成。 现有自动化编辑器根据注册描述显示可选browser-workflow、workflowId和变量，运行列表正确显示receipt/取消/结果链接；消费方无注册时显示缺席状态而不抹定义。公开服务在module实际装配并声明manifest，不只新增类型。

### 已采用的低影响假设

沿用项目命名、现有工具和组件；新增实现文件路径可按已授权目录细化，不改变功能边界。

### 未决问题

无。

## 3. 范围边界

| IN（本票） | REUSE | OUT |
|---|---|---|
| 从一个可配置技能小组件生成精确prompt，经预览编辑或直发创建真实新agent会话并可追踪结果；公共能力供news/browser复用。 | home BoardOperations、BoardRegistry 与现有 workspace 文件路径; parser 的 source/baseline、preserveDashboardDocument、patchFrontmatter/patchManagedLines 与现有冲突恢复; ModuleContext contributions/services/lifetime 与 Preact shell page/panel; AGENT_SESSIONS、AgentRuntimePort、自动化运行记录与通知服务; 现有 lunar-typescript 及 lunar-compute，抽取可复用纯转换后复用; theme/settings/runtime 与 home Appearance 控件，不增加私有颜色系统; public Obsidian getIconIds、icons lazy keywords 经合法接口复用; 现有 note creation/filter prefill/unique filenames、trashLibraryFile 与 fileManager.renameFile; 现有 Vitest/golden、feature verify 脚本与 real-Obsidian acceptance 探针 | RSS/新闻抓取、阅读产品由 #136/news change 实现，本 change 仅提供贡献契约; Claudian/Copilot/Codex Desktop/ZCode 外部适配器为明确非必选后续项; GPL home-pages 实现代码、单体 apex renderer/i18n/saveData/整份 CSS; dnd-kit/gridstack 或第二套 UI 系统、新 Obsidian view/router/tab 系统; 按看板独立主题/私有调色板、作者个人目录预设、TickTick 集成; 本轮代码实施、提交、推送、关闭 issue、创建 PR 或发布 |

## 4. 要构建什么

从一个可配置技能小组件生成精确prompt，经预览编辑或直发创建真实新agent会话并可追踪结果；公共能力供news/browser复用。

本change拥有AGENT_DISPATCH及受约束automation invocation/receipt接口。请求携带invocationId/source/destination/finalPrompt/files，响应区分started/pasted/timeout/rejected，不把交付当完成。fresh最终走已有runtime.start；先记录再启动。buildAgentPrompt纯共享单次变量替换且literal value不可再展开。对话框真正编辑finalPrompt，确认不重新计算覆盖；默认预览、每按钮directSend明确、10s交付等待，模块off不自动激活。 automations/api公开typed browser-workflow source/action runner注册与可撤回dispose，输入workflowId/variables/scope和AbortSignal，返回统一receipt；scheduler仍由automations持有，browser只提供执行器，不新增timer。receipt区分交付与业务完成。 现有自动化编辑器根据注册描述显示可选browser-workflow、workflowId和变量，运行列表正确显示receipt/取消/结果链接；消费方无注册时显示缺席状态而不抹定义。公开服务在module实际装配并声明manifest，不只新增类型。

## 5. 实现契约

- **入口、输入输出、状态和错误：** 本change拥有AGENT_DISPATCH及受约束automation invocation/receipt接口。请求携带invocationId/source/destination/finalPrompt/files，响应区分started/pasted/timeout/rejected，不把交付当完成。fresh最终走已有runtime.start；先记录再启动。buildAgentPrompt纯共享单次变量替换且literal value不可再展开。对话框真正编辑finalPrompt，确认不重新计算覆盖；默认预览、每按钮directSend明确、10s交付等待，模块off不自动激活。 automations/api公开typed browser-workflow source/action runner注册与可撤回dispose，输入workflowId/variables/scope和AbortSignal，返回统一receipt；scheduler仍由automations持有，browser只提供执行器，不新增timer。receipt区分交付与业务完成。 现有自动化编辑器根据注册描述显示可选browser-workflow、workflowId和变量，运行列表正确显示receipt/取消/结果链接；消费方无注册时显示缺席状态而不抹定义。公开服务在module实际装配并声明manifest，不只新增类型。
- **不变量/兼容：** 本票AC全部成立，既有用户数据和非目标能力保持；跨模块仅api，Node/Electron仅desktop。
- **依赖合同：** T-03；跨change消费者还须读取父Implementation Map真实边与Gate，不能仅凭本地ready启动。
- **安全与隐私：** 不输出凭据/不自动扩大文件或网络授权，具体风险按本票恢复说明。

## 6. 执行路线

1. 定稿共享prompt/dispatch/invocation类型，将agent runtime key保持原名兼容并把公共所有权写入api说明。
2. 适配自动化现有manual运行记录接动态prompt/source，不建立第二套run store；用invocationId防重复。 同时扩展typed browser-workflow registration与AbortSignal/receipt类型，保留agent invocation兼容。 接通现有自动化editor字段与运行列表receipt，不另建自动化页面。
3. 实现agent服务availability/errors/readiness/新会话路由，保留现有completion与权限策略。
4. 实现HOME_WIDGETS技能组件配置和lazy Preact预览，finalPrompt draft与输入模板状态明确分离。
5. 连接取消/立即关窗/后台记录通知与module teardown，添加格式和关键派发测试。
6. 补充双语数据/终端使用说明与apex文件映射，验证fresh真实CLI。

## 7. 路径访问契约

预计修改点、可写/只读/共享路径以frontmatter为硬边界。共享生成物main.js/styles.css归本票专用owner，由Lead从本票源构建。共享源码按父序列在票开始前登记owner交接；本票只修改自身合同负责的部分，消费者只读生产者已冻结合同。任何需要改动生产者合同的工作回到该owner，不能借共享文件授权越权。新增测试只能写已授权同域路径；若发现未授权引用/技能/文件先报告精确越界并由Lead修订票。保留用户已存在的speculo工作流改动，不格式化全仓。

## 8. 验证矩阵

| 行为或风险 | 验证接缝与命令/步骤 | 预期结果 | Evidence |
|---|---|---|---|
| 纯逻辑 | pnpm test | 新增shared/agent-prompt.test.ts按现有Vitest覆盖token、literal变量、非法技能名、最终文本；automation.test.ts覆盖先记录/一次start | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-07.md</Path> |
| 格式 | pnpm exec vitest run test/golden/user-formats.test.ts | 新shortcut字段roundtrip，旧格式未被顺手重写 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-07.md</Path> |
| 真实派发 | 真实Obsidian配置fresh技能，预览修改最终文本后发送/直发，查看终端和运行记录 | 一次start接准确文本；弹窗立即关闭、run和source可查，状态不猜测 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-07.md</Path> |
| 失败生命周期 | 禁用agent、制造busy/readiness timeout、关闭page后观察 | 准确本地化错误和清理，超时不伪称底层取消 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-07.md</Path> |
| 规范 | pnpm test:architecture && pnpm run check:bundle && pnpm run test:safety-regressions | 跨模块仅api，lazy预算和现有自动化安全回归通过 | <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-07.md</Path> |

- **Workspace checks：** current-workspace执行本票定向检查及build/lint；结构变更再architecture/bundle，CSS再lint:css/styles，文案再i18n，文档再docs。不逐票重复无关全量测试。
- **E2E disposition：** required: fresh技能配置、editable preview原文、directSend、重复点击、off/busy/timeout、记录与真实CLI完成状态。
- **E2E owner/environment：** Lead / current-workspace；真实宿主前置条件和步骤以上表为准；未可用则保留未验证，不代填通过。
- **Integration evidence：** 获得后续实施/提交授权后记录base、非空implementation/source commit、direct-parent验证、result SHA和父分支包含关系。本轮不创建Evidence假装执行。

## 9. 发布、迁移与恢复

新增shortcut仅用户保存后写YAML；公开接口保留旧runtime key兼容导出和原runAction。流程接受后可能真实启动agent，这是用户点击的显式执行；UI取消在commit之前零启动，commit后按既有runtime停止策略，不擅自杀任务。

发布/推送/远程写入未授权；不存在必需迁移的局部票只记录可回退代码/文档。公共schema改动采用扩展→迁移→收缩，旧调用归零前不删。

## 10. 验收标准

- [ ] **AC-024**：Claude Code /、Codex $；单次原模板替换，值不二次展开，未知变量保留，非法技能名明确拒绝
- [ ] **AC-025**：真正可编辑的最终文本原样提交一次，确认立即关窗，状态由通知/记录反馈
- [ ] **AC-026**：经agent公开端口到现有runtime.start，先有运行记录，正确关联source/run/terminal，真实完成状态由runtime报告
- [ ] **AC-027**：直发按本按钮配置；同invocation只启动一次，最终prompt快照可查
- [ ] **AC-028**：有本地化missing/unsupported/chat/busy/timeout反馈，模块关闭占位且不自动启用；超时不谎称取消任务
- [ ] **AC-029**：释放自有定时器/监听/lease，不遗留弹窗；既已启动任务按现有owner政策处理，状态真实
- [ ] **AC-030**：新字段有golden并正确恢复，旧字段与无关原文不变，home不导入agent私有代码
- [ ] Map → 适用项目Skill → Ticket按序读取并实际应用，绑定摘要未漂移。
- [ ] 验证矩阵的结果、命令、环境、未运行项写入 <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-07.md</Path>。
- [ ] 修改未越出writable/shared owner；用户原有改动完整保留。
- [ ] 非空implementation/source commit及direct-parent/result SHA可核对；必需E2E由Lead完成。
- [ ] 所有scope/数据/参考差异已获决定，Ticket/Map/Evidence同步，不用空提交或只写“done”关闭。

## 11. SKILL 调用计划

- dev：<Path>.agents/skills/dev/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 c56ddb21a429408d523d139f3c5c8dc637187a0f18ab65dfe1f8cc180e63ef89；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。
- ui：<Path>.agents/skills/ui/SKILL.md</Path>，implement阶段调用 apply-project-rules。输入为当前Map、本票和真实diff；按命中reference完成分层/界面和验证步骤，输出用于下一步Lead验收。sha256固定为 f78f3e974ff373077a66c78144be01ff7c4ca1775ca75f94186b4ce65bdc1723；缺失或摘要漂移 block-ticket，由Lead审查后重新绑定，不能自动信任新内容。


## 12. 停止、检查点与交付

交付本票全部AC和上表可观察产出；用户没有指定票数，但13个issue及每个change Spec/Tickets/Goal和整体Goal不得遗漏。缺必需Skill/验证条件阻塞本票，继续不相关已授权分支；路径/公共合同改变返回真正owner。记录HEAD、已完成步骤、当前失败和 <Path>{roots.state}/specdev/changes/2026-10-08-home-grid-rebuild/evidence/T-07.md</Path> 恢复位置；本轮只规划、未实施、无发布权限。

### 当前技能版本补充

工作区规范已更新：.agents/skills仅中文.md，使用指南和仓库入口仍中英双份。本票不重建已移除的Skill .ZH.md；实际引用及摘要已在规划发布前由Lead重新读取并绑定。授权边界不变。
